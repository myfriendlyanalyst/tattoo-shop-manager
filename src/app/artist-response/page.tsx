"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RichTextEditor } from "@/components/rich-text-editor";

type DraftData = {
  request: {
    code: string;
    clientName: string;
    email: string | null;
    phone: string | null;
    subject: string;
    description: string | null;
    placement: string | null;
    approximateSize: string | null;
    timing: string;
  };
  artist: {
    name: string;
    email: string | null;
  };
  draft: {
    subject: string;
    bodyText: string;
    bodyHtml: string;
  };
};

function ArtistResponseContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const intent = searchParams.get("intent") ?? "accept";
  const isPassIntent = intent === "pass";
  const [data, setData] = useState<DraftData | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    async function load() {
      setLoading(true);
      setError("");

      const response = await fetch(`/api/requests/artist-response?token=${encodeURIComponent(token)}`);
      const payload = (await response.json().catch(() => ({}))) as DraftData & { error?: string };

      if (!response.ok) {
        setError(payload.error || "Artist response link could not be loaded.");
        setLoading(false);
        return;
      }

      setData(payload);
      setSubject(payload.draft.subject);
      setBodyText(payload.draft.bodyText);
      setBodyHtml(payload.draft.bodyHtml);
      setLoading(false);
    }

    load();
  }, [token]);

  const visibleError = !token ? "Missing artist response token." : error;

  async function submit(action: "send" | "pass") {
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/requests/artist-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action, subject, bodyText, bodyHtml }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(payload.error || "Action failed.");
      setSaving(false);
      return;
    }

    setSent(action === "send");
    setMessage(action === "send" ? "Sent to client." : "Request passed back to the shop.");
    setSaving(false);
  }

  function cancelResponse() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.close();
  }

  return (
    <main className="min-h-screen bg-[#f7f2e9] px-4 py-8 text-[#1f2428]">
      <section className="mx-auto max-w-3xl rounded-md border border-[#d9d3c7] bg-white shadow-sm">
        <div className="border-b border-[#e5dfd4] px-5 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8a6f4d]">Artist response</p>
          <h1 className="mt-1 text-2xl font-black">
            {isPassIntent ? "Pass request back to shop" : "Draft client email"}
          </h1>
          <p className="mt-2 text-sm text-[#697178]">
            {isPassIntent
              ? "Confirm this only if you do not want to take the request. The client will not be emailed."
              : "Review and edit the message before it goes to the client."}
          </p>
        </div>

        <div className="space-y-5 px-5 py-5">
          {loading ? <p className="text-sm font-semibold text-[#697178]">Loading...</p> : null}
          {visibleError ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {visibleError}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-md bg-[#e4f1df] px-3 py-2 text-sm font-semibold text-[#476b33]">
              {message}
            </p>
          ) : null}

          {data ? (
            <>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                  <p className="text-[#697178]">Request</p>
                  <p className="mt-1 font-bold">{data.request.code}</p>
                  <p className="mt-1">{data.request.subject}</p>
                </div>
                <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                  <p className="text-[#697178]">Client</p>
                  <p className="mt-1 font-bold">{data.request.clientName}</p>
                  <p className="mt-1">{data.request.email || "-"}</p>
                </div>
                <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                  <p className="text-[#697178]">Placement / Size</p>
                  <p className="mt-1 font-bold">{data.request.placement || "-"}</p>
                  <p className="mt-1">{data.request.approximateSize ? `${data.request.approximateSize} inch` : "-"}</p>
                </div>
                <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                  <p className="text-[#697178]">Artist</p>
                  <p className="mt-1 font-bold">{data.artist.name}</p>
                  <p className="mt-1">{data.artist.email || "-"}</p>
                </div>
              </div>

              <label className="block text-sm font-semibold">
                Subject
                <input
                  className="mt-2 h-11 w-full rounded-md border border-[#cfc7b8] px-3 text-sm"
                  disabled={saving || Boolean(message)}
                  onChange={(event) => setSubject(event.target.value)}
                  value={subject}
                />
              </label>

              <div className="text-sm font-semibold">
                <p>Email body</p>
                <RichTextEditor
                  disabled={saving || Boolean(message)}
                  html={bodyHtml}
                  onChange={(html, text) => {
                    setBodyHtml(html);
                    setBodyText(text);
                  }}
                />
              </div>

              {isPassIntent ? (
                <p className="rounded-md bg-[#f7f2e9] px-3 py-2 text-sm font-semibold text-[#8a3030]">
                  Passing returns this request to the shop so another artist can be assigned.
                </p>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <p className="text-xs text-[#697178]">
                  The sent email uses Reply-To {data.artist.email || "the artist"} so the client can continue directly with the artist.
                </p>
                <button
                  className={`h-10 rounded-md border px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                    isPassIntent
                      ? "border-[#8a3030] text-[#8a3030] hover:bg-[#f3e1e1]"
                      : "border-[#cfc7b8] text-[#30373d] hover:bg-[#eee8dd]"
                  }`}
                  disabled={saving || Boolean(message)}
                  onClick={() => (isPassIntent ? submit("pass") : cancelResponse())}
                  type="button"
                >
                  {saving && isPassIntent ? "Passing..." : isPassIntent ? "Confirm pass" : "Cancel"}
                </button>
                {!isPassIntent ? (
                  <button
                    className={`h-10 rounded-md px-4 text-sm font-bold text-white disabled:cursor-not-allowed ${
                      sent
                        ? "bg-[#2f6658]"
                        : "bg-[#1f2428] hover:bg-[#30373d] disabled:opacity-60"
                    }`}
                    disabled={saving || Boolean(message)}
                    onClick={() => submit("send")}
                    type="button"
                  >
                    {sent ? "Sent" : saving ? "Sending..." : "Send to client"}
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function ArtistResponsePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7f2e9] px-4 py-8 text-[#1f2428]">
          <section className="mx-auto max-w-3xl rounded-md border border-[#d9d3c7] bg-white px-5 py-5 shadow-sm">
            <p className="text-sm font-semibold text-[#697178]">Loading...</p>
          </section>
        </main>
      }
    >
      <ArtistResponseContent />
    </Suspense>
  );
}
