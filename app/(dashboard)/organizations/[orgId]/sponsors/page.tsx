import Link from "next/link";
import { notFound } from "next/navigation";
import { Handshake, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import { getSponsorshipTerm } from "@/lib/sponsors/sponsorship-year";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function SponsorsPage({
  params,
}: Readonly<{
  params: Promise<{ orgId: string }>;
}>) {
  const { orgId } = await params;
  const supabase = await createClient();

  const org = await fetchSponsorsOrg(supabase, orgId);
  if (!org) notFound();

  const term = getSponsorshipTerm(org.fiscal_year_start_month);

  const [{ data: sponsors }, { data: currentTermSponsorships }, { count: queuedCount }] =
    await Promise.all([
      supabase
        .from("sponsors")
        .select("id, name, contact_name, is_active")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("sponsorships")
        .select(
          "sponsor_id, sponsor_levels(name), sponsors!inner(organization_id)"
        )
        .eq("sponsors.organization_id", orgId)
        .eq("term_start_date", term.startDate)
        .eq("term_end_date", term.endDate),
      supabase
        .from("sponsorships")
        .select("id, sponsors!inner(organization_id)", {
          count: "exact",
          head: true,
        })
        .eq("sponsors.organization_id", orgId)
        .is("transaction_id", null),
    ]);

  const levelBySponsor = new Map(
    (currentTermSponsorships ?? []).map((sponsorship) => [
      sponsorship.sponsor_id,
      sponsorship.sponsor_levels?.name ?? null,
    ])
  );

  const rows = sponsors ?? [];
  const count = queuedCount ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sponsors"
        description="Track sponsor contact details and their sponsorship history."
      >
        <Button asChild>
          <Link href={`/organizations/${orgId}/sponsors/new`}>
            <Plus className="mr-2 h-4 w-4" />
            Add Sponsor
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/organizations/${orgId}/transactions/deposit`}
          className="font-medium text-primary hover:underline"
        >
          {count} {count === 1 ? "payment" : "payments"} waiting to be
          deposited
        </Link>
        <div className="flex gap-4 text-sm">
          <Link
            href={`/organizations/${orgId}/sponsor-levels`}
            className="text-muted-foreground hover:underline"
          >
            Sponsorship Levels
          </Link>
          <Link
            href={`/organizations/${orgId}/sponsor-letters`}
            className="text-muted-foreground hover:underline"
          >
            Sponsor Letters
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No sponsors yet"
          description="Add your first sponsor to start tracking sponsorships."
          action={{
            label: "Add Sponsor",
            href: `/organizations/${orgId}/sponsors/new`,
          }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Contact</th>
                <th className="px-4 py-2 text-left font-medium">
                  Current Term Level
                </th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((sponsor) => (
                <tr key={sponsor.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">
                    <Link
                      href={`/organizations/${orgId}/sponsors/${sponsor.id}`}
                      className="text-primary hover:underline"
                    >
                      {sponsor.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {sponsor.contact_name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {levelBySponsor.get(sponsor.id) ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={sponsor.is_active ? "default" : "secondary"}>
                      {sponsor.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
