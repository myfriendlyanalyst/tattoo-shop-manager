"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const navItems = [
  { label: "Dashboard", href: "/accounting/dashboard" },
  { label: "Transactions", href: "/accounting/transactions" },
  { label: "Artists", href: "/accounting/artists" },
  { label: "Deposits", href: "/accounting/deposits" },
  { label: "Payouts", href: "/accounting/payouts" },
  { label: "Settings", href: "/accounting/settings" },
];

type AccountingShellProps = {
  active: string;
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function AccountingShell({
  active,
  title,
  eyebrow,
  description,
  actions,
  children,
}: AccountingShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const nav = (
    <nav className="flex-1 space-y-0.5">
      {navItems.map((item) => {
        const isActive = item.label === active;
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={`flex h-9 w-full items-center rounded-md px-3 text-sm font-semibold transition ${
              isActive
                ? "bg-[#236c8f] text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <main className="min-h-screen bg-[#f6f4ef] text-[#1f2428]">
      <div className="flex min-h-screen">
        <aside className="hidden w-56 flex-col bg-[#191b1f] px-4 py-6 lg:flex">
          <div className="mb-7">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#236c8f]">
              Oyabun
            </p>
            <h1 className="mt-1.5 text-[1.1rem] font-black tracking-tight text-white">
              Accounting
            </h1>
          </div>

          {nav}

          <div className="mt-6 space-y-0.5 border-t border-white/10 pt-4">
            <Link
              href="/requests"
              className="flex h-9 w-full items-center rounded-md px-3 text-xs font-semibold text-white/40 transition hover:bg-white/10 hover:text-white/70"
            >
              ← Operations
            </Link>
            <button
              className="flex h-9 w-full items-center rounded-md px-3 text-xs font-semibold text-white/40 transition hover:bg-white/10 hover:text-white/70"
              onClick={handleSignOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[#d9d3c7] bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">
              <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#236c8f]">
                    Oyabun
                  </p>
                  <p className="mt-1 text-base font-black">Accounting</p>
                </div>
                <button
                  aria-label="Open navigation"
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-[#cfc7b8] hover:bg-[#eee8dd]"
                  onClick={() => setMobileMenuOpen(true)}
                  type="button"
                >
                  <span className="flex w-5 flex-col gap-1.5">
                    <span className="h-0.5 rounded bg-[#1f2428]" />
                    <span className="h-0.5 rounded bg-[#1f2428]" />
                    <span className="h-0.5 rounded bg-[#1f2428]" />
                  </span>
                </button>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {eyebrow ? (
                    <p className="text-sm font-semibold text-[#236c8f]">{eyebrow}</p>
                  ) : null}
                  <h2 className="text-2xl font-bold">{title}</h2>
                  {description ? (
                    <p className="mt-1 max-w-3xl text-sm text-[#697178]">{description}</p>
                  ) : null}
                </div>
                {actions ? (
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {actions}
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </div>
        </section>
      </div>

      <div
        aria-hidden={!mobileMenuOpen}
        className={`fixed inset-0 z-50 lg:hidden ${
          mobileMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <button
          aria-label="Close navigation"
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        />
        <aside
          className={`absolute bottom-0 left-0 top-0 flex w-[min(82vw,280px)] flex-col bg-[#191b1f] px-4 py-6 shadow-xl transition-transform duration-300 ease-out ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#236c8f]">
                Oyabun
              </p>
              <h1 className="mt-1.5 text-[1.1rem] font-black tracking-tight text-white">
                Accounting
              </h1>
            </div>
            <button
              aria-label="Close menu"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/20 text-lg font-bold text-white hover:bg-white/10"
              onClick={() => setMobileMenuOpen(false)}
              type="button"
            >
              x
            </button>
          </div>
          {nav}
          <div className="mt-6 space-y-0.5 border-t border-white/10 pt-4">
            <Link
              href="/requests"
              className="flex h-9 w-full items-center rounded-md px-3 text-xs font-semibold text-white/40 transition hover:bg-white/10 hover:text-white/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              ← Operations
            </Link>
            <button
              className="flex h-9 w-full items-center rounded-md px-3 text-xs font-semibold text-white/40 transition hover:bg-white/10 hover:text-white/70"
              onClick={handleSignOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
