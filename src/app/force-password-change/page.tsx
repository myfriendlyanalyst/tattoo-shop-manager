"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getSafeSession } from "@/lib/auth-session";

export default function ForcePasswordChangePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSafeSession().then((session) => {
      setHasSession(Boolean(session));
      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);

    const session = await getSafeSession();
    const token = session?.access_token;

    if (!token) {
      setError("Session expired. Please log in again.");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/accounting/change-password", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ newPassword: password }),
    });

    const data = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);

    if (!res.ok || !data.ok) {
      setError(data.error ?? "Failed to change password.");
      return;
    }

    // Navigate to accounting dashboard now that must_change_password is cleared.
    router.replace("/accounting/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] px-4 py-10 text-[#1f2428]">
      <section className="w-full max-w-md rounded-md border border-[#d9d3c7] bg-white shadow-sm">
        <div className="border-b border-[#e5dfd4] px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#236c8f]">
            Oyabun Accounting
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Set your password</h1>
          <p className="mt-1 text-sm text-[#697178]">
            Your account was created with a temporary password. Set a permanent password to
            continue.
          </p>
        </div>

        <form className="space-y-4 px-6 py-6" onSubmit={handleSubmit}>
          {checking ? (
            <p className="rounded-md bg-[#f7f2e9] px-3 py-2 text-sm font-semibold text-[#697178]">
              Checking session...
            </p>
          ) : null}

          {!checking && !hasSession ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              Session not found. Please log in first.
            </p>
          ) : null}

          <label className="block text-sm font-semibold">
            New password
            <input
              autoComplete="new-password"
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              disabled={!hasSession || saving}
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <label className="block text-sm font-semibold">
            Confirm password
            <input
              autoComplete="new-password"
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              disabled={!hasSession || saving}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>

          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}

          <button
            className="h-11 w-full rounded-md bg-[#236c8f] px-4 text-sm font-semibold text-white hover:bg-[#1a5470] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!hasSession || saving}
            type="submit"
          >
            {saving ? "Saving..." : "Set password"}
          </button>
        </form>
      </section>
    </main>
  );
}
