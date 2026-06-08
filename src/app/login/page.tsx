"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

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

function isAccountingHost() {
  return typeof window !== "undefined" && window.location.hostname === "accounting.oyabuntattoo.com";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const destination = nextPath();
  const isAccountingLogin = destination.startsWith("/accounting") || isAccountingHost();
  const theme = isAccountingLogin
    ? {
        page: "bg-[#eef5fb] text-[#142433]",
        card: "border-[#bfd4e8]",
        header: "border-[#cbdceb] bg-[#f8fbfe]",
        eyebrow: "text-[#316997]",
        input: "border-[#b9cfe2] focus:border-[#316997] focus:outline-none focus:ring-2 focus:ring-[#d6e7f6]",
        button: "bg-[#23648f] hover:bg-[#1b5276]",
        link: "text-[#316997] hover:text-[#1b5276]",
      }
    : {
        page: "bg-[#f6f4ef] text-[#1f2428]",
        card: "border-[#d9d3c7]",
        header: "border-[#e5dfd4]",
        eyebrow: "text-[#8a6f4d]",
        input: "border-[#cfc7b8]",
        button: "bg-[#9f5c3c] hover:bg-[#884a2f]",
        link: "text-[#7d684d] hover:text-[#9f5c3c]",
      };

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

    if (!data.user) {
      setLoading(false);
      setError("Could not verify login session.");
      return;
    }

    window.location.assign(destination);
  }

  return (
    <main className={`flex min-h-screen items-center justify-center px-4 py-10 ${theme.page}`}>
      <section className={`w-full max-w-md rounded-md border bg-white shadow-sm ${theme.card}`}>
        <div className={`border-b px-6 py-5 ${theme.header}`}>
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme.eyebrow}`}>
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
              className={`mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm ${theme.input}`}
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
              className={`mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm ${theme.input}`}
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
            className={`h-11 w-full rounded-md px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${theme.button}`}
            disabled={loading}
            type="submit"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          <Link
            className={`block text-center text-sm font-semibold ${theme.link}`}
            href="/"
          >
            Back
          </Link>
        </form>
      </section>
    </main>
  );
}
