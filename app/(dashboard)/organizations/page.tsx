import Link from "next/link";
import { Plus } from "lucide-react";

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Organizations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your nonprofit organizations.
          </p>
        </div>
        <Button asChild>
          <Link href="/organizations/new">
            <Plus className="mr-2 h-4 w-4" />
            New Organization
          </Link>
        </Button>
      </div>

      {!organizations || organizations.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <h3 className="text-lg font-semibold text-foreground">
            No organizations yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first organization to get started.
          </p>
          <Button asChild className="mt-4">
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              New Organization
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <Link key={org.id} href={`/organizations/${org.id}`}>
              <Card className="transition-colors hover:border-primary/30">
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
