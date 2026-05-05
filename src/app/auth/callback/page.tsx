"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function hashParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    async function finishAuth() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errorDescription =
        url.searchParams.get("error_description") ?? hashParams().get("error_description");

      if (errorDescription) {
        setError(errorDescription);
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }

        router.replace("/set-password");
        return;
      }

      const accessToken = hashParams().get("access_token");
      const refreshToken = hashParams().get("refresh_token");

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        router.replace("/set-password");
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (data.session) {
        router.replace("/set-password");
        return;
      }

      setError("This invitation link is expired or invalid. Ask an admin to send a new invite.");
    }

    finishAuth();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] px-4 py-10 text-[#1f2428]">
      <section className="w-full max-w-md rounded-md border border-[#d9d3c7] bg-white px-6 py-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6f4d]">
          Oyabun
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Accepting invite</h1>
        {error ? (
          <p className="mt-4 rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
            {error}
          </p>
        ) : (
          <p className="mt-3 text-sm font-semibold text-[#697178]">
            Preparing your account...
          </p>
        )}
      </section>
    </main>
  );
}
