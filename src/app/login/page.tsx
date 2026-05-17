"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hasAccountingAccess } from "@/lib/accounting-access";

function nextPath() {
  if (typeof window === "undefined") {
    return "/requests";
  }

  const next = new URLSearchParams(window.location.search).get("next");
  if (next?.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  return "/requests";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const destination = nextPath();
  const isAccountingLogin = destination.startsWith("/accounting");

  const resolveDestination = useCallback(async (userId: string) => {
    if (destination !== "/requests") {
      return destination;
    }

    const accountingAccess = await hasAccountingAccess(userId);
    return accountingAccess ? "/accounting/dashboard" : destination;
  }, [destination]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    const user = data.user ?? (await supabase.auth.getUser()).data.user;
    if (!user) {
      setLoading(false);
      setError("Could not verify login session.");
      return;
    }

    const resolvedDestination = await resolveDestination(user.id);
    window.location.assign(resolvedDestination);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] px-4 py-10 text-[#1f2428]">
      <section className="w-full max-w-md rounded-md border border-[#d9d3c7] bg-white shadow-sm">
        <div className="border-b border-[#e5dfd4] px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6f4d]">
            {isAccountingLogin ? "Oyabun Accounting" : "Oyabun"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            {isAccountingLogin ? "Accounting Login" : "Log in"}
          </h1>
          <p className="mt-1 text-sm text-[#697178]">
            {isAccountingLogin
              ? "Use your accounting account to access accounting."
              : "Use a Supabase Auth user for the operations app."}
          </p>
        </div>

        <form className="space-y-4 px-6 py-6" onSubmit={handleLogin}>
          <label className="block text-sm font-semibold">
            Email
            <input
              autoComplete="email"
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block text-sm font-semibold">
            Password
            <input
              autoComplete="current-password"
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}

          <button
            className="h-11 w-full rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          <Link
            className="block text-center text-sm font-semibold text-[#7d684d] hover:text-[#9f5c3c]"
            href="/"
          >
            Back
          </Link>
        </form>
      </section>
    </main>
  );
}
