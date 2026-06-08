"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSafeSession } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

const rememberedEmailPrefix = "oyabun-login-email";

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

function rememberedEmailKey(isAccountingLogin: boolean) {
  return `${rememberedEmailPrefix}:${isAccountingLogin ? "accounting" : "manager"}`;
}

function currentLoginIsAccounting() {
  return nextPath().startsWith("/accounting") || isAccountingHost();
}

function initialRememberedEmail() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(rememberedEmailKey(currentLoginIsAccounting())) ?? "";
}

export default function LoginPage() {
  const [email, setEmail] = useState(() => initialRememberedEmail());
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
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

  useEffect(() => {
    let mounted = true;

    getSafeSession()
      .then((session) => {
        if (!mounted) {
          return;
        }

        if (session) {
          window.location.assign(destination);
          return;
        }

        setCheckingSession(false);
      })
      .catch(() => {
        if (mounted) {
          setCheckingSession(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [destination, isAccountingLogin]);

  function syncRememberedEmail(nextEmail: string) {
    if (typeof window === "undefined") {
      return;
    }

    if (rememberEmail) {
      window.localStorage.setItem(rememberedEmailKey(isAccountingLogin), nextEmail);
      return;
    }

    window.localStorage.removeItem(rememberedEmailKey(isAccountingLogin));
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
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

    syncRememberedEmail(email.trim());
    window.location.assign(destination);
  }

  async function sendPasswordReset() {
    const resetEmail = email.trim();

    setError("");
    setMessage("");

    if (!resetEmail) {
      setError("Enter your email first, then use forgot password.");
      return;
    }

    setResetting(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=/set-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo,
    });
    setResetting(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    if (rememberEmail) {
      syncRememberedEmail(resetEmail);
    }

    setMessage("Password reset email sent. Check your inbox.");
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
          {checkingSession ? (
            <p className="rounded-md bg-[#f7f2e9] px-3 py-2 text-sm font-semibold text-[#697178]">
              Checking login...
            </p>
          ) : null}

          <label className="block text-sm font-semibold">
            Email
            <input
              autoComplete="email"
              className={`mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm ${theme.input}`}
              disabled={checkingSession || loading || resetting}
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
              disabled={checkingSession || loading || resetting}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-[#4d555c]">
              <input
                checked={rememberEmail}
                className="h-4 w-4 accent-current"
                disabled={checkingSession || loading || resetting}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setRememberEmail(checked);

                  if (!checked && typeof window !== "undefined") {
                    window.localStorage.removeItem(rememberedEmailKey(isAccountingLogin));
                  }
                }}
                type="checkbox"
              />
              Remember email
            </label>
            <button
              className={`text-sm font-semibold ${theme.link} disabled:cursor-not-allowed disabled:opacity-60`}
              disabled={checkingSession || loading || resetting}
              onClick={sendPasswordReset}
              type="button"
            >
              {resetting ? "Sending..." : "Forgot password?"}
            </button>
          </div>

          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}

          {message ? (
            <p className="rounded-md bg-[#eef7ed] px-3 py-2 text-sm font-semibold text-[#356237]">
              {message}
            </p>
          ) : null}

          <button
            className={`h-11 w-full rounded-md px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${theme.button}`}
            disabled={checkingSession || loading || resetting}
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
