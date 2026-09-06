import { describe, it, expect } from "vitest";

import { groupCategoriesByDirection } from "./group-by-direction";

import type { GroupableCategory } from "./group-by-direction";

function cat(
  id: string,
  name: string,
  primary_direction: GroupableCategory["primary_direction"],
  parent_id: string | null = null
): GroupableCategory {
  return { id, name, parent_id, primary_direction };
}

describe("groupCategoriesByDirection", () => {
  it("places each parent in the section its label names", () => {
    const groups = groupCategoriesByDirection([
      cat("1", "Funding", "income"),
      cat("2", "Supplies", "expense"),
      cat("3", "Transfer", "neither"),
      cat("4", "Other", null),
    ]);

    expect(groups.map((g) => g.key)).toEqual([
      "income",
      "expense",
      "neither",
      "unclassified",
    ]);
    expect(groups[0].parents.map((p) => p.parent.name)).toEqual(["Funding"]);
    expect(groups[2].parents.map((p) => p.parent.name)).toEqual(["Transfer"]);
    expect(groups[3].parents.map((p) => p.parent.name)).toEqual(["Other"]);
  });

  it("keeps children with their parent even when their own label differs", () => {
    // Real case: Student Fees > Vanguard is income while the Vanguard parent
    // rolls up to expense on uniform and competition costs.
    const groups = groupCategoriesByDirection([
      cat("p", "Vanguard", "expense"),
      cat("c", "Vanguard Fees", "income", "p"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("expense");
    expect(groups[0].parents[0].children.map((c) => c.name)).toEqual([
      "Vanguard Fees",
    ]);
  });

  it("omits empty sections", () => {
    const groups = groupCategoriesByDirection([cat("1", "Supplies", "expense")]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("expense");
  });

  it("never conflates neither with unclassified", () => {
    const groups = groupCategoriesByDirection([
      cat("1", "Transfer", "neither"),
      cat("2", "Brand New", null),
    ]);

    const neither = groups.find((g) => g.key === "neither")!;
    const unclassified = groups.find((g) => g.key === "unclassified")!;
    expect(neither.parents.map((p) => p.parent.name)).toEqual(["Transfer"]);
    expect(unclassified.parents.map((p) => p.parent.name)).toEqual([
      "Brand New",
    ]);
  });

  it("preserves input order within a section", () => {
    const groups = groupCategoriesByDirection([
      cat("1", "Apples", "expense"),
      cat("2", "Bananas", "expense"),
      cat("3", "Cherries", "expense"),
    ]);

    expect(groups[0].parents.map((p) => p.parent.name)).toEqual([
      "Apples",
      "Bananas",
      "Cherries",
    ]);
  });

  it("ignores a child whose parent is absent from the input", () => {
    const groups = groupCategoriesByDirection([
      cat("p", "Present", "income"),
      cat("orphan", "Orphan", "expense", "missing-parent"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].parents).toHaveLength(1);
    expect(groups[0].parents[0].parent.name).toBe("Present");
  });

  it("returns no groups for empty input", () => {
    expect(groupCategoriesByDirection([])).toEqual([]);
  });
});
