"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthButton } from "@/components/auth-button";

const navItems = [
  { label: "Requests", href: "/requests", note: "Start" },
  { label: "Projects", href: "/projects" },
  { label: "Calendar", href: "/calendar" },
  { label: "Customers", href: "/customers" },
  { label: "Artist Entry", href: "/artist-entry" },
  { label: "Staff", href: "/staff" },
  { label: "Settings", href: "/settings" },
];

type AppShellProps = {
  active: string;
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({
  active,
  eyebrow,
  title,
  description,
  actions,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const nav = (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = item.label === active;

        return (
          <Link
            key={item.label}
            className={`flex h-10 w-full items-center rounded-md px-3 text-left text-sm font-medium transition ${
              isActive
                ? "bg-[#1f2428] text-white"
                : "text-[#4d555c] hover:bg-[#eee8dd]"
            }`}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="flex-1">{item.label}</span>
            {item.note ? (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  isActive ? "bg-white/15 text-white" : "bg-[#e7ded0] text-[#7d684d]"
                }`}
              >
                {item.note}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <main className="min-h-screen bg-[#f6f4ef] text-[#1f2428]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-[#d9d3c7] bg-[#fdfbf7] px-5 py-6 lg:block">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6f4d]">
              Oyabun
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Tattoo Manager</h1>
          </div>

          {nav}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6f4d]">
                  Oyabun
                </p>
                <p className="mt-1 text-lg font-semibold">Tattoo Manager</p>
              </div>
              <button
                className="h-10 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold hover:bg-[#eee8dd]"
                onClick={() => setMobileMenuOpen(true)}
                type="button"
              >
                Menu
              </button>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-[#8a6f4d]">{eyebrow}</p>
                <h2 className="text-2xl font-semibold">{title}</h2>
                {description ? (
                  <p className="mt-1 max-w-3xl text-sm text-[#697178]">{description}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {actions}
                <AuthButton />
              </div>
            </div>
          </header>

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </section>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/35"
            onClick={() => setMobileMenuOpen(false)}
            type="button"
          />
          <aside className="absolute bottom-0 left-0 top-0 w-[min(82vw,320px)] border-r border-[#d9d3c7] bg-[#fdfbf7] px-5 py-6 shadow-xl">
            <div className="mb-8 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6f4d]">
                  Oyabun
                </p>
                <h1 className="mt-2 text-2xl font-semibold">Tattoo Manager</h1>
              </div>
              <button
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cfc7b8] text-lg font-semibold hover:bg-[#eee8dd]"
                onClick={() => setMobileMenuOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            {nav}
          </aside>
        </div>
      ) : null}
    </main>
  );
}
