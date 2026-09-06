# Category Primary Direction — Design

> **Status:** Draft, awaiting review
> **Date:** September 5, 2026
> **Amends:** Decision 1 of [2026-08-26-untyped-categories-design.md](./2026-08-26-untyped-categories-design.md)

---

## 1. Problem

The untyped-categories work removed `categories.category_type` so that a single
category could absorb traffic in both directions — a fundraiser's revenue and
its cost of goods under one name. That part is working: 12 of 29 parent
categories in production data carry real activity on both sides.

What went with it was the treasurer's ability to *say what a category is*. The
categories page on `main` had "Income Categories" and "Expense Categories"
sections; the branch replaced them with one undifferentiated list of 138 rows.
Losing the constraint also lost the label.

These are separable concerns, and the earlier design conflated them:

| Concern | Where it belongs |
|---------|------------------|
| Which direction did this money actually move? | `transactions.transaction_type` — unchanged |
| What kind of thing is this category? | A label the treasurer sets — reintroduced here |

Decision 1 of the untyped design said `category_type` is "removed, not made
nullable." That reasoning was sound *for a constraint* — a type that filtered
dropdowns and blocked cross-type merges. It does not extend to a label that
constrains nothing.

## 2. Decisions

1. **`categories.primary_direction` is a label, never a constraint.** It does
   not filter category dropdowns, does not restrict which transactions may use
   the category, and does not participate in merge validation. Any category
   remains usable in either direction.
2. **New column name, not the old one.** Resurrecting `category_type` with
   inverted semantics would mislead every reader who knew the old meaning, and
   the codebase still carries the old name in git history and tests.
3. **Values are `income | expense | neither`, nullable.** `neither` exists for
   internal transfers, which are genuinely non-directional. `NULL` means "not
   yet decided" and nothing else — the two meanings are kept distinct so the
   Unclassified group stays a real to-do list.
4. **One list.** A category appears exactly once, in the section its label
   names. No duplication across sections, no second list to maintain.
5. **Backfill is derived from actual usage, with parent roll-up**, and declines
   to guess when the data is genuinely two-sided. See §4.
6. **Transfers are labeled, not detected.** The schema has no transfer concept
   (`transaction_type` is `CHECK (income, expense)`, with no linked-transaction
   or counterpart-account column). Whether the far side of a transfer is an
   org-owned account is not recorded anywhere, so it cannot be computed. The
   treasurer's label carries that knowledge: internal transfers are `neither`,
   transfers leaving to an outside account stay `NULL` for a case-by-case call.

Decision 6 is the scope boundary. Modeling transfers properly — a transfer
transaction type, or a linked counterpart column — is a separate feature and is
not attempted here. See §7.

## 3. Data Model

```sql
ALTER TABLE public.categories
  ADD COLUMN primary_direction TEXT
  CHECK (primary_direction IN ('income', 'expense', 'neither'));
```

Nullable, no default. Absence means undecided.

`merge_categories` needs no change: the surviving category keeps its own label,
and the source category is deleted. A merge never has to reconcile two
directions because the label constrains nothing.

The `idx_categories_unique_active_name` index is unaffected — uniqueness is
still `(organization_id, parent_id, lower(trim(name)))` over active rows.

## 4. Backfill

Run once, inside the migration.

**Roll-up first.** Transactions attach to child categories, so a parent's own
line items are usually empty. Classifying parents on their own activity alone
would leave ~20 of 29 parents `NULL` — precisely the level the categories page
groups by. A parent's totals are therefore its own activity plus its children's.

**Then dominance, with an abstention rule.** For each category, compare income
total against expense total:

| Condition | Assignment |
|-----------|------------|
| No activity at all | `NULL` |
| Minority side ≥ 40% of majority side | `NULL` — genuinely two-sided, treasurer decides |
| Otherwise | The dominant side |

