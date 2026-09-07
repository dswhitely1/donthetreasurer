import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import { formatTermLabel } from "@/lib/sponsors/sponsorship-year";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SPONSOR_PAYMENT_METHOD_LABELS } from "@/lib/validations/sponsor";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function SponsorDetailPage({
  params,
}: Readonly<{
  params: Promise<{ orgId: string; sponsorId: string }>;
}>) {
  const { orgId, sponsorId } = await params;
  const supabase = await createClient();

  const org = await fetchSponsorsOrg(supabase, orgId);
  if (!org) notFound();

  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("*")
    .eq("id", sponsorId)
    .eq("organization_id", orgId)
    .single();

  if (!sponsor) notFound();

  const { data: sponsorshipRows } = await supabase
    .from("sponsorships")
    .select(
      `
      id,
      term_start_date,
      term_end_date,
      amount,
      payment_method,
      received_date,
      transaction_id,
      sponsor_levels(name),
      transactions(id, transaction_date, description)
    `
    )
    .eq("sponsor_id", sponsorId)
    .order("term_start_date", { ascending: false });

  const sponsorships = sponsorshipRows ?? [];
  const mostRecentSponsorshipId = sponsorships[0]?.id;

  const addressLines = [
    sponsor.address_line1,
    sponsor.address_line2,
    [sponsor.city, sponsor.state, sponsor.postal_code]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={sponsor.name}>
        <Button asChild>
          <Link
            href={`/organizations/${orgId}/sponsorships/new?sponsor_id=${sponsorId}`}
          >
            Log payment
          </Link>
        </Button>
        {mostRecentSponsorshipId && (
          <Button variant="secondary" asChild>
            <Link
              href={`/organizations/${orgId}/sponsorships/new?sponsor_id=${sponsorId}&renew_from=${mostRecentSponsorshipId}`}
            >
              Renew
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href={`/organizations/${orgId}/sponsors/${sponsorId}/edit`}>
            Edit
          </Link>
        </Button>
      </PageHeader>

      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-lg font-medium">Contact Details</h3>
          <Badge variant={sponsor.is_active ? "default" : "secondary"}>
            {sponsor.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Contact Name</dt>
            <dd>{sponsor.contact_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{sponsor.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{sponsor.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Mailing Address</dt>
            <dd>
              {addressLines.length > 0 ? (
                addressLines.map((line) => <div key={line}>{line}</div>)
              ) : (
                "—"
              )}
            </dd>
          </div>
          {sponsor.notes && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="whitespace-pre-wrap">{sponsor.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-medium">Sponsorship History</h3>
        {sponsorships.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sponsorships logged yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Term</th>
                  <th className="px-4 py-2 text-left font-medium">Level</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 text-left font-medium">Method</th>
                  <th className="px-4 py-2 text-left font-medium">
                    Received
                  </th>
                  <th className="px-4 py-2 text-left font-medium">Deposit</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sponsorships.map((sponsorship) => (
                  <tr key={sponsorship.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      {formatTermLabel(
                        sponsorship.term_start_date,
                        sponsorship.term_end_date
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {sponsorship.sponsor_levels?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(sponsorship.amount)}
                    </td>
                    <td className="px-4 py-2">
                      {SPONSOR_PAYMENT_METHOD_LABELS[
                        sponsorship.payment_method as keyof typeof SPONSOR_PAYMENT_METHOD_LABELS
                      ] ?? sponsorship.payment_method}
                    </td>
                    <td className="px-4 py-2">
                      {formatDate(sponsorship.received_date)}
                    </td>
                    <td className="px-4 py-2">
                      {sponsorship.transaction_id && sponsorship.transactions ? (
                        <Link
                          href={`/organizations/${orgId}/transactions/${sponsorship.transaction_id}`}
                          className="text-primary hover:underline"
                        >
                          {formatDate(sponsorship.transactions.transaction_date)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          In queue
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/organizations/${orgId}/sponsorships/${sponsorship.id}/edit`}
                        >
                          Edit
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
