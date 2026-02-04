import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function SeasonsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled) redirect(`/organizations/${orgId}`);

  const { data: seasons } = await supabase
    .from("seasons")
    .select(
      "*, season_enrollments(id, fee_amount, season_payments(amount))"
    )
    .eq("organization_id", orgId)
    .order("status")
    .order("start_date", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Seasons</h1>
        <Button asChild>
          <Link href={`/organizations/${orgId}/seasons/new`}>New Season</Link>
        </Button>
      </div>

      {!seasons || seasons.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            No seasons yet. Create your first season to start tracking student
            enrollment and payments.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium">Name</th>
                <th className="hidden px-3 py-2.5 text-left font-medium sm:table-cell">
                  Date Range
                </th>
                <th className="px-3 py-2.5 text-right font-medium">Fee</th>
                <th className="px-3 py-2.5 text-center font-medium">
                  Enrolled
                </th>
                <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">
                  Collected
                </th>
                <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">
                  Outstanding
                </th>
                <th className="px-3 py-2.5 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((season) => {
                const enrollments = season.season_enrollments ?? [];
                const enrolled = enrollments.length;
                const totalFees = enrollments.reduce(
                  (sum, e) => sum + Number(e.fee_amount),
                  0
                );
                const totalCollected = enrollments.reduce(
                  (sum, e) =>
                    sum +
                    (e.season_payments ?? []).reduce(
                      (pSum, p) => pSum + Number(p.amount),
                      0
                    ),
                  0
                );
                const outstanding = totalFees - totalCollected;

                return (
                  <tr
                    key={season.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/organizations/${orgId}/seasons/${season.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {season.name}
                      </Link>
                    </td>
                    <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">
                      {formatDate(season.start_date)} &ndash;{" "}
                      {formatDate(season.end_date)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatCurrency(Number(season.fee_amount))}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      {enrolled}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">
                      {formatCurrency(totalCollected)}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">
                      {formatCurrency(outstanding)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge
                        variant={
                          season.status === "active" ? "default" : "secondary"
                        }
                      >
                        {season.status === "active" ? "Active" : "Archived"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
