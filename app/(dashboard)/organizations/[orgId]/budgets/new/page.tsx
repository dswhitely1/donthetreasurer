import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { BudgetForm } from "../budget-form";

export default async function NewBudgetPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
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

  // Fetch categories and existing budgets (for copy) in parallel
  const [categoriesResult, budgetsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, category_type, parent_id")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("budgets")
      .select(
        `
        id,
        name,
        budget_line_items(category_id, amount, notes)
      `
      )
      .eq("organization_id", orgId)
      .order("start_date", { ascending: false }),
  ]);

  const categories = categoriesResult.data ?? [];
  const existingBudgets = (budgetsResult.data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    budget_line_items: (b.budget_line_items ?? []).map(
      (li: { category_id: string; amount: number; notes: string | null }) => ({
        category_id: li.category_id,
        amount: li.amount,
        notes: li.notes,
      })
    ),
  }));

  return (
    <BudgetForm
      mode="create"
      categories={categories}
      orgId={orgId}
      existingBudgets={existingBudgets}
    />
  );
}
