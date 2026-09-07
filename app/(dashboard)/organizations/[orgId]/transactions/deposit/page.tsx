import { notFound } from "next/navigation";
import { HandCoins } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

import { DepositBuilder } from "./deposit-builder";

export default async function DepositFromQueuePage({
  params,
}: Readonly<{
  params: Promise<{ orgId: string }>;
}>) {
  const { orgId } = await params;
  const supabase = await createClient();

  const org = await fetchSponsorsOrg(supabase, orgId);
  if (!org) notFound();

  const [{ data: queue }, { data: accounts }, { data: categories }] =
    await Promise.all([
      supabase
        .from("sponsorships")
        .select(
          "id, amount, payment_method, check_number, received_date, term_start_date, term_end_date, sponsors!inner(id, name, organization_id), sponsor_levels(name)"
        )
        .eq("sponsors.organization_id", orgId)
        .is("transaction_id", null)
        .order("received_date", { ascending: true }),
      supabase
        .from("accounts")
        .select(
          "id, name, account_type, fee_percentage, fee_flat_amount, fee_category_id"
        )
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("categories")
        .select("id, name, parent_id")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("name"),
    ]);

  const queuedPayments = queue ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Deposit from Queue"
        description={`Build a bank deposit from queued sponsorship payments for ${org.name}.`}
      />

      {queuedPayments.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="No payments waiting"
          description="Log a sponsor payment to add it to the deposit queue."
          action={{
            label: "Log a payment",
            href: `/organizations/${orgId}/sponsorships/new`,
          }}
        />
      ) : (
        <DepositBuilder
          orgId={orgId}
          queue={queuedPayments}
          accounts={accounts ?? []}
          categories={categories ?? []}
        />
      )}
    </div>
  );
}