The 40% abstention is the point of the backfill. Amount dominance is a weak
signal near parity: production data has `Walmart+ Charge` at $164.51 / $162.99
and `PayPal` at exactly $11,000.00 / $11,000.00. Breaking those ties by
comparison operator produces labels that are wrong and, worse, silently wrong.
An unset label is visible in the UI; an incorrect one is not.

**Then the explicit overrides**, decided during review of the full 138-row
assignment:

| Category | Label | Why |
|----------|-------|-----|
| `Fundraisers` (CIS PTO) | `income` | Nets +$21,518. A revenue activity whose expenses are cost of goods — the exact case untyped categories exists to serve. |
| `Fundraisers` (Corydon) | `income` | Nets +$5,634. Same reasoning. |
| `Other` (Corydon) | `NULL` | A $225 / $163 catch-all with no identity to declare. |
| `Transfer` and `Transfer › PayPal` | `neither` | The only transfer activity is one internal movement: $11,000 PayPal → First Harrison Bank, same date, paired. |

Expected result on production data: 20 parents labeled from dominance, 2 from
override, 1 `neither`, and the rest `NULL` pending the treasurer.

The backfill is **not idempotent and must not be re-run** — it would relabel
categories the treasurer has since corrected by hand. It is guarded to touch
only rows where `primary_direction IS NULL`, which makes a second run a no-op
against corrected data.

## 5. UI

**Categories page** (`app/(dashboard)/organizations/[orgId]/categories/page.tsx`)
groups parents into four sections in this order: **Income**, **Expense**,
**Transfers**, **Unclassified**. Empty sections are not rendered. Children stay
nested under their parent and are not independently grouped — the parent's label
determines placement, so the hierarchy the treasurer built is preserved.

Children are still labeled by the backfill even though grouping ignores them.
A child's label is what makes a future report grouping (§7) meaningful, and it
is shown on the category detail page, where a child is viewed on its own and
its parent's label says nothing about it. A child whose label disagrees with its
parent's is expected, not a defect: `Student Fees › Vanguard` is income while
the `Vanguard` parent rolls up to expense on uniform and competition costs.

The Unclassified section leads with a short line of explanation, since it is a
work queue rather than a category kind.

**Category form** (`category-form.tsx`, `create-category-dialog.tsx`) gains an
optional direction select: Income / Expense / Neither / (leave unset). The
helper text states that this labels the category for organizing and reporting
and does not restrict which transactions can use it — the distinction is the
whole design and will not be obvious from a select labeled "direction."

**Transaction form dropdowns are not touched.** Decision 3 of the untyped design
removed directional filtering from category selection, and grouping the dropdown
by label would quietly reintroduce the same bias at data-entry time.

## 6. Testing

Bucketing logic is extracted to `lib/categories/group-by-direction.ts` as a pure
function over already-fetched categories, so it is unit-testable without a
database or a rendered tree:

- parents group by their own label; children follow their parent regardless of
  their own label
- each section omitted when empty
- `neither` routes to Transfers, `NULL` to Unclassified — never conflated
- ordering within a section is unchanged from current alphabetical behavior

Backfill correctness is verified against the loaded production snapshot rather
than fixtures, since the interesting cases are real: the $11,000 tie, the
sub-$2 near-parity rows, and the parent roll-up that turns ~20 `NULL` parents
into 3.

Zod schema (`lib/validations/category.ts`) accepts the three values plus null
and rejects anything else, including the old `'both'` spelling.

## 7. Out of Scope

- **Modeling transfers properly.** A `transfer` transaction type or a linked
  counterpart column would let the app distinguish internal from external
  movement instead of relying on a label. Larger change; ripples into
  reconciliation, running balances, and account balance math.
- **Grouping reports by direction.** The Excel and PDF summaries already render
  one row per category with In / Out / Net columns, which is independent of this
  label. Sectioning those by `primary_direction` is a reasonable follow-up once
  the labels have settled in real use.
- **Backfilling from pre-migration `category_type`.** Rejected during review:
  for the 12 merged pairs both an income and an expense half existed, so the
  survivor's original type is an artifact of sort order, not a decision.
