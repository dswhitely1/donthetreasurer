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
import { NewAccountForm } from "./new-account-form";

export default async function NewAccountPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  // Verify org exists and user has access
  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .eq("is_active", true)
    .single();

  if (!organization) {
    notFound();
  }

  // Fetch active expense categories for fee category dropdown
  const { data: expenseCategories } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .eq("organization_id", orgId)
    .eq("category_type", "expense")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={`/organizations/${orgId}/accounts`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to accounts
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New Account</CardTitle>
          <CardDescription>
            Add a financial account to this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewAccountForm
            orgId={orgId}
            expenseCategories={expenseCategories ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
