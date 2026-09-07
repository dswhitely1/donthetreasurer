import Link from "next/link";
import { notFound } from "next/navigation";
import { Award } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

import { DeleteLevelButton, LevelForm } from "./level-form";

export default async function SponsorLevelsPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ edit?: string }>;
}>) {
  const { orgId } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();

  const org = await fetchSponsorsOrg(supabase, orgId);
  if (!org) notFound();

  const { data: levels } = await supabase
    .from("sponsor_levels")
    .select("*")
    .eq("organization_id", orgId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const rows = levels ?? [];
  const editingLevel = edit ? rows.find((level) => level.id === edit) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sponsorship Levels"
        description="Levels prefill the amount when you log a sponsorship payment. The amount stays editable on each sponsorship."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No sponsorship levels yet"
          description="Add a level below to start tracking sponsorships at that tier."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-right font-medium">
                  Default Amount
                </th>
                <th className="px-4 py-2 text-left font-medium">
                  Description
                </th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((level) => (
                <tr key={level.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{level.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCurrency(level.default_amount)}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {level.description ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={level.is_active ? "default" : "secondary"}>
                      {level.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/organizations/${orgId}/sponsor-levels?edit=${level.id}`}
                        >
                          Edit
                        </Link>
                      </Button>
                      <DeleteLevelButton levelId={level.id} orgId={orgId} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-border p-4">
        <h2 className="mb-4 text-lg font-medium">
          {editingLevel ? `Edit ${editingLevel.name}` : "Add a Level"}
        </h2>
        <LevelForm
          key={editingLevel?.id ?? "create"}
          mode={editingLevel ? "edit" : "create"}
          orgId={orgId}
          defaultValues={editingLevel}
        />
      </div>
    </div>
  );
}
