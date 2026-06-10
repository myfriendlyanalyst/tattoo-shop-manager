"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type ClientAction = "request_reassignment" | "close_request";

type ActionData = {
  artist: {
    email: string | null;
    name: string;
  } | null;
  expired: boolean;
  request: {
    clientName: string;
    code: string;
    email: string | null;
    status: string;
    subject: string;
  };
  usedAction: ClientAction | null;
  usedAt: string | null;
};

function actionCopy(action: ClientAction | null, artistName?: string | null) {
  if (action === "request_reassignment") {
    return {
      button: "Confirm artist change",
      eyebrow: "Artist preference",
      success: "Thanks. We will review your request and follow up with another artist option.",
      title: "Would you like a different artist?",
      warning:
        `This will return your request to the shop team${artistName ? ` instead of continuing with ${artistName}` : ""}.`,
    };
  }

  if (action === "close_request") {
    return {
      button: "Confirm I am no longer interested",
      eyebrow: "Request update",
      success: "Thanks. Your request has been closed and we will not follow up further.",
      title: "Are you no longer interested?",
      warning: "This tells Oyabun Tattoo that you are no longer moving forward with this request.",
    };
  }

  return {
    button: "Continue",
    eyebrow: "Request action",
    success: "Done.",
    title: "Choose a valid request action",
    warning: "This link is missing an action.",
  };
}

function RequestActionContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const rawAction = searchParams.get("action") ?? "";
  const action = (
    rawAction === "request_reassignment" || rawAction === "close_request" ? rawAction : null
  ) as ClientAction | null;

  const [data, setData] = useState<ActionData | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const copy = useMemo(() => actionCopy(action, data?.artist?.name), [action, data?.artist?.name]);
  const visibleError = !token ? "Missing request action token." : error;

  useEffect(() => {
    if (!token) {
      return;
    }

    async function load() {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/requests/client-action?token=${encodeURIComponent(token)}`);
      const payload = (await response.json().catch(() => ({}))) as ActionData & { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "This request action link could not be loaded.");
        setLoading(false);
        return;
      }

      setData(payload);
      setDone(Boolean(payload.usedAt));
      setLoading(false);
    }

    load();
  }, [token]);

  async function submit() {
    if (!action) {
      setError("This link is missing a valid action.");
      return;
    }

    setSaving(true);
    setError("");
    const response = await fetch("/api/requests/client-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "This request action could not be completed.");
      setSaving(false);
      return;
    }

    setDone(true);
    setSaving(false);
  }

  function cancelAction() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = "https://www.oyabuntattoo.com";
  }

  const disabled = loading || saving || done || Boolean(data?.expired) || !action;

  return (
    <main className="min-h-screen bg-[#f7f2e9] px-4 py-8 text-[#1f2428]">
      <section className="mx-auto max-w-2xl rounded-md border border-[#d9d3c7] bg-white shadow-sm">
        <div className="border-b border-[#e5dfd4] px-5 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8a6f4d]">
            {copy.eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-black">{done ? "Request updated" : copy.title}</h1>
          <p className="mt-2 text-sm text-[#697178]">
            {done ? copy.success : copy.warning}
          </p>
        </div>

        <div className="space-y-5 px-5 py-5">
          {loading ? <p className="text-sm font-semibold text-[#697178]">Loading...</p> : null}
          {visibleError ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {visibleError}
            </p>
          ) : null}
          {data?.expired ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              This request action link has expired. Please reply to the email if you need help.
            </p>
          ) : null}

          {data ? (
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
              <div className="rounded-md bg-[#f7f2e9] px-3 py-3 sm:col-span-2">
                <p className="text-[#697178]">Artist</p>
                <p className="mt-1 font-bold">{data.artist?.name ?? "-"}</p>
                <p className="mt-1">{data.artist?.email ?? "-"}</p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-[#e5dfd4] pt-4">
            <button
              className="inline-flex h-10 items-center rounded-md border border-[#cfc7b8] px-4 text-sm font-bold text-[#30373d] hover:bg-[#eee8dd]"
              onClick={cancelAction}
              type="button"
            >
              Cancel
            </button>
            {!done ? (
              <button
                className={`h-10 rounded-md px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  action === "close_request"
                    ? "bg-[#8a3030] hover:bg-[#753030]"
                    : "bg-[#1f2428] hover:bg-[#30373d]"
                }`}
                disabled={disabled}
                onClick={submit}
                type="button"
              >
                {saving ? "Saving..." : copy.button}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function RequestActionPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7f2e9] px-4 py-8 text-[#1f2428]">
          <section className="mx-auto max-w-2xl rounded-md border border-[#d9d3c7] bg-white px-5 py-5 shadow-sm">
            <p className="text-sm font-semibold text-[#697178]">Loading...</p>
          </section>
        </main>
      }
    >
      <RequestActionContent />
    </Suspense>
  );
}
