# Category Primary Direction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a treasurer label each category income / expense / neither, so the categories page groups into sections again, while any category still accepts transactions in either direction.

**Architecture:** Add a nullable `primary_direction` column to `categories` that is a *label only* — it constrains nothing. A one-time backfill derives labels from actual transaction usage with child-to-parent roll-up, abstaining where the data is genuinely two-sided. The categories page groups parents into four sections via a pure, unit-tested function.

**Tech Stack:** Supabase/PostgreSQL 17, Next.js 16 App Router (Server Components + Server Actions), React 19 `useActionState`, Zod 4, shadcn/ui `Select`, Vitest 4.

**Spec:** [docs/superpowers/specs/2026-09-05-category-primary-direction-design.md](../specs/2026-09-05-category-primary-direction-design.md)

## Global Constraints

- `primary_direction` is a **label, never a constraint**. It must not filter any category dropdown, must not restrict which transactions may use a category, and must not participate in merge validation.
- Allowed values: `'income' | 'expense' | 'neither'`, plus SQL `NULL`. No other value, including `'both'`.
- `NULL` means "not yet decided" and nothing else. Internal transfers are `'neither'`, not `NULL`.
- Transaction-form category dropdowns are **not** modified by this plan.
- `transactions.transaction_type` is untouched. Direction of money still lives on the transaction.
- Forms in this codebase use `useActionState` with server actions and `FormData` — **not** react-hook-form, despite what CLAUDE.md says.
- Empty string from a `FormData` field means "unset" and must be normalised to SQL `NULL`, following the existing `parent_id` pattern.

---

### Task 1: Migration and backfill

**Files:**
- Create: `supabase/migrations/20260905000001_category_primary_direction.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `public.categories.primary_direction TEXT NULL CHECK (primary_direction IN ('income','expense','neither'))`, backfilled.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260905000001_category_primary_direction.sql`:

```sql
-- Migration: category primary_direction (a label, not a constraint)
--
-- Adds a treasurer-controlled label saying what a category IS. It does not
-- restrict which transactions may use the category -- direction of money
-- still comes from transactions.transaction_type. See
-- docs/superpowers/specs/2026-09-05-category-primary-direction-design.md
--
-- Safe to re-run: the column add is IF NOT EXISTS and every backfill
-- statement is guarded on primary_direction IS NULL, so a second run will
-- not overwrite labels a treasurer has since corrected by hand.

BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS primary_direction TEXT
  CHECK (primary_direction IN ('income', 'expense', 'neither'));

COMMENT ON COLUMN public.categories.primary_direction IS
  'Treasurer-set label: income | expense | neither | NULL (undecided). '
  'A label only -- never filters category selection and never restricts '
  'which transactions may use this category.';

-- Backfill from actual usage.
--
-- Roll-up is load-bearing: transactions attach to CHILD categories, so a
-- parent''s own line items are usually empty. Classifying parents on their
-- own activity alone leaves ~20 of 29 parents NULL -- exactly the level the
-- categories page groups by. A category''s totals are its own activity plus
-- its direct children''s.
--
-- The 40% abstention is the point of this backfill. Amount dominance is a
-- weak signal near parity (real data has 164.51 vs 162.99, and an exact
-- 11000.00 vs 11000.00). Breaking those ties by comparison operator yields
-- labels that are wrong and silently so. An unset label is visible in the
-- UI as "Unclassified"; an incorrect one is not.
WITH leaf AS (
  SELECT c.id,
         c.parent_id,
         COALESCE(SUM(li.amount) FILTER (WHERE t.transaction_type = 'income'), 0)  AS in_amt,
         COALESCE(SUM(li.amount) FILTER (WHERE t.transaction_type = 'expense'), 0) AS out_amt
    FROM public.categories c
    LEFT JOIN public.transaction_line_items li ON li.category_id = c.id
    LEFT JOIN public.transactions t ON t.id = li.transaction_id
   GROUP BY c.id, c.parent_id
), rolled AS (
  SELECT c.id,
         l.in_amt  + COALESCE(SUM(ch.in_amt), 0)  AS in_amt,
         l.out_amt + COALESCE(SUM(ch.out_amt), 0) AS out_amt
    FROM public.categories c
    JOIN leaf l ON l.id = c.id
    LEFT JOIN leaf ch ON ch.parent_id = c.id
   GROUP BY c.id, l.in_amt, l.out_amt
)
UPDATE public.categories AS cat
   SET primary_direction = CASE
         WHEN r.in_amt = 0 AND r.out_amt = 0 THEN NULL
         WHEN LEAST(r.in_amt, r.out_amt) >= 0.40 * GREATEST(r.in_amt, r.out_amt) THEN NULL
         WHEN r.in_amt > r.out_amt THEN 'income'
         ELSE 'expense'
       END
  FROM rolled r
 WHERE r.id = cat.id
   AND cat.primary_direction IS NULL;

-- Explicit overrides, decided by the treasurer while reviewing the full
-- 138-row proposed assignment.
--
-- A fundraiser IS a revenue activity; its costs are cost-of-goods, which is
-- the exact two-sided case untyped categories exists to serve. Both of these
-- abstained above (minority side 52% and 60%) but net strongly positive.
-- Name-scoped rather than id-scoped so the migration carries no environment
-- specific UUIDs; the IS NULL guard means it cannot disturb an org whose
-- "Fundraisers" already classified by dominance.
UPDATE public.categories
   SET primary_direction = 'income'
 WHERE parent_id IS NULL
   AND lower(trim(name)) = 'fundraisers'
   AND primary_direction IS NULL;

-- Transfers between accounts the org owns are neither income nor expense.
-- The schema cannot detect this: transaction_type is CHECK (income, expense)
-- with no counterpart-account or linked-transaction column, so nothing
-- records whether the far side is org-owned. The label carries that
-- knowledge. Transfers leaving to an outside account stay NULL for the
-- treasurer to decide case by case.
UPDATE public.categories
   SET primary_direction = 'neither'
 WHERE primary_direction IS NULL
   AND (
     (parent_id IS NULL AND lower(trim(name)) = 'transfer')
     OR parent_id IN (
       SELECT id FROM public.categories
        WHERE parent_id IS NULL AND lower(trim(name)) = 'transfer'
     )
   );

COMMIT;
```

