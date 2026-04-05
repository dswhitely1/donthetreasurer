import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Tag } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { CATEGORY_TYPE_LABELS } from "@/lib/validations/category";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function CategoriesPage({
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

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name");

  // Build hierarchy: group into parents and their children
  const allCategories = categories ?? [];
  const parents = allCategories.filter((c) => !c.parent_id);
  const childrenMap = new Map<string, typeof allCategories>();
  for (const cat of allCategories) {
    if (cat.parent_id) {
      const existing = childrenMap.get(cat.parent_id) ?? [];
      existing.push(cat);
      childrenMap.set(cat.parent_id, existing);
    }
  }

  const incomeParents = parents.filter((p) => p.category_type === "income");
  const expenseParents = parents.filter((p) => p.category_type === "expense");

  return (
    <div>
      <PageHeader title="Categories" description={`Manage transaction categories for ${organization.name}.`}>
        <Button asChild>
          <Link href={`/organizations/${orgId}/categories/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Category
          </Link>
        </Button>
      </PageHeader>

      {allCategories.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={Tag}
            title="No categories yet"
            description="Create your first category to start organizing transactions."
            action={{ label: "New Category", href: `/organizations/${orgId}/categories/new` }}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          <CategorySection
            title="Income Categories"
            parents={incomeParents}
            childrenMap={childrenMap}
            orgId={orgId}
          />
          <CategorySection
            title="Expense Categories"
            parents={expenseParents}
            childrenMap={childrenMap}
            orgId={orgId}
          />
        </div>
      )}
    </div>
  );
}

function CategorySection({
  title,
  parents,
  childrenMap,
  orgId,
}: Readonly<{
  title: string;
  parents: Array<{
    id: string;
    name: string;
    category_type: string;
  }>;
  childrenMap: Map<
    string,
    Array<{ id: string; name: string; category_type: string }>
  >;
  orgId: string;
}>) {
  if (parents.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-lg font-medium text-foreground">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {parents.map((parent) => {
          const children = childrenMap.get(parent.id) ?? [];
          return (
            <Card key={parent.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <Link
                    href={`/organizations/${orgId}/categories/${parent.id}`}
                    className="hover:underline"
                  >
                    <CardTitle className="text-base">
                      {parent.name}
                    </CardTitle>
                  </Link>
                  <Badge variant="secondary">
                    {CATEGORY_TYPE_LABELS[
                      parent.category_type as keyof typeof CATEGORY_TYPE_LABELS
                    ] ?? parent.category_type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {children.length > 0 ? (
                  <ul className="space-y-1">
                    {children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/organizations/${orgId}/categories/${child.id}`}
                          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No subcategories
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
