import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function OrganizationsPage() {
  const supabase = await createClient();

  const { data: organizations } = await supabase
    .from("organizations")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return (
    <div>
      <PageHeader title="Organizations" description="Manage your nonprofit organizations.">
        <Button asChild>
          <Link href="/organizations/new">
            <Plus className="mr-2 h-4 w-4" />
            New Organization
          </Link>
        </Button>
      </PageHeader>

      {!organizations || organizations.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={Building2}
            title="No organizations yet"
            description="Create your first organization to get started."
            action={{ label: "New Organization", href: "/organizations/new" }}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <Link key={org.id} href={`/organizations/${org.id}`}>
              <Card className="rounded-xl shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30">
                <CardHeader>
                  <CardTitle className="text-base">{org.name}</CardTitle>
                  {org.ein && (
                    <CardDescription>EIN: {org.ein}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">
                    FY starts{" "}
                    {MONTH_NAMES[(org.fiscal_year_start_month ?? 1) - 1]}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