- [ ] **Step 2: Apply it to the local database loaded with production data**

The local stack already holds a copy of production with the untyped-categories migration applied.

Run:
```bash
docker exec -i supabase_db_treasurer psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/migrations/20260905000001_category_primary_direction.sql
```
Expected: `BEGIN … ALTER TABLE … COMMENT … UPDATE 138 … UPDATE 2 … UPDATE 2 … COMMIT` and exit 0.

- [ ] **Step 3: Verify the parent assignment matches the reviewed proposal**

Run:
```bash
docker exec -i supabase_db_treasurer psql -U postgres -d postgres -c "
SELECT COALESCE(primary_direction,'(unclassified)') AS label, count(*)
  FROM categories WHERE parent_id IS NULL GROUP BY 1 ORDER BY 2 DESC;"
```
Expected exactly:

| label | count |
|-------|-------|
| expense | 18 |
| income | 6 |
| (unclassified) | 4 |
| neither | 1 |

The 6 income are `Funding`, `Student Fees`, `Beginning Balance`, and the three `Fundraisers` (Lanesville by dominance, CIS PTO and Corydon by override). The 4 unclassified are `Other`, `Fill A Square`, `Special Fundraisers`, `Donations`. The 1 `neither` is `Transfer`.

- [ ] **Step 4: Verify the abstention actually abstained**

Run:
```bash
docker exec -i supabase_db_treasurer psql -U postgres -d postgres -c "
SELECT name, primary_direction FROM categories
 WHERE lower(trim(name)) IN ('paypal','walmart+ charge','winter jackets') ORDER BY name;"
```
Expected: `Walmart+ Charge` and `Winter Jackets` are `(null)` — they were near-ties and must NOT have been guessed. The two `PayPal` rows differ: the one under `Fees` is `expense` (one-sided, $174.64 out), the one under `Transfer` is `neither` (the $11,000 internal movement).

- [ ] **Step 5: Verify re-running is a no-op**

