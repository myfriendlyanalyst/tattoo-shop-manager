"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
          <h1 className="mt-2 text-2xl font-semibold">Log in</h1>
          <p className="mt-1 text-sm text-[#697178]">
            Use a Supabase Auth user for the operations app.
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
            Back to dashboard
          </Link>
        </form>
      </section>
    </main>
  );
}
