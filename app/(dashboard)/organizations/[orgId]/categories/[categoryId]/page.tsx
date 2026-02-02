import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { CATEGORY_TYPE_LABELS } from "@/lib/validations/category";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryActions } from "./category-actions";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; categoryId: string }>;
}) {
  const { orgId, categoryId } = await params;
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

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("id", categoryId)
    .eq("organization_id", orgId)
    .single();

  if (!category) {
    notFound();
  }

  // Fetch parent if subcategory
  let parentCategory: {
    id: string;
    name: string;
    category_type: string;
  } | null = null;
  if (category.parent_id) {
    const { data } = await supabase
      .from("categories")
      .select("id, name, category_type")
      .eq("id", category.parent_id)
      .single();
    parentCategory = data;
  }

  // Count active subcategories if parent
  let subcategoryCount = 0;
  let subcategories: Array<{ id: string; name: string }> = [];
  if (!category.parent_id) {
    const { data, count } = await supabase
      .from("categories")
      .select("id, name", { count: "exact" })
      .eq("parent_id", categoryId)
      .eq("is_active", true)
      .order("name");
    subcategoryCount = count ?? 0;
    subcategories = data ?? [];
  }

  // Count transaction line items and distinct transactions using this category
  const { data: lineItems, count: lineItemCount } = await supabase
    .from("transaction_line_items")
    .select("transaction_id", { count: "exact" })
    .eq("category_id", categoryId);

  const transactionCount = lineItems
    ? new Set(lineItems.map((li) => li.transaction_id)).size
    : 0;

  // Fetch eligible merge targets: same org, same type, active, not self (cross-hierarchy allowed)
  const { data: mergeTargets } = await supabase
    .from("categories")
    .select("id, name, parent_id, parent:categories!parent_id(name)")
    .eq("organization_id", orgId)
    .eq("category_type", category.category_type)
    .eq("is_active", true)
    .neq("id", categoryId)
    .order("name");


  const typeLabel =
    CATEGORY_TYPE_LABELS[
      category.category_type as keyof typeof CATEGORY_TYPE_LABELS
    ] ?? category.category_type;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/organizations/${orgId}/categories`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to categories
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle>{category.name}</CardTitle>
            <Badge variant="secondary">{typeLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {parentCategory && (
              <div className="col-span-2">
                <dt className="font-medium text-muted-foreground">
                  Parent Category
                </dt>
                <dd className="mt-1 text-foreground">
                  <Link
                    href={`/organizations/${orgId}/categories/${parentCategory.id}`}
                    className="hover:underline"
                  >
                    {parentCategory.name}
                  </Link>
                </dd>
              </div>
            )}
            {!category.parent_id && (
              <div className="col-span-2">
                <dt className="font-medium text-muted-foreground">
                  Subcategories
                </dt>
                <dd className="mt-1 text-foreground">
                  {subcategories.length > 0 ? (
                    <ul className="space-y-1">
                      {subcategories.map((sub) => (
                        <li key={sub.id}>
                          <Link
                            href={`/organizations/${orgId}/categories/${sub.id}`}
                            className="text-sm hover:underline"
                          >
                            {sub.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-muted-foreground">
                Transaction Usage
              </dt>
              <dd className="mt-1 text-foreground">
                {lineItemCount ?? 0} line item
                {(lineItemCount ?? 0) === 1 ? "" : "s"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Level</dt>
              <dd className="mt-1 text-foreground">
                {category.parent_id ? "Subcategory" : "Parent"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Created</dt>
              <dd className="mt-1 text-foreground">
                {category.created_at
                  ? new Date(category.created_at).toLocaleDateString()
                  : "N/A"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">
                Last Updated
              </dt>
              <dd className="mt-1 text-foreground">
                {category.updated_at
                  ? new Date(category.updated_at).toLocaleDateString()
                  : "N/A"}
              </dd>
            </div>
          </dl>

          <CategoryActions
            category={category}
            orgId={orgId}
            parentCategory={parentCategory}
            subcategoryCount={subcategoryCount}
            lineItemCount={lineItemCount ?? 0}
            transactionCount={transactionCount}
            mergeTargets={mergeTargets ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
