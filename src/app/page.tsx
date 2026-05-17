"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getSafeSession } from "@/lib/auth-session";

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

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const destination = nextPath();
  const isAccountingLogin = destination.startsWith("/accounting");

  useEffect(() => {
    let mounted = true;

    getSafeSession().then((session) => {
      if (!mounted) {
        return;
      }

      if (session) {
        router.replace(nextPath());
        return;
      }

      setChecking(false);
    }).catch((sessionError) => {
      if (mounted) {
        setError(sessionError instanceof Error ? sessionError.message : "Could not check login.");
        setChecking(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace(destination);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] px-4 py-10 text-[#1f2428]">
      <section className="w-full max-w-md rounded-md border border-[#d9d3c7] bg-white shadow-sm">
        <div className="border-b border-[#e5dfd4] px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6f4d]">
            {isAccountingLogin ? "Oyabun Accounting" : "Oyabun"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            {isAccountingLogin ? "Accounting Login" : "Tattoo Manager"}
          </h1>
          <p className="mt-1 text-sm text-[#697178]">
            {isAccountingLogin
              ? "Use your accounting account to access accounting."
              : "Use your staff account to access the operations app."}
          </p>
        </div>

        <form className="space-y-4 px-6 py-6" onSubmit={handleLogin}>
          {checking ? (
            <p className="rounded-md bg-[#f7f2e9] px-3 py-2 text-sm font-semibold text-[#697178]">
              Checking login...
            </p>
          ) : null}

          <label className="block text-sm font-semibold">
            Email
            <input
              autoComplete="email"
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              disabled={checking || loading}
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
              disabled={checking || loading}
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
            disabled={checking || loading}
            type="submit"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
      </section>
    </main>
  );
}
