import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CategoryForm } from "../category-form";

export default async function NewCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { orgId } = await params;
  const { saved } = await searchParams;
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

  // Fetch active parent categories for the dropdown
  const { data: parentCategories } = await supabase
    .from("categories")
    .select("id, name, category_type")
    .eq("organization_id", orgId)
    .is("parent_id", null)
    .eq("is_active", true)
    .order("name");

  return <CategoryForm parentCategories={parentCategories ?? []} showSaved={saved === "true"} />;
}
