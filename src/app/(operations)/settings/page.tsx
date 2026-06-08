"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppPage } from "@/components/app-shell";
import { RichTextEditor, textToHtml } from "@/components/rich-text-editor";
import { getSafeSession } from "@/lib/auth-session";
import { getOperationsContext, type OperationsContext } from "@/lib/operations-access";
import {
  readTimeInterval,
  saveTimeInterval,
  timeIntervalOptions,
  type TimeInterval,
} from "@/lib/time-settings";

const paymentMethods = [
  { name: "Cash", enabled: true },
  { name: "Credit Card", enabled: true },
  { name: "Venmo / Zelle / Cash App", enabled: true },
  { name: "Other", enabled: false },
];

const integrationStatus = [
  { label: "Supabase", value: "Not connected", tone: "warning" },
  { label: "Website request form", value: "Email import planned", tone: "neutral" },
  { label: "Accounting app", value: "Separate app planned", tone: "neutral" },
  { label: "File storage", value: "Pending Supabase storage", tone: "warning" },
];

function statusClasses(tone: string) {
  if (tone === "warning") {
    return "bg-[#f4e7df] text-[#8a5130]";
  }

  return "bg-[#e5edf4] text-[#315f82]";
}

export default function SettingsPage() {
  const [timeInterval, setTimeInterval] = useState<TimeInterval>(readTimeInterval);
  const [context, setContext] = useState<OperationsContext | null>(null);
  const [artistTemplateHtml, setArtistTemplateHtml] = useState("");
  const [loadingArtistSettings, setLoadingArtistSettings] = useState(true);
  const [savingArtistSettings, setSavingArtistSettings] = useState(false);
  const [artistSettingsError, setArtistSettingsError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadArtistSettings() {
      const nextContext = await getOperationsContext();
      setContext(nextContext);

      if (!nextContext?.staffId || (!nextContext.isArtist && nextContext.staffRole !== "Owner")) {
        setLoadingArtistSettings(false);
        return;
      }

      const session = await getSafeSession();
      if (!session) {
        setArtistSettingsError("Please log in to edit artist settings.");
        setLoadingArtistSettings(false);
        return;
      }

      const response = await fetch("/api/artist/settings", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        staff?: { artistAcceptTemplate?: string };
        error?: string;
      };

      if (!response.ok) {
        setArtistSettingsError(payload.error ?? "Artist settings could not be loaded.");
        setLoadingArtistSettings(false);
        return;
      }

      const template = payload.staff?.artistAcceptTemplate ?? "";
      setArtistTemplateHtml(template.includes("<") ? template : textToHtml(template));
      setLoadingArtistSettings(false);
    }

    loadArtistSettings();
  }, []);

  function saveSettings() {
    saveTimeInterval(timeInterval);
    setMessage("Settings saved.");
  }

  async function saveArtistSettings() {
    setSavingArtistSettings(true);
    setArtistSettingsError("");
    setMessage("");

    const session = await getSafeSession();
    if (!session) {
      setArtistSettingsError("Please log in to save artist settings.");
      setSavingArtistSettings(false);
      return;
    }

    const response = await fetch("/api/artist/settings", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ artistAcceptTemplate: artistTemplateHtml }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setArtistSettingsError(payload.error ?? "Artist settings could not be saved.");
      setSavingArtistSettings(false);
      return;
    }

    setMessage("Artist email template saved.");
    setSavingArtistSettings(false);
  }

  const artistOnlySettings = context?.isArtist === true;

  if (loadingArtistSettings && context === null) {
    return (
      <AppPage eyebrow="System setup" title="Settings">
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading settings...
        </div>
      </AppPage>
    );
  }

  if (artistOnlySettings) {
    return (
      <AppPage
        eyebrow="Artist setup"
        title="Settings"
        description="Manage the default message used when you accept a request and draft the first client email."
      >
        {message ? (
          <p className="mb-6 rounded-md bg-[#e4f1df] px-4 py-3 text-sm font-semibold text-[#476b33]">
            {message}
          </p>
        ) : null}
        {artistSettingsError ? (
          <p className="mb-6 rounded-md bg-[#f3e1e1] px-4 py-3 text-sm font-semibold text-[#8a3030]">
            {artistSettingsError}
          </p>
        ) : null}

        <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="border-b border-[#e5dfd4] px-4 py-4">
            <h3 className="text-base font-semibold">Client email default</h3>
            <p className="mt-1 text-sm text-[#697178]">
              This content is inserted into the editable email draft after you accept a request.
            </p>
          </div>
          <div className="px-4 py-4">
            {loadingArtistSettings ? (
              <p className="text-sm font-semibold text-[#697178]">Loading artist settings...</p>
            ) : (
              <>
                <RichTextEditor
                  disabled={savingArtistSettings}
                  html={artistTemplateHtml}
                  onChange={(html) => setArtistTemplateHtml(html)}
                />
                <div className="mt-4 flex justify-end">
                  <button
                    className="h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={savingArtistSettings || loadingArtistSettings}
                    onClick={saveArtistSettings}
                    type="button"
                  >
                    {savingArtistSettings ? "Saving..." : "Save template"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </AppPage>
    );
  }

  return (
    <AppPage
      eyebrow="System setup"
      title="Settings"
      description="Operational defaults for the tattoo shop manager. These values will later move into Supabase-backed settings."
      actions={
        <button
          className="h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
          onClick={saveSettings}
          type="button"
        >
          Save settings
        </button>
      }
    >
      {message ? (
        <p className="mb-6 rounded-md bg-[#e4f1df] px-4 py-3 text-sm font-semibold text-[#476b33]">
          {message}
        </p>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Shop profile</h3>
              <p className="mt-1 text-sm text-[#697178]">Displayed in internal records and receipts.</p>
            </div>
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Shop name
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="Oyabun Tattoo"
                />
              </label>
              <label className="text-sm font-semibold">
                Phone
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="213-555-0100"
                />
              </label>
              <label className="text-sm font-semibold">
                Email
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="hello@oyabun.local"
                />
              </label>
              <label className="text-sm font-semibold">
                Timezone
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="America/Los_Angeles"
                >
                  <option>America/Los_Angeles</option>
                  <option>America/New_York</option>
                  <option>Asia/Seoul</option>
                </select>
              </label>
              <label className="sm:col-span-2 text-sm font-semibold">
                Address
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="Los Angeles, CA"
                />
              </label>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Request intake</h3>
              <p className="mt-1 text-sm text-[#697178]">
                Requests are the normal start of the workflow.
              </p>
            </div>
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Request email
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="requests@oyabun.local"
                />
              </label>
              <label className="text-sm font-semibold">
                Default priority
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="Normal"
                >
                  <option>Low</option>
                  <option>Normal</option>
                  <option>High</option>
                </select>
              </label>
              <label className="flex items-center justify-between rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm sm:col-span-2">
                <span className="font-semibold">Auto-create customer when request is booked</span>
                <input defaultChecked type="checkbox" />
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Email operations</h3>
              <p className="mt-1 text-sm text-[#697178]">
                Review automated appointment emails and scheduled reminders.
              </p>
            </div>
            <div className="px-4 py-4">
              <div className="flex flex-wrap gap-2">
                <Link
                  className="inline-flex h-10 items-center rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d]"
                  href="/settings/email-log"
                >
                  Email log
                </Link>
                <Link
                  className="inline-flex h-10 items-center rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold hover:bg-[#f7f2e9]"
                  href="/settings/email-templates"
                >
                  Email templates
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Booking defaults</h3>
              <p className="mt-1 text-sm text-[#697178]">
                Used by Calendar when creating appointments.
              </p>
            </div>
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Booking interval
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) =>
                    setTimeInterval(Number(event.target.value) as TimeInterval)
                  }
                  value={timeInterval}
                >
                  {timeIntervalOptions.map((interval) => (
                    <option key={interval} value={interval}>
                      {interval} minutes
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Default appointment
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="1 hour"
                >
                  <option>30 minutes</option>
                  <option>1 hour</option>
                  <option>2 hours</option>
                  <option>4 hours</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Day view range
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="10 AM - 6 PM"
                >
                  <option>10 AM - 6 PM</option>
                  <option>9 AM - 7 PM</option>
                  <option>12 PM - 10 PM</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Payment methods</h3>
              <p className="mt-1 text-sm text-[#697178]">
                Available in Artist Entry. Totals remain in the accounting app.
              </p>
            </div>
            <div className="space-y-2 px-4 py-4">
              {paymentMethods.map((method) => (
                <label
                  key={method.name}
                  className="flex items-center justify-between rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm"
                >
                  <span className="font-semibold">{method.name}</span>
                  <input defaultChecked={method.enabled} type="checkbox" />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Data and integrations</h3>
              <p className="mt-1 text-sm text-[#697178]">Connection checklist for the next phase.</p>
            </div>
            <div className="space-y-2 px-4 py-4">
              {integrationStatus.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm"
                >
                  <span className="font-semibold">{item.label}</span>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClasses(
                      item.tone,
                    )}`}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </AppPage>
  );
}
