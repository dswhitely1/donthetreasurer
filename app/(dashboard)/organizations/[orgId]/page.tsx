import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrganizationActions } from "./organization-actions";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .eq("is_active", true)
    .single();

  if (!organization) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/organizations"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to organizations
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{organization.name}</CardTitle>
              {organization.ein && (
                <CardDescription className="mt-1">
                  EIN: {organization.ein}
                </CardDescription>
              )}
            </div>
            <Badge variant="secondary">
              FY starts{" "}
              {MONTH_NAMES[(organization.fiscal_year_start_month ?? 1) - 1]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-muted-foreground">Created</dt>
              <dd className="mt-1 text-foreground">
                {organization.created_at
                  ? new Date(organization.created_at).toLocaleDateString()
                  : "N/A"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">
                Last Updated
              </dt>
              <dd className="mt-1 text-foreground">
                {organization.updated_at
                  ? new Date(organization.updated_at).toLocaleDateString()
                  : "N/A"}
              </dd>
            </div>
          </dl>

          <OrganizationActions organization={organization} />
        </CardContent>
      </Card>
    </div>
  );
}
