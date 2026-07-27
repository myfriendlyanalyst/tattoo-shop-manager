export type PayoutPaymentMethod = "cash" | "credit_card" | "app";

export type PayoutPayment = {
  amount: number;
  paymentMethod: string | null;
  paymentType: "tattoo" | "tip";
};

export type PayoutDepositApplication = {
  amount: number;
  paymentMethod: string | null;
};

export type PayoutSession = {
  id: string;
  tattooAmount: number;
  tattooPaymentMethod: string | null;
  tipAmount: number;
  tipPaymentMethod: string | null;
  payments: PayoutPayment[];
  deposits: PayoutDepositApplication[];
};

export type PayoutCalculation = {
  artistEarnings: number;
  artistRate: number;
  cardTipFee: number;
  cardTipFeeRate: number;
  settlementBeforeAdjustment: number;
  tattoo: Record<PayoutPaymentMethod, number>;
  tattooArtistEarnings: number;
  tip: Record<PayoutPaymentMethod, number>;
  tipArtistEarnings: number;
};

const supportedMethods: PayoutPaymentMethod[] = ["cash", "credit_card", "app"];

function cents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function emptyMethodTotals(): Record<PayoutPaymentMethod, number> {
  return { app: 0, cash: 0, credit_card: 0 };
}

function addAmount(
  totals: Record<PayoutPaymentMethod, number>,
  method: string | null,
  amount: number,
) {
  if (supportedMethods.includes(method as PayoutPaymentMethod)) {
    totals[method as PayoutPaymentMethod] += amount;
  }
}

export function calculatePayout(
  sessions: PayoutSession[],
  artistRate: number,
  cardTipFeeRate = 3,
): PayoutCalculation {
  const tattoo = emptyMethodTotals();
  const tip = emptyMethodTotals();

  for (const session of sessions) {
    const tattooPayments = session.payments.filter((payment) => payment.paymentType === "tattoo");
    const tipPayments = session.payments.filter((payment) => payment.paymentType === "tip");
    const appliedDepositTotal = session.deposits.reduce(
      (sum, deposit) => sum + Number(deposit.amount),
      0,
    );

    for (const deposit of session.deposits) {
      addAmount(tattoo, deposit.paymentMethod, Number(deposit.amount));
    }

    if (tattooPayments.length) {
      for (const payment of tattooPayments) {
        addAmount(tattoo, payment.paymentMethod, Number(payment.amount));
      }
    } else {
      addAmount(
        tattoo,
        session.tattooPaymentMethod,
        Math.max(Number(session.tattooAmount) - appliedDepositTotal, 0),
      );
    }

    if (tipPayments.length) {
      for (const payment of tipPayments) {
        addAmount(tip, payment.paymentMethod, Number(payment.amount));
      }
    } else {
      addAmount(tip, session.tipPaymentMethod, Number(session.tipAmount));
    }
  }

  const artistRateDecimal = artistRate / 100;
  const shopRateDecimal = 1 - artistRateDecimal;
  const cardTipFee = cents(tip.credit_card * (cardTipFeeRate / 100));
  const tattooArtistEarnings = cents(
    (tattoo.cash + tattoo.credit_card + tattoo.app) * artistRateDecimal,
  );
  const tipArtistEarnings = cents(tip.cash + tip.credit_card - cardTipFee + tip.app);
  const settlementBeforeAdjustment = cents(
    tattoo.cash * artistRateDecimal +
      tattoo.credit_card * artistRateDecimal -
      tattoo.app * shopRateDecimal +
      tip.cash +
      tip.credit_card -
      cardTipFee,
  );

  return {
    artistEarnings: cents(tattooArtistEarnings + tipArtistEarnings),
    artistRate,
    cardTipFee,
    cardTipFeeRate,
    settlementBeforeAdjustment,
    tattoo: {
      app: cents(tattoo.app),
      cash: cents(tattoo.cash),
      credit_card: cents(tattoo.credit_card),
    },
    tattooArtistEarnings,
    tip: {
      app: cents(tip.app),
      cash: cents(tip.cash),
      credit_card: cents(tip.credit_card),
    },
    tipArtistEarnings,
  };
}
