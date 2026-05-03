"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";

type EntryKind = "Session" | "Deposit" | "Merch";

type Appointment = {
  id: string;
  time: string;
  client: string;
  project: string;
  artist: string;
  type: string;
  deposit: string;
  waiver: string;
};

type Receipt = {
  artist: string;
  client: string;
  project: string;
  kind: EntryKind;
  tattooAmount: number;
  tattooPayment: string;
  tipAmount: number;
  tipPayment: string;
  depositAmount: number;
  depositPayment: string;
  merchAmount: number;
  merchPayment: string;
  memo: string;
};

const appointments: Appointment[] = [
  {
    id: "APT-3301",
    time: "11:00 AM",
    client: "Armando Gonzales",
    project: "Vagabond",
    artist: "JC",
    type: "On-Going",
    deposit: "$180 available",
    waiver: "Signed",
  },
  {
    id: "APT-3302",
    time: "1:00 PM",
    client: "Sora Kim",
    project: "Dragon sleeve",
    artist: "YUSHI",
    type: "One-Done",
    deposit: "$250 available",
    waiver: "Missing",
  },
  {
    id: "APT-3303",
    time: "1:30 PM",
    client: "Leo Grant",
    project: "Walk-in flash",
    artist: "BAKI",
    type: "Walk-in",
    deposit: "No deposit",
    waiver: "Signed",
  },
  {
    id: "APT-3304",
    time: "4:00 PM",
    client: "Nina Park",
    project: "Minimal crescent",
    artist: "AIMEE",
    type: "Deposit",
    deposit: "$150 due",
    waiver: "Not needed yet",
  },
];

const paymentMethods = ["Cash", "Credit Card", "Venmo / Zelle / Cash App", "Other"];
const artists = ["JC", "YUSHI", "BAKI", "AIMEE"];

