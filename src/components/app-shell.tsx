import Link from "next/link";
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
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-[#8a6f4d]">{eyebrow}</p>
                <h2 className="text-2xl font-semibold">{title}</h2>
                {description ? (
                  <p className="mt-1 max-w-3xl text-sm text-[#697178]">{description}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {actions}
                <AuthButton />
              </div>
            </div>
          </header>

          <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