Run the same `psql` command from Step 2 a second time, then re-run Step 3.
Expected: identical counts. The `IS NULL` guards make the second run change nothing.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260905000001_category_primary_direction.sql
git commit -m "feat(categories): add primary_direction column with usage-derived backfill"
```

---

### Task 2: Database types and Zod schema

**Files:**
- Modify: `types/database.ts` (the `categories` `Row` / `Insert` / `Update` blocks)
- Modify: `lib/validations/category.ts`
- Test: `lib/validations/category.test.ts`

**Interfaces:**
- Consumes: the column from Task 1.
- Produces: `CategoryDirection` type; `createCategorySchema` and `updateCategorySchema` each accept an optional `primary_direction` of `"income" | "expense" | "neither" | ""`.

`types/database.ts` is hand-edited on this branch rather than regenerated — keep it that way and edit by hand.

- [ ] **Step 1: Add the field to the generated types**

In `types/database.ts`, inside `categories`, add `primary_direction` to all three blocks, keeping the existing alphabetical ordering (it goes after `parent_id`):

```typescript
        Row: {
          // …existing fields…
          parent_id: string | null
          primary_direction: string | null
          updated_at: string | null
        }
        Insert: {
          // …existing fields…
          parent_id?: string | null
          primary_direction?: string | null
          updated_at?: string | null
        }
        Update: {
          // …existing fields…
          parent_id?: string | null
          primary_direction?: string | null
          updated_at?: string | null
        }
