"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getSafeUser } from "@/lib/auth-session";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    getSafeUser().then((currentUser) => {
      if (mounted) {
        setUser(currentUser);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) {
        setUser(null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <span className="rounded-md bg-[#eee8dd] px-2 py-1 text-xs font-semibold text-[#697178]">
        Checking login
      </span>
    );
  }

  if (!user) {
    return (
      <Link
        className="rounded-md bg-[#1f2428] px-3 py-2 text-sm font-semibold text-white hover:bg-[#30373d]"
        href="/login"
      >
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[220px] truncate text-sm font-medium text-[#4d555c] sm:inline">
        {user.email}
      </span>
      <button
        className="rounded-md border border-[#cfc7b8] px-3 py-2 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
        onClick={signOut}
        type="button"
      >
        Log out
      </button>
    </div>
  );
}
