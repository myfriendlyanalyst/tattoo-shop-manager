import { AppShell } from "@/components/app-shell";

export default function OperationsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}
