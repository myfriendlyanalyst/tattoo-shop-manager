"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppPage } from "@/components/app-shell";
import { RichTextEditor, textToHtml } from "@/components/rich-text-editor";
import { getSafeSession } from "@/lib/auth-session";
import {
  defaultOperationsEmailTemplates,
  templateVariables,
  type OperationsEmailTemplate,
  type OperationsEmailTemplateKey,
} from "@/lib/email-templates/custom-email-templates";

type TemplatePayload = {
  templates?: OperationsEmailTemplate[];
  template?: OperationsEmailTemplate;
  error?: string;
};

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<OperationsEmailTemplate[]>(defaultOperationsEmailTemplates);
  const [selectedKey, setSelectedKey] =
    useState<OperationsEmailTemplateKey>("request_auto_reply");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [testMode, setTestMode] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.key === selectedKey) ?? templates[0],
    [selectedKey, templates],
  );

  useEffect(() => {
    async function loadTemplates() {
      const session = await getSafeSession();
      if (!session) {
        setError("Please log in to edit email templates.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/settings/email-templates", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = (await response.json().catch(() => ({}))) as TemplatePayload;

      if (!response.ok) {
        setError(payload.error ?? "Email templates could not be loaded.");
        setLoading(false);
        return;
      }

      const nextTemplates = payload.templates ?? defaultOperationsEmailTemplates;
      setTemplates(nextTemplates);
      const first = nextTemplates.find((template) => template.key === selectedKey) ?? nextTemplates[0];
      setSubject(first.subject);
      setHtml(first.html.includes("<") ? first.html : textToHtml(first.html));
      setEnabled(first.enabled);
      setTestMode(first.testMode);
      setLoading(false);
    }

    loadTemplates();
  }, [selectedKey]);

  function selectTemplate(key: OperationsEmailTemplateKey) {
    const template = templates.find((item) => item.key === key);
    if (!template) return;

    setSelectedKey(key);
    setSubject(template.subject);
    setHtml(template.html.includes("<") ? template.html : textToHtml(template.html));
    setEnabled(template.enabled);
    setTestMode(template.testMode);
    setMessage("");
    setError("");
  }

  async function saveTemplate() {
    setSaving(true);
    setMessage("");
    setError("");

    const session = await getSafeSession();
    if (!session) {
      setError("Please log in to save email templates.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/settings/email-templates", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled, html, key: selectedKey, subject, testMode }),
    });
    const payload = (await response.json().catch(() => ({}))) as TemplatePayload;

    if (!response.ok || !payload.template) {
      setError(payload.error ?? "Email template could not be saved.");
      setSaving(false);
      return;
    }

    setTemplates((current) =>
      current.map((template) =>
        template.key === payload.template!.key ? payload.template! : template,
      ),
    );
    setMessage("Email template saved.");
    setSaving(false);
  }

  async function sendTestEmail() {
    setSendingTest(true);
    setMessage("");
    setError("");

    const session = await getSafeSession();
    if (!session) {
      setError("Please log in to send a test email.");
      setSendingTest(false);
      return;
    }

    const response = await fetch("/api/settings/email-templates", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ html, key: selectedKey, subject, testEmail }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Test email could not be sent.");
      setSendingTest(false);
      return;
    }

    setMessage("Test email sent.");
    setSendingTest(false);
  }

  return (
    <AppPage
      eyebrow="Settings"
      title="Email templates"
      description="Manage customer-facing email templates for requests, bookings, changes, cancellations, and reminders."
      wide
    >
      <div className="mb-6">
        <Link className="text-sm font-semibold text-[#8a6f4d] hover:underline" href="/settings">
          Back to settings
        </Link>
      </div>

      {message ? (
        <p className="mb-6 rounded-md bg-[#e4f1df] px-4 py-3 text-sm font-semibold text-[#476b33]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-6 rounded-md bg-[#f3e1e1] px-4 py-3 text-sm font-semibold text-[#8a3030]">
          {error}
        </p>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <aside className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="border-b border-[#e5dfd4] px-4 py-4">
            <h3 className="font-semibold">Templates</h3>
          </div>
          <div className="space-y-1 p-2">
            {templates.map((template) => (
              <button
                className={`w-full rounded-md px-3 py-3 text-left text-sm transition ${
                  template.key === selectedKey
                    ? "bg-[#1f2428] text-white"
                    : "text-[#4d555c] hover:bg-[#f7f2e9]"
                }`}
                key={template.key}
                onClick={() => selectTemplate(template.key)}
                type="button"
              >
                <span className="block font-bold">{template.name}</span>
                <span className={template.key === selectedKey ? "text-white/70" : "text-[#697178]"}>
                  {template.enabled ? "Enabled" : "Disabled"}
                  {template.testMode ? " / Test mode" : ""}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="border-b border-[#e5dfd4] px-4 py-4">
            <h3 className="text-base font-semibold">{selectedTemplate?.name ?? "Template"}</h3>
            <p className="mt-1 text-sm text-[#697178]">{selectedTemplate?.description}</p>
          </div>
          <div className="space-y-5 px-4 py-4">
            {loading ? (
              <p className="text-sm font-semibold text-[#697178]">Loading templates...</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold sm:col-span-2">
                    Subject
                    <input
                      className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                      onChange={(event) => setSubject(event.target.value)}
                      value={subject}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm">
                    <span className="font-semibold">Enabled</span>
                    <input
                      checked={enabled}
                      onChange={(event) => setEnabled(event.target.checked)}
                      type="checkbox"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm">
                    <span className="font-semibold">Test mode</span>
                    <input
                      checked={testMode}
                      onChange={(event) => setTestMode(event.target.checked)}
                      type="checkbox"
                    />
                  </label>
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap gap-2 text-xs text-[#697178]">
                    {templateVariables.map((variable) => (
                      <code
                        className="rounded bg-[#f7f2e9] px-2 py-1 font-semibold text-[#4d555c]"
                        key={variable}
                      >
                        {`{{${variable}}}`}
                      </code>
                    ))}
                  </div>
                  <RichTextEditor disabled={saving} html={html} onChange={(nextHtml) => setHtml(nextHtml)} />
                </div>

                <div className="grid gap-3 border-t border-[#e5dfd4] pt-4 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setTestEmail(event.target.value)}
                    placeholder="test@example.com"
                    type="email"
                    value={testEmail}
                  />
                  <button
                    className="h-10 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold hover:bg-[#f7f2e9] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={sendingTest || !testEmail}
                    onClick={sendTestEmail}
                    type="button"
                  >
                    {sendingTest ? "Sending..." : "Send test email"}
                  </button>
                  <button
                    className="h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={saving}
                    onClick={saveTemplate}
                    type="button"
                  >
                    {saving ? "Saving..." : "Save template"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </section>
    </AppPage>
  );
}

