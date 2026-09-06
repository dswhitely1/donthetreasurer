export interface GroupableCategory {
  id: string;
  name: string;
  parent_id: string | null;
  // Widened to string on purpose: this is what types/database.ts produces for
  // a TEXT column, and narrowing here would force a cast at every call site.
  // Anything unrecognised falls through to Unclassified rather than vanishing.
  primary_direction: string | null;
}

export type CategoryDirectionGroupKey =
  | "income"
  | "expense"
  | "neither"
  | "unclassified";

export interface CategoryDirectionGroup<T extends GroupableCategory> {
  key: CategoryDirectionGroupKey;
  title: string;
  parents: Array<{ parent: T; children: T[] }>;
}

const SECTIONS: Array<{
  key: CategoryDirectionGroupKey;
  title: string;
  matches: (direction: string | null) => boolean;
}> = [
  { key: "income", title: "Income", matches: (d) => d === "income" },
  { key: "expense", title: "Expense", matches: (d) => d === "expense" },
  { key: "neither", title: "Transfers", matches: (d) => d === "neither" },
  // Anything unrecognised lands here rather than vanishing from the page.
  {
    key: "unclassified",
    title: "Unclassified",
    matches: (d) => d !== "income" && d !== "expense" && d !== "neither",
  },
];

/**
 * Groups categories into display sections by their treasurer-set label.
 *
 * Only parents are grouped. A child follows its parent regardless of its own
 * label, so the hierarchy the treasurer built survives the grouping.
 * Sections with no parents are omitted. Order within a section is the order
 * the categories arrived in.
 */
export function groupCategoriesByDirection<T extends GroupableCategory>(
  categories: T[]
): Array<CategoryDirectionGroup<T>> {
  const parents = categories.filter((c) => !c.parent_id);
  const parentIds = new Set(parents.map((p) => p.id));

  const childrenByParent = new Map<string, T[]>();
  for (const category of categories) {
    // A child whose parent is missing from the input (inactive, or filtered
    // out) is dropped rather than promoted to top level.
    if (!category.parent_id || !parentIds.has(category.parent_id)) continue;
    const siblings = childrenByParent.get(category.parent_id) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parent_id, siblings);
  }

  return SECTIONS.map((section) => ({
    key: section.key,
    title: section.title,
    parents: parents
      .filter((p) => section.matches(p.primary_direction ?? null))
      .map((parent) => ({
        parent,
        children: childrenByParent.get(parent.id) ?? [],
      })),
  })).filter((group) => group.parents.length > 0);
}
