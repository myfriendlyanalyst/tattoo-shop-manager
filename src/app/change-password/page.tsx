"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSafeUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

export default function ChangePasswordPage() {
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getSafeUser()
      .then((user) => {
        setEmail(user?.email ?? "");
        setChecking(false);
      })
      .catch(() => {
        setEmail("");
        setChecking(false);
      });
  }, []);

  async function savePassword() {
    setError("");
    setMessage("");

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

    setPassword("");
    setConfirmPassword("");
    setMessage("Password changed.");
  }

  return (
    <main className="min-h-screen bg-[#f7f2e9] px-4 py-10 text-[#1f2428]">
      <section className="mx-auto w-full max-w-md rounded-md border border-[#d9d3c7] bg-white shadow-sm">
        <div className="border-b border-[#e5dfd4] px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6f4d]">
            Account
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Change password</h1>
          <p className="mt-2 text-sm text-[#697178]">
            {checking ? "Checking login..." : email || "Please log in first."}
          </p>
        </div>

        <div className="space-y-4 px-5 py-5">
          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-md bg-[#e4f1df] px-3 py-2 text-sm font-semibold text-[#476b33]">
              {message}
            </p>
          ) : null}

          {!checking && !email ? (
            <Link
              className="inline-flex h-10 items-center rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d]"
              href="/login"
            >
              Log in
            </Link>
          ) : (
            <>
              <label className="block text-sm font-semibold">
                New password
                <input
                  autoComplete="new-password"
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </label>
              <label className="block text-sm font-semibold">
                Confirm password
                <input
                  autoComplete="new-password"
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  value={confirmPassword}
                />
              </label>
              <button
                className="h-10 w-full rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving || checking}
                onClick={savePassword}
                type="button"
              >
                {saving ? "Saving..." : "Save password"}
              </button>
              <Link
                className="block text-center text-sm font-semibold text-[#6f4d32] hover:underline"
                href="/requests"
              >
                Back to app
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
