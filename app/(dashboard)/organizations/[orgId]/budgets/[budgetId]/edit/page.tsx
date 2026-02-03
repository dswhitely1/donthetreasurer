import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { BudgetForm } from "../../budget-form";

export default async function EditBudgetPage({
  params,
}: {
  params: Promise<{ orgId: string; budgetId: string }>;
}) {
  const { orgId, budgetId } = await params;
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .eq("is_active", true)
    .single();

  if (!organization) {
    notFound();
  }

  // Fetch budget with line items and categories in parallel
  const [budgetResult, categoriesResult] = await Promise.all([
    supabase
      .from("budgets")
      .select(
        `
        *,
        budget_line_items(category_id, amount, notes)
      `
      )
      .eq("id", budgetId)
      .eq("organization_id", orgId)
      .single(),
    supabase
      .from("categories")
      .select("id, name, category_type, parent_id")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name"),
  ]);

  const budget = budgetResult.data;
  if (!budget) {
    notFound();
  }

  const categories = categoriesResult.data ?? [];

  const defaultValues = {
    id: budget.id,
    name: budget.name,
    start_date: budget.start_date,
    end_date: budget.end_date,
    status: budget.status,
    notes: budget.notes,
    line_items: (budget.budget_line_items ?? []).map(
      (li: { category_id: string; amount: number; notes: string | null }) => ({
        category_id: li.category_id,
        amount: li.amount,
        notes: li.notes,
      })
    ),
  };

  return (
    <BudgetForm
      mode="edit"
      categories={categories}
      orgId={orgId}
      defaultValues={defaultValues}
    />
  );
}
