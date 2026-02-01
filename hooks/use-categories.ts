import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { createClient } from "@/lib/supabase/client";
import { categoryKeys } from "./query-keys";

import type { Tables } from "@/types/database";

type Category = Tables<"categories">;

export interface CategoryOption {
  id: string;
  label: string;
}

export interface CategoryHierarchy {
  categories: Category[];
  categoryNameMap: Record<string, string>;
  categoryOptions: CategoryOption[];
}

export function useCategories(orgId: string) {
  return useQuery({
    queryKey: categoryKeys.list(orgId),
    queryFn: async (): Promise<Category[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("organization_id", orgId)
        .order("name");

      if (error) throw error;
      return data;
    },
  });
}

export function useCategoryHierarchy(orgId: string): CategoryHierarchy & {
  isLoading: boolean;
  error: Error | null;
} {
  const { data: categories, isLoading, error } = useCategories(orgId);

  const hierarchy = useMemo(() => {
    const list = categories ?? [];

    const categoryNameMap: Record<string, string> = {};
    for (const c of list) {
      categoryNameMap[c.id] = c.name;
    }

    const categoryOptions: CategoryOption[] = [];
    const parentCategories = list.filter(
      (c) => !c.parent_id && c.is_active
    );

    for (const parent of parentCategories) {
      categoryOptions.push({ id: parent.id, label: parent.name });
      const children = list.filter(
        (c) => c.parent_id === parent.id && c.is_active
      );
      for (const child of children) {
        categoryOptions.push({
          id: child.id,
          label: `${parent.name} \u2192 ${child.name}`,
        });
      }
    }

    // Add active children whose parent is inactive or missing
    const orphans = list.filter(
      (c) =>
        c.parent_id &&
        c.is_active &&
        !parentCategories.some((p) => p.id === c.parent_id)
    );
    for (const orphan of orphans) {
      const parentName = categoryNameMap[orphan.parent_id!] ?? "";
      categoryOptions.push({
        id: orphan.id,
        label: parentName
          ? `${parentName} \u2192 ${orphan.name}`
          : orphan.name,
      });
    }

    return { categories: list, categoryNameMap, categoryOptions };
  }, [categories]);

  return { ...hierarchy, isLoading, error };
}
