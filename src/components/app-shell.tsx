"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthButton } from "@/components/auth-button";
import {
  getCachedOperationsContext,
  getOperationsContext,
  operationsViewModeChangedEvent,
  setOperationsViewMode,
  type OperationsContext,
  type OperationsRole,
} from "@/lib/operations-access";

const navItems = [
  { label: "Requests", href: "/requests", note: "Start" },
  {
    label: "Projects",
    href: "/projects",
    children: [
      { label: "New project", href: "/projects/new" },
      { label: "New session", href: "/projects/session/wizard" },
      { label: "Project list", href: "/projects" },
    ],
  },
  { label: "Calendar", href: "/calendar" },
  { label: "Customers", href: "/customers" },
  { label: "Staff", href: "/staff" },
  { label: "Settings", href: "/settings" },
];

const basicNavLabels = new Set(["Requests", "Projects", "Calendar", "Settings"]);

type AppShellProps = {
  children: React.ReactNode;
};

type AppPageProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [role, setRole] = useState<OperationsRole | undefined>(() => {
    const cachedContext = getCachedOperationsContext();
    return cachedContext === undefined ? undefined : cachedContext?.role ?? null;
  });
  const [operationsContext, setOperationsContext] = useState<OperationsContext | null | undefined>(
    () => getCachedOperationsContext(),
  );
  const isArtistView = operationsContext?.isArtist === true;
  const visibleNavItems =
    isArtistView || role === undefined
      ? navItems.filter((item) => basicNavLabels.has(item.label))
      : navItems;

  useEffect(() => {
    let mounted = true;

    function loadContext(options: { force?: boolean } = {}) {
      getOperationsContext(options).then((context) => {
        if (mounted) {
          setRole(context?.role ?? null);
          setOperationsContext(context);
        }
      });
    }

    loadContext();

    function handleViewModeChange() {
      loadContext({ force: true });
    }

    window.addEventListener(operationsViewModeChangedEvent, handleViewModeChange);

    return () => {
      mounted = false;
      window.removeEventListener(operationsViewModeChangedEvent, handleViewModeChange);
    };
  }, []);

  const viewToggle = operationsContext?.canUseArtistView ? (
    <div className="mb-4 grid grid-cols-2 rounded-md border border-[#d9d3c7] bg-[#f7f2e9] p-1 text-xs font-bold">
      <button
        className={`h-8 rounded ${operationsContext.viewMode === "admin" ? "bg-[#1f2428] text-white" : "text-[#4d555c]"}`}
        onClick={() => {
          setOperationsViewMode("admin");
          window.location.reload();
        }}
        type="button"
      >
        Admin View
      </button>
      <button
        className={`h-8 rounded ${operationsContext.viewMode === "artist" ? "bg-[#1f2428] text-white" : "text-[#4d555c]"}`}
        onClick={() => {
          setOperationsViewMode("artist");
          window.location.reload();
        }}
        type="button"
      >
        Artist View
      </button>
    </div>
  ) : null;

  const nav = (
    <>
      {viewToggle}
      <nav className="space-y-1">
        {visibleNavItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));

          return (
            <div key={item.label}>
              <Link
                className={`flex h-10 w-full items-center rounded-md px-3 text-left text-sm font-medium transition ${
                  isActive ? "bg-[#1f2428] text-white" : "text-[#4d555c] hover:bg-[#eee8dd]"
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
              {item.children ? (
                <div className="mt-1 space-y-1 pl-4">
                  {item.children.map((child) => {
                    const childActive = pathname === child.href;

                    return (
                      <Link
                        className={`flex h-8 items-center rounded-md px-3 text-sm font-medium transition ${
                          childActive
                            ? "bg-[#e7ded0] text-[#1f2428]"
                            : "text-[#697178] hover:bg-[#eee8dd]"
                        }`}
                        href={child.href}
                        key={child.href}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </>
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
          <header className="border-b border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4 sm:px-6 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6f4d]">
                  Oyabun
                </p>
                <p className="mt-1 text-lg font-semibold">Tattoo Manager</p>
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
          </header>

          {children}
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
          className={`absolute inset-0 bg-black/35 transition-opacity duration-200 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        />
        <aside
          className={`absolute bottom-0 left-0 top-0 w-[min(82vw,320px)] border-r border-[#d9d3c7] bg-[#fdfbf7] px-5 py-6 shadow-xl transition-transform duration-300 ease-out ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
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
    </main>
  );
}

export function AppPage({
  eyebrow,
  title,
  description,
  actions,
  children,
  wide = false,
}: AppPageProps) {
  const contentWidthClass = wide ? "max-w-[96rem]" : "max-w-6xl";

  return (
    <>
      <header className="border-b border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4 sm:px-6 lg:px-8">
        <div className={`mx-auto w-full ${contentWidthClass}`}>
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
        </div>
      </header>

      <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <div className={`mx-auto w-full ${contentWidthClass}`}>{children}</div>
      </div>
    </>
  );
}
