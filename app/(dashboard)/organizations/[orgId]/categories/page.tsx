import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Categories
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage transaction categories for {organization.name}.
          </p>
        </div>
        <Button asChild>
          <Link href={`/organizations/${orgId}/categories/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Category
          </Link>
        </Button>
      </div>

      {allCategories.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <h3 className="text-lg font-semibold text-foreground">
            No categories yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first category to start organizing transactions.
          </p>
          <Button asChild className="mt-4">
            <Link href={`/organizations/${orgId}/categories/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New Category
            </Link>
          </Button>
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
      <h3 className="mb-3 text-lg font-semibold text-foreground">{title}</h3>
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