function money(value: number) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 ? 2 : 0,
  })}`;
}

export default function ArtistEntryPage() {
  const [artist, setArtist] = useState("JC");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("APT-3301");
  const [entryKind, setEntryKind] = useState<EntryKind>("Session");
  const [tattooAmount, setTattooAmount] = useState("200");
  const [tattooPayment, setTattooPayment] = useState("Cash");
  const [tipAmount, setTipAmount] = useState("0");
  const [tipPayment, setTipPayment] = useState("Cash");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositPayment, setDepositPayment] = useState("Credit Card");
  const [merchAmount, setMerchAmount] = useState("");
  const [merchPayment, setMerchPayment] = useState("Cash");
  const [memo, setMemo] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const artistAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.artist === artist),
    [artist],
  );

  const selectedAppointment =
    artistAppointments.find((appointment) => appointment.id === selectedAppointmentId) ??
    artistAppointments[0] ??
    appointments[0];

  function selectArtist(nextArtist: string) {
    const nextAppointment = appointments.find((appointment) => appointment.artist === nextArtist);
    setArtist(nextArtist);
    setSelectedAppointmentId(nextAppointment?.id ?? "");
  }

  function submitEntry() {
    setReceipt({
      artist,
      client: selectedAppointment.client,
      project: selectedAppointment.project,
      kind: entryKind,
      tattooAmount: Number(tattooAmount || 0),
      tattooPayment,
      tipAmount: Number(tipAmount || 0),
      tipPayment,
      depositAmount: Number(depositAmount || 0),
      depositPayment,
      merchAmount: Number(merchAmount || 0),
      merchPayment,
      memo,
    });
  }

  return (
    <AppShell
      active="Artist Entry"
      eyebrow="Artist workflow"
      title="Session and deposit entry"
      description="Artists enter individual customer amounts here. Shop-wide revenue and payout reporting stays in the separate accounting app."
      actions={
        <button
          className="h-10 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
          type="button"
        >
          Today only
        </button>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr_0.9fr]">
        <aside className="space-y-6">
          <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
            <h3 className="text-base font-semibold">Artist</h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {artists.map((name) => (
                <button
                  key={name}
                  className={`h-10 rounded-md border px-3 text-sm font-semibold transition ${
                    name === artist
                      ? "border-[#1f2428] bg-[#1f2428] text-white"
                      : "border-[#cfc7b8] text-[#30373d] hover:bg-[#eee8dd]"
                  }`}
                  onClick={() => selectArtist(name)}
                  type="button"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Appointments</h3>
              <p className="mt-1 text-sm text-[#697178]">Only this artist&apos;s bookings.</p>
            </div>
            <div className="divide-y divide-[#eee8dd]">
              {artistAppointments.map((appointment) => (
                <button
                  key={appointment.id}
                  className={`block w-full px-4 py-4 text-left transition hover:bg-[#f7f2e9] ${
                    appointment.id === selectedAppointment.id ? "bg-[#fffaf1]" : ""
                  }`}
                  onClick={() => setSelectedAppointmentId(appointment.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{appointment.client}</p>
                      <p className="mt-1 text-sm text-[#697178]">{appointment.project}</p>
                    </div>
                    <span className="rounded-md bg-[#f1eadc] px-2 py-1 text-xs font-semibold text-[#775f36]">
                      {appointment.time}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#4d555c]">{appointment.type}</p>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="border-b border-[#e5dfd4] px-4 py-4">
            <p className="text-xs font-semibold text-[#8a6f4d]">{selectedAppointment.id}</p>
            <h3 className="mt-1 text-xl font-semibold">{selectedAppointment.client}</h3>
            <p className="mt-1 text-sm text-[#697178]">
              {selectedAppointment.project} / {selectedAppointment.type}
            </p>
          </div>

          <div className="space-y-5 px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-[#f7f2e9] px-3 py-3 text-sm">
                <p className="text-[#697178]">Deposit</p>
                <p className="mt-1 font-semibold">{selectedAppointment.deposit}</p>
              </div>
              <div className="rounded-md bg-[#f7f2e9] px-3 py-3 text-sm">
                <p className="text-[#697178]">Waiver</p>
                <p className="mt-1 font-semibold">{selectedAppointment.waiver}</p>
              </div>
              <div className="rounded-md bg-[#f7f2e9] px-3 py-3 text-sm">
                <p className="text-[#697178]">Time</p>
                <p className="mt-1 font-semibold">{selectedAppointment.time}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold">Entry type</h4>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["Session", "Deposit", "Merch"] as EntryKind[]).map((kind) => (
                  <button
                    key={kind}
                    className={`h-10 rounded-md border px-3 text-sm font-semibold ${
                      entryKind === kind
                        ? "border-[#1f2428] bg-[#1f2428] text-white"
                        : "border-[#cfc7b8] text-[#30373d] hover:bg-[#eee8dd]"
                    }`}
                    onClick={() => setEntryKind(kind)}
                    type="button"
                  >
                    {kind}
                  </button>
                ))}
              </div>
            </div>

            {entryKind === "Session" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Tattoo amount
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setTattooAmount(event.target.value)}
                    type="number"
                    value={tattooAmount}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Tattoo payment
                  <select
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setTattooPayment(event.target.value)}
                    value={tattooPayment}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Tip amount
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setTipAmount(event.target.value)}
                    type="number"
                    value={tipAmount}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Tip payment
                  <select
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setTipPayment(event.target.value)}
                    value={tipPayment}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {entryKind === "Deposit" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Deposit amount
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setDepositAmount(event.target.value)}
                    type="number"
                    value={depositAmount}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Deposit payment
                  <select
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setDepositPayment(event.target.value)}
                    value={depositPayment}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {entryKind === "Merch" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Merch amount
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setMerchAmount(event.target.value)}
                    type="number"
                    value={merchAmount}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Merch payment
                  <select
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setMerchPayment(event.target.value)}
                    value={merchPayment}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <label className="block text-sm font-semibold">
              Memo
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
                onChange={(event) => setMemo(event.target.value)}
                placeholder="Session notes, deposit memo, or payment detail"
                value={memo}
              />
            </label>

            <button
              className="h-11 w-full rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
              onClick={submitEntry}
              type="button"
            >
              Submit entry
            </button>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Confirmation</h3>
              <p className="mt-1 text-sm text-[#697178]">
                Entries will sync to the shared DB for the accounting app.
              </p>
            </div>

            {receipt ? (
              <div className="space-y-3 px-4 py-4 text-sm">
                <div className="rounded-md bg-[#1f2428] px-4 py-4 text-white">
                  <p className="text-xs font-semibold uppercase text-white/70">Receipt</p>
                  <p className="mt-2 text-lg font-semibold">{receipt.client}</p>
                  <p className="mt-1 text-white/75">{receipt.project}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                    <p className="text-[#697178]">Artist</p>
                    <p className="mt-1 font-semibold">{receipt.artist}</p>
                  </div>
                  <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                    <p className="text-[#697178]">Type</p>
                    <p className="mt-1 font-semibold">{receipt.kind}</p>
                  </div>
                </div>
                {receipt.kind === "Session" ? (
                  <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                    <p className="font-semibold">
                      Tattoo {money(receipt.tattooAmount)} / {receipt.tattooPayment}
                    </p>
                    <p className="mt-1 font-semibold">
                      Tip {money(receipt.tipAmount)} / {receipt.tipPayment}
                    </p>
                  </div>
                ) : null}
                {receipt.kind === "Deposit" ? (
                  <div className="rounded-md bg-[#f7f2e9] px-3 py-3 font-semibold">
                    Deposit {money(receipt.depositAmount)} / {receipt.depositPayment}
                  </div>
                ) : null}
                {receipt.kind === "Merch" ? (
                  <div className="rounded-md bg-[#f7f2e9] px-3 py-3 font-semibold">
                    Merch {money(receipt.merchAmount)} / {receipt.merchPayment}
                  </div>
                ) : null}
                <p className="rounded-md bg-[#f7f2e9] px-3 py-3 text-[#4d555c]">
                  {receipt.memo || "No memo"}
                </p>
              </div>
            ) : (
              <div className="px-4 py-8 text-sm text-[#697178]">
                Submit an entry to show the confirmation here.
              </div>
            )}
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
            <h3 className="text-base font-semibold">Privacy guard</h3>
            <p className="mt-3 text-sm text-[#4d555c]">
              This screen records individual customer entries only. It does not show total shop
              revenue, other artists&apos; totals, or payout reports.
            </p>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}
