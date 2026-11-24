"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountingShell } from "@/components/accounting-shell";
import { FinancialHistory } from "@/components/financial-history";
import { hasAccountingAccess } from "@/lib/accounting-access";
import { getSafeUser } from "@/lib/auth-session";

export default function AccountingHistoryPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function authorize() {
      const user = await getSafeUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      if (!(await hasAccountingAccess(user.id))) {
        router.replace("/requests");
        return;
      }
      setAllowed(true);
    }
    void authorize();
  }, [router]);

  return (
    <AccountingShell
      active="History"
      description="Append-only changes to sessions, payments, deposits, and settlements."
      eyebrow="Audit"
      title="Financial history"
    >
      {allowed ? <FinancialHistory title="Latest financial changes" /> : <p>Checking access...</p>}
    </AccountingShell>
  );
}
