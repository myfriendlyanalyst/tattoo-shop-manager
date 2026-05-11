"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getSafeSession } from "@/lib/auth-session";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    getSafeSession().then((session) => {
      if (mounted) {
        setSessionReady(Boolean(session));
        setChecking(false);
      }
    }).catch(() => {
      if (mounted) {
        setSessionReady(false);
        setChecking(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionReady(Boolean(session));
      setChecking(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
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
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] px-4 py-10 text-[#1f2428]">
      <section className="w-full max-w-md rounded-md border border-[#d9d3c7] bg-white shadow-sm">
        <div className="border-b border-[#e5dfd4] px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6f4d]">
            Oyabun
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Set password</h1>
          <p className="mt-1 text-sm text-[#697178]">
            Create a password to finish your staff invitation.
          </p>
        </div>

        <form className="space-y-4 px-6 py-6" onSubmit={savePassword}>
          {checking ? (
            <p className="rounded-md bg-[#f7f2e9] px-3 py-2 text-sm font-semibold text-[#697178]">
              Checking invitation link...
            </p>
          ) : null}

          {!checking && !sessionReady ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              This invitation link is expired or invalid. Ask an admin to send a new invite.
            </p>
          ) : null}

          <label className="block text-sm font-semibold">
            New password
            <input
              autoComplete="new-password"
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              disabled={!sessionReady || saving}
              onChange={(event) => setPassword(event.target.value)}
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
              disabled={!sessionReady || saving}
              onChange={(event) => setConfirmPassword(event.target.value)}
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
            className="h-11 w-full rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!sessionReady || saving}
            type="submit"
          >
            {saving ? "Saving..." : "Set password"}
          </button>

          <Link
            className="block text-center text-sm font-semibold text-[#7d684d] hover:text-[#9f5c3c]"
            href="/login"
          >
            Back to login
          </Link>
        </form>
      </section>
    </main>
  );
}
