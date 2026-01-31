import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_TYPE_LABELS } from "@/lib/validations/account";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default async function AccountsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  // Verify org exists and user has access (RLS)
  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .eq("is_active", true)
    .single();

  if (!organization) {
    notFound();
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Accounts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage financial accounts for {organization.name}.
          </p>
        </div>
        <Button asChild>
          <Link href={`/organizations/${orgId}/accounts/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Account
          </Link>
        </Button>
      </div>

      {!accounts || accounts.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <h3 className="text-lg font-semibold text-foreground">
            No accounts yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first account to start tracking transactions.
          </p>
          <Button asChild className="mt-4">
            <Link href={`/organizations/${orgId}/accounts/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New Account
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Link
              key={account.id}
              href={`/organizations/${orgId}/accounts/${account.id}`}
            >
              <Card className="transition-colors hover:border-primary/30">
                <CardHeader>
                  <CardTitle className="text-base">{account.name}</CardTitle>
                  {account.description && (
                    <CardDescription>{account.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      {ACCOUNT_TYPE_LABELS[
                        account.account_type as keyof typeof ACCOUNT_TYPE_LABELS
                      ] ?? account.account_type}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrency(account.opening_balance ?? 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
