import Link from "next/link";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
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

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: organizations } = await supabase
    .from("organizations")
    .select("*")
    .eq("is_active", true)
    .order("name");

  const hasOrgs = organizations && organizations.length > 0;

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        Dashboard
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Welcome to Treasurer. {hasOrgs ? "Select an organization to manage." : "Create your first organization to get started."}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hasOrgs &&
          organizations.map((org) => (
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

        <Link href="/organizations/new">
          <Card className="flex h-full items-center justify-center border-dashed transition-colors hover:border-primary/30">
            <CardContent className="flex flex-col items-center py-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                Add Organization
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
