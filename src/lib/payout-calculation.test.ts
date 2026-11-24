import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPayoutPeriodRange,
  calculatePayout,
  type PayoutSession,
} from "./payout-calculation.ts";

function session(overrides: Partial<PayoutSession> = {}): PayoutSession {
  return {
    deposits: [],
    id: "session-1",
    payments: [],
    tattooAmount: 0,
    tattooPaymentMethod: null,
    tipAmount: 0,
    tipPaymentMethod: null,
    ...overrides,
  };
}

test("Cash tattoo and tip are fully represented in artist earnings and settlement", () => {
  const result = calculatePayout(
    [session({ tattooAmount: 500, tattooPaymentMethod: "cash", tipAmount: 50, tipPaymentMethod: "cash" })],
    60,
  );

  assert.deepEqual(result.tattoo, { app: 0, cash: 500, credit_card: 0 });
  assert.deepEqual(result.tip, { app: 0, cash: 50, credit_card: 0 });
  assert.equal(result.artistEarnings, 350);
  assert.equal(result.settlementBeforeAdjustment, 350);
});

test("Card tattoo fee stays with the Shop while the card tip fee reduces artist earnings", () => {
  const result = calculatePayout(
    [session({ tattooAmount: 500, tattooPaymentMethod: "credit_card", tipAmount: 50, tipPaymentMethod: "credit_card" })],
    60,
  );

  assert.equal(result.cardTipFee, 1.5);
  assert.equal(result.tattooArtistEarnings, 300);
  assert.equal(result.tipArtistEarnings, 48.5);
  assert.equal(result.settlementBeforeAdjustment, 348.5);
});

test("Artist-held App payments reduce the Shop-to-Artist settlement without reducing earnings", () => {
  const result = calculatePayout(
    [session({ tattooAmount: 500, tattooPaymentMethod: "app", tipAmount: 50, tipPaymentMethod: "app" })],
    60,
  );

  assert.equal(result.artistEarnings, 350);
  assert.equal(result.settlementBeforeAdjustment, -200);
});

test("Split payments use payment rows instead of legacy summary methods", () => {
  const result = calculatePayout(
    [
      session({
        payments: [
          { amount: 200, paymentMethod: "cash", paymentType: "tattoo" },
          { amount: 300, paymentMethod: "credit_card", paymentType: "tattoo" },
          { amount: 20, paymentMethod: "cash", paymentType: "tip" },
          { amount: 30, paymentMethod: "app", paymentType: "tip" },
        ],
        tattooAmount: 999,
        tattooPaymentMethod: "app",
        tipAmount: 999,
        tipPaymentMethod: "credit_card",
      }),
    ],
    60,
  );

  assert.deepEqual(result.tattoo, { app: 0, cash: 200, credit_card: 300 });
  assert.deepEqual(result.tip, { app: 30, cash: 20, credit_card: 0 });
  assert.equal(result.artistEarnings, 350);
  assert.equal(result.settlementBeforeAdjustment, 320);
});

test("Applied Deposit retains its original method and only the remaining tattoo amount uses the session method", () => {
  const result = calculatePayout(
    [
      session({
        deposits: [{ amount: 100, paymentMethod: "credit_card" }],
        tattooAmount: 500,
        tattooPaymentMethod: "cash",
      }),
    ],
    60,
  );

  assert.deepEqual(result.tattoo, { app: 0, cash: 400, credit_card: 100 });
  assert.equal(result.artistEarnings, 300);
  assert.equal(result.settlementBeforeAdjustment, 300);
});

test("Money rounds to cents at the payout boundary", () => {
  const result = calculatePayout(
    [session({ tattooAmount: 10.01, tattooPaymentMethod: "cash", tipAmount: 10.01, tipPaymentMethod: "credit_card" })],
    33.33,
  );

  assert.equal(result.cardTipFee, 0.3);
  assert.equal(result.tattooArtistEarnings, 3.34);
  assert.equal(result.tipArtistEarnings, 9.71);
  assert.equal(result.artistEarnings, 13.05);
  assert.equal(result.settlementBeforeAdjustment, 13.05);
});

test("Payout period includes both local calendar-date boundaries", () => {
  const range = buildPayoutPeriodRange("2026-11-01", "2026-11-14");

  assert.equal(range.from, new Date(2026, 10, 1, 0, 0, 0, 0).toISOString());
  assert.equal(range.to, new Date(2026, 10, 14, 23, 59, 59, 999).toISOString());
});