```

- [ ] **Step 2: Write the failing schema tests**

Append to `lib/validations/category.test.ts`:

```typescript
describe("primary_direction", () => {
  const base = {
    organization_id: "3f6b0e34-9f0a-4c0e-9a2a-1d3e5f7a9b1c",
    name: "Fundraisers",
  };

  it.each(["income", "expense", "neither"])("accepts %s", (dir) => {
    const result = createCategorySchema.safeParse({
      ...base,
      primary_direction: dir,
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty string as unset", () => {
    const result = createCategorySchema.safeParse({
      ...base,
      primary_direction: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts the field being absent entirely", () => {
    const result = createCategorySchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejects the retired 'both' spelling", () => {
    const result = createCategorySchema.safeParse({
      ...base,
      primary_direction: "both",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an arbitrary value", () => {
    const result = createCategorySchema.safeParse({
      ...base,
      primary_direction: "transfer",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run lib/validations/category.test.ts`
Expected: the `rejects` cases FAIL (an unknown key is currently stripped, so parsing succeeds).

- [ ] **Step 4: Add the field to the schemas**

In `lib/validations/category.ts`, add the exported type and the field on `createCategorySchema` (`updateCategorySchema` extends it and needs no separate change):

```typescript
export const CATEGORY_DIRECTIONS = ["income", "expense", "neither"] as const;
export type CategoryDirection = (typeof CATEGORY_DIRECTIONS)[number];

export const createCategorySchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  name: z
    .string()
    .min(1, "Category name is required.")
    .max(100, "Category name must be 100 characters or fewer."),
  parent_id: z
    .string()
    .uuid("Invalid parent category ID.")
    .optional()
    .or(z.literal("")),
  // Empty string is how an unset <Select> arrives from FormData; it is
  // normalised to SQL NULL in the action, matching parent_id.
  primary_direction: z
    .enum(CATEGORY_DIRECTIONS, {
      message: "Direction must be income, expense, or neither.",
    })
    .optional()
    .or(z.literal("")),
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/validations/category.test.ts`
Expected: PASS, all cases.

- [ ] **Step 6: Commit**

```bash
git add types/database.ts lib/validations/category.ts lib/validations/category.test.ts
git commit -m "feat(categories): type and validate primary_direction"
```

---

### Task 3: Pure grouping function

**Files:**
- Create: `lib/categories/group-by-direction.ts`
- Test: `lib/categories/group-by-direction.test.ts`

**Interfaces:**
- Consumes: nothing. Deliberately independent of Task 2 — it accepts the widened `string | null` that the database types produce, so it can be written and tested in any order.
- Produces: `groupCategoriesByDirection<T extends GroupableCategory>(categories: T[]): CategoryDirectionGroup<T>[]` and the exported types `GroupableCategory`, `CategoryDirectionGroup`, `CategoryDirectionGroupKey`.

- [ ] **Step 1: Write the failing tests**

Create `lib/categories/group-by-direction.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/categories/group-by-direction.test.ts`
Expected: FAIL — `Cannot find module './group-by-direction'`.

- [ ] **Step 3: Write the implementation**

Create `lib/categories/group-by-direction.ts`:

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/categories/group-by-direction.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/categories/group-by-direction.ts lib/categories/group-by-direction.test.ts
git commit -m "feat(categories): add pure direction-grouping helper"
```

---

### Task 4: Persist the label in server actions

**Files:**
- Modify: `app/(dashboard)/organizations/[orgId]/categories/actions.ts` (`createCategory`, `createCategoryInline`, `updateCategory`)
- Test: `app/(dashboard)/organizations/[orgId]/categories/actions.test.ts`

**Interfaces:**
- Consumes: `createCategorySchema` / `updateCategorySchema` from Task 2.
- Produces: all three actions read `primary_direction` from `FormData` and write `null` when it is absent or empty.

- [ ] **Step 1: Write the failing tests**

Append this inside the existing top-level `describe("category actions", …)` block, so it picks up that block's `beforeEach`, `makeFormData`, `mockSupabase`, `orgId` and `catId`. Both actions end in `redirect()`, which the test mocks turn into a thrown `RedirectError` — so each test asserts the rejection first, then inspects the captured payload.

```typescript
  describe("primary_direction persistence", () => {
    const CHAIN_METHODS = [
      "select", "insert", "update", "delete", "eq", "in", "is", "order", "limit",
    ];

    function makeChain(): Record<string, ReturnType<typeof vi.fn>> {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      for (const m of CHAIN_METHODS) chain[m] = vi.fn(() => chain);
      Object.defineProperty(chain, "then", {
        value: (
          resolve?: (v: unknown) => unknown,
          reject?: (r: unknown) => unknown
        ) => Promise.resolve({ data: null, error: null }).then(resolve, reject),
        writable: true,
        configurable: true,
      });
      return chain;
    }

    /** Sequence for createCategory without a parent: org check, then insert. */
    function captureInsert() {
      const insertSpy = vi.fn();
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain = makeChain();
        if (callCount === 1) {
          chain.single = vi.fn(() =>
            Promise.resolve({ data: { id: orgId }, error: null })
          );
        } else {
          chain.insert = vi.fn((payload: unknown) => {
            insertSpy(payload);
            return chain;
          });
          chain.single = vi.fn(() =>
            Promise.resolve({ data: { id: catId }, error: null })
          );
        }
        return chain;
      });
      return insertSpy;
    }

    /** Sequence for updateCategory: org check, current category, then update. */
    function captureUpdate() {
      const updateSpy = vi.fn();
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain = makeChain();
        if (callCount === 1) {
          chain.single = vi.fn(() =>
            Promise.resolve({ data: { id: orgId }, error: null })
          );
        } else if (callCount === 2) {
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: { id: catId, parent_id: null },
              error: null,
            })
          );
        } else {
          chain.update = vi.fn((payload: unknown) => {
            updateSpy(payload);
            return chain;
          });
        }
        return chain;
      });
      return updateSpy;
    }

    it("writes the selected direction on create", async () => {
      const insertSpy = captureInsert();
      const fd = makeFormData({
        organization_id: orgId,
        name: "Fundraisers",
        primary_direction: "income",
      });

      await expect(createCategory(null, fd)).rejects.toBeInstanceOf(
        RedirectError
      );
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ primary_direction: "income" })
      );
    });

    it("writes null when the direction is left unset", async () => {
      const insertSpy = captureInsert();
      const fd = makeFormData({
        organization_id: orgId,
        name: "Undecided",
        primary_direction: "",
      });

      await expect(createCategory(null, fd)).rejects.toBeInstanceOf(
        RedirectError
      );
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ primary_direction: null })
      );
    });

    it("writes null when the field is absent entirely", async () => {
      const insertSpy = captureInsert();
      const fd = makeFormData({ organization_id: orgId, name: "No Field" });

      await expect(createCategory(null, fd)).rejects.toBeInstanceOf(
        RedirectError
      );
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ primary_direction: null })
      );
    });

    it("rejects a value outside the allowed set", async () => {
      const fd = makeFormData({
        organization_id: orgId,
        name: "Bad",
        primary_direction: "both",
      });

      const result = await createCategory(null, fd);
      expect(result?.error).toBeDefined();
    });

    it("updates the direction on an existing category", async () => {
      const updateSpy = captureUpdate();
      const fd = makeFormData({
        id: catId,
        organization_id: orgId,
        name: "Transfer",
        primary_direction: "neither",
      });

      await expect(updateCategory(null, fd)).rejects.toBeInstanceOf(
        RedirectError
      );
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ primary_direction: "neither" })
      );
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(dashboard)/organizations/[orgId]/categories/actions.test.ts"`
Expected: FAIL — the insert payload has no `primary_direction` key.

- [ ] **Step 3: Read the field in all three actions**

In `createCategory`, extend the `raw` object and the insert payload:

```typescript
  const raw = {
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    parent_id: (formData.get("parent_id") as string) ?? "",
    primary_direction: (formData.get("primary_direction") as string) ?? "",
  };
```

```typescript
    .insert({
      organization_id: parsed.data.organization_id,
      name: parsed.data.name,
      parent_id: parentId,
      // "" (nothing selected) becomes SQL NULL, same as parent_id.
      primary_direction: parsed.data.primary_direction || null,
    })
```

Apply the identical two changes to `createCategoryInline`.

In `updateCategory`, extend `raw` the same way and extend the update payload:

```typescript
    .update({
      name: parsed.data.name,
      primary_direction: parsed.data.primary_direction || null,
    })
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/(dashboard)/organizations/[orgId]/categories/actions.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/organizations/[orgId]/categories/actions.ts" "app/(dashboard)/organizations/[orgId]/categories/actions.test.ts"
git commit -m "feat(categories): persist primary_direction from category forms"
```

---

### Task 5: Group the categories page into sections

**Files:**
- Modify: `app/(dashboard)/organizations/[orgId]/categories/page.tsx`

**Interfaces:**
- Consumes: `groupCategoriesByDirection` from Task 3.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace the hierarchy building with grouping**

In `page.tsx`, delete the `parents` / `childrenMap` block and the `CategorySection` component's `parents` + `childrenMap` props. Import the helper:

```typescript
import { groupCategoriesByDirection } from "@/lib/categories/group-by-direction";
```

Replace the hierarchy block with:

```typescript
  const allCategories = categories ?? [];
  const groups = groupCategoriesByDirection(allCategories);
```

Replace the single `<CategorySection …>` render with one section per group:

```tsx
        <div className="mt-6 flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-1 text-lg font-semibold">{group.title}</h2>
              {group.key === "unclassified" && (
                <p className="mb-3 text-sm text-muted-foreground">
                  These categories have no direction set yet. Open one to label
                  it as income, expense, or neither.
                </p>
              )}
              {group.key === "neither" && (
                <p className="mb-3 text-sm text-muted-foreground">
                  Money moved between accounts your organization owns. Counted
                  as neither income nor expense.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.parents.map(({ parent, children }) => (
                  <Card key={parent.id}>
                    <CardHeader className="pb-2">
                      <Link
                        href={`/organizations/${orgId}/categories/${parent.id}`}
                        className="hover:underline"
                      >
                        <CardTitle className="text-base">
                          {parent.name}
                        </CardTitle>
                      </Link>
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
                ))}
              </div>
            </section>
          ))}
        </div>
```

Delete the now-unused `CategorySection` function entirely.

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors. One pre-existing error in `lib/excel/generate-report.test.ts` about `Buffer<ArrayBufferLike>` is baseline noise and is not yours to fix.

- [ ] **Step 3: Verify it renders against real data**

With the local stack running and `.env.local` pointing at it, run `npm run dev` and open
`http://localhost:3000/organizations/<orgId>/categories` for the Corydon organization.

Expected: four headed sections. `Income` contains `Funding`, `Student Fees`, `Fundraisers`. `Expense` contains `Staff Payments`, `Supplies`, `Vanguard` and others. `Transfers` contains `Transfer` alone. `Unclassified` contains `Other` and `Donations`. Every parent appears exactly once.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/organizations/[orgId]/categories/page.tsx"
git commit -m "feat(categories): group the categories page by primary_direction"
```

---

### Task 6: Direction control on the category forms

**Files:**
- Modify: `app/(dashboard)/organizations/[orgId]/categories/category-form.tsx`
- Modify: `app/(dashboard)/organizations/[orgId]/categories/create-category-dialog.tsx`
- Modify: `app/(dashboard)/organizations/[orgId]/categories/[categoryId]/category-actions.tsx`
- Modify: `app/(dashboard)/organizations/[orgId]/categories/[categoryId]/page.tsx`

**Interfaces:**
- Consumes: the actions from Task 4.
- Produces: nothing consumed by later tasks.

These are client components using `useActionState`. The `Select` from shadcn/ui does not post a value on its own, so each form needs a hidden input carrying the selected value — the same pattern `category-form.tsx` already uses for `parent_id`.

- [ ] **Step 1: Add the control to `category-form.tsx`**

Add state beside the existing `useState` calls:

```typescript
  const [direction, setDirection] = useState("");
```

Add the hidden input next to the existing `parent_id` hidden input:

```tsx
            <input type="hidden" name="primary_direction" value={direction} />
```

Add the field after the Category Name block:

```tsx
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="primary_direction">Direction (optional)</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger id="primary_direction">
                  <SelectValue placeholder="Leave unset for now" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="neither">
                    Neither (transfers between your accounts)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Groups this category on the categories page. It does not limit
                which transactions can use it — any category can take both
                income and expenses.
              </p>
            </div>
```

That helper text is required, not decorative: a select labelled "Direction" reads like a restriction, and the entire design rests on it not being one.

- [ ] **Step 2: Add the same control to `create-category-dialog.tsx`**

Repeat Step 1 verbatim in the dialog: the `direction` state, the hidden `primary_direction` input beside the existing hidden inputs, and the same `Select` block with the same helper text, placed after the name input. The dialog already imports `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`; if any are missing, add them from `@/components/ui/select`.

Reset it alongside the dialog's existing post-submit reset so a second inline creation does not inherit the previous choice:

```typescript
      setDirection("");
```

- [ ] **Step 3: Add the control to the edit dialog in `category-actions.tsx`**

The rename dialog posts to `updateCategory`. Seed the state from the category's current value so opening the dialog and saving does not silently blank the label:

```typescript
  const [direction, setDirection] = useState(category.primary_direction ?? "");
```

Inside the rename `<form action={…}>`, beside the existing hidden inputs:

```tsx
              <input type="hidden" name="primary_direction" value={direction} />
```

And the same `Select` block from Step 1, after the name input, with the same helper text.

- [ ] **Step 4: Show the current label on the category detail page**

The grouped list places a child by its *parent's* label, so a child viewed on
its own is the one place its own label is visible. Without this the backfill
labels children invisibly.

In `[categoryId]/page.tsx`, alongside the existing category metadata, render:

```tsx
        <p className="text-sm text-muted-foreground">
          Direction:{" "}
          {category.primary_direction === "income"
            ? "Income"
            : category.primary_direction === "expense"
              ? "Expense"
              : category.primary_direction === "neither"
                ? "Neither (transfer)"
                : "Not set"}
        </p>
```

Ensure the page's `select` includes the column — if it uses an explicit column
list rather than `*`, add `primary_direction` to it.

- [ ] **Step 5: Verify typecheck and full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new tsc errors beyond the baseline `Buffer` one; all tests pass.

- [ ] **Step 6: Verify the round trip against real data**

With `npm run dev` running:
1. Open `Other` (currently Unclassified) on the Corydon categories page.
2. Set its direction to Income and save.
3. Return to the categories page.

Expected: `Other` now appears under Income and no longer under Unclassified. Confirm in the database:
```bash
docker exec -i supabase_db_treasurer psql -U postgres -d postgres -c \
  "SELECT name, primary_direction FROM categories WHERE lower(trim(name))='other' AND parent_id IS NULL;"
```
Expected: `income`.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/organizations/[orgId]/categories/category-form.tsx" "app/(dashboard)/organizations/[orgId]/categories/create-category-dialog.tsx" "app/(dashboard)/organizations/[orgId]/categories/[categoryId]/category-actions.tsx" "app/(dashboard)/organizations/[orgId]/categories/[categoryId]/page.tsx"
git commit -m "feat(categories): let treasurers set a category's direction"
```

---

## Verification

After all six tasks:

- [ ] `npx vitest run` — all suites pass
- [ ] `npx tsc --noEmit` — only the pre-existing `generate-report.test.ts` `Buffer` error
- [ ] `npm run lint` — only the two pre-existing `dashboard-shell.tsx` set-state-in-effect errors
- [ ] Categories page shows four sections with every parent appearing exactly once
- [ ] A category labelled `income` still accepts an expense transaction — pick any category, create an expense against it, and confirm the transaction form never filtered it out and the save succeeds. This is the single most important check in the plan: if it fails, the label has become a constraint and the design is broken.
