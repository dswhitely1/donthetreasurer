# Budget Tracking - Product Requirements Document

> **Version:** 1.0
> **Status:** Draft
> **Last Updated:** February 2, 2026
> **Parent Document:** [PRD.md](./PRD.md) v1.4

---

## 1. Executive Summary

Add budget planning and tracking to Treasurer, allowing treasurers to create one or more budgets per fiscal year for each organization. Budgets define expected income and expense amounts by category for a date range. The system compares budgeted amounts against actual transactions to produce a Budget vs. Actuals report, giving board members and treasurers clear visibility into financial performance against plan.

---

## 2. Problem Statement

Nonprofit treasurers frequently present budgets to their boards for approval — sometimes a single annual budget, sometimes seasonal budgets (e.g., "Fall Budget" and "Spring Budget"). Today, Treasurer has no way to record these approved budgets or compare them against actual income and expenses. Treasurers resort to separate spreadsheets to track budget performance, creating extra work and the risk of errors when numbers are manually reconciled between systems.

---

## 3. Goals and Objectives

### 3.1 Primary Goals

- Allow treasurers to define multiple budgets per fiscal year with custom date ranges
- Support budget amounts at the category level (parent or subcategory)
- Provide a Budget vs. Actuals view showing variance per category
- Include budget data in Excel and PDF report exports

### 3.2 Success Metrics

- Treasurer can create a budget and assign category amounts in under 5 minutes
- Budget vs. Actuals report generates in under 5 seconds
- Budget data exports cleanly alongside existing transaction reports

---

## 4. User Stories

| ID | Story | Priority |
|----|-------|----------|
| BUD-US-01 | As a treasurer, I want to create a named budget for a specific date range so I can plan expected income and expenses for that period. | Must Have |
| BUD-US-02 | As a treasurer, I want to assign budgeted amounts to individual categories (parent or subcategory) so I can plan at the right level of detail. | Must Have |
| BUD-US-03 | As a treasurer, I want to see a Budget vs. Actuals view comparing my budgeted amounts to real transaction totals so I know if we're on track. | Must Have |
| BUD-US-04 | As a treasurer, I want to have multiple budgets within the same fiscal year (e.g., Fall and Winter) so I can match how my board approves budgets. | Must Have |
| BUD-US-05 | As a treasurer, I want to copy a previous budget as a starting point for a new one so I don't have to re-enter all the category amounts. | Should Have |
| BUD-US-06 | As a treasurer, I want budget variance data included in my Excel/PDF reports so I can share a single comprehensive document with my board. | Should Have |
| BUD-US-07 | As a treasurer, I want to mark a budget as draft or active so I can work on it before presenting it to the board. | Should Have |
| BUD-US-08 | As a treasurer, I want to see a progress bar or visual indicator for each budget category showing how much of the budget has been used. | Could Have |

---

## 5. Functional Requirements

### 5.1 Budget Management

| ID | Requirement | Priority |
|----|-------------|----------|
| BUD-001 | Treasurer shall be able to create a budget for an organization with a name, start date, and end date | Must Have |
| BUD-002 | Budget date ranges shall be validated: start date must be before end date | Must Have |
| BUD-003 | Multiple budgets shall be allowed within the same fiscal year | Must Have |
| BUD-004 | Budget date ranges may overlap (e.g., an annual budget and a seasonal budget can coexist) | Must Have |
| BUD-005 | Each budget shall have a status: `draft`, `active`, or `closed` | Should Have |
| BUD-006 | Treasurer shall be able to edit a budget's name, dates, and status | Must Have |
| BUD-007 | Treasurer shall be able to delete a budget (with confirmation) | Must Have |
| BUD-008 | Treasurer shall be able to duplicate an existing budget, copying all line items with a new name and date range | Should Have |
| BUD-009 | The budget list shall display the fiscal year each budget falls within, derived from the organization's `fiscal_year_start_month` and the budget's start date | Should Have |

### 5.2 Budget Line Items

| ID | Requirement | Priority |
|----|-------------|----------|
| BLI-001 | Each budget shall contain budget line items, each assigning a dollar amount to a category | Must Have |
| BLI-002 | Budget line items shall reference categories from the same organization | Must Have |
| BLI-003 | Budget line items may reference either a parent category or a subcategory | Must Have |
| BLI-004 | A category shall appear at most once per budget (no duplicates) | Must Have |
| BLI-005 | Budget line item amounts shall be positive decimal values (DECIMAL 12,2) | Must Have |
| BLI-006 | Each budget line item shall have an optional notes/memo field | Should Have |
| BLI-007 | The system shall display subtotals for income and expense line items within a budget | Must Have |
| BLI-008 | When a budget references a parent category, actuals shall be computed as the sum of all subcategory transactions under that parent | Must Have |
| BLI-009 | When a budget references a subcategory, actuals shall be computed from transactions assigned to that specific subcategory only | Must Have |

### 5.3 Budget vs. Actuals

| ID | Requirement | Priority |
|----|-------------|----------|
| BVA-001 | System shall compute actual totals for each budgeted category by summing transaction line item amounts within the budget's date range | Must Have |
| BVA-002 | Actual totals shall include transactions of all statuses (uncleared, cleared, reconciled) by default | Must Have |
| BVA-003 | System shall compute variance as `budgeted - actual` for expenses and `actual - budgeted` for income (positive = favorable) | Must Have |
| BVA-004 | System shall compute variance percentage as `(actual / budgeted) * 100` | Must Have |
| BVA-005 | Budget vs. Actuals view shall display: category name, budgeted amount, actual amount, variance ($), variance (%), and a visual progress indicator | Must Have |
| BVA-006 | Budget vs. Actuals shall group line items by income and expense, with subtotals for each group | Must Have |
| BVA-007 | The view shall highlight over-budget items (negative variance) with a visual indicator (e.g., red text or warning icon) | Should Have |
| BVA-008 | Treasurer shall be able to filter the actuals computation by transaction status (e.g., only cleared + reconciled) | Could Have |

### 5.4 Reporting Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| BRP-001 | Budget vs. Actuals data shall be exportable as an additional worksheet in the Excel report | Should Have |
| BRP-002 | Budget vs. Actuals data shall be exportable as an additional page in the PDF report | Should Have |
| BRP-003 | The report parameters page shall allow selecting a budget to include in the export | Should Have |
| BRP-004 | The budget report worksheet shall include: category, budgeted, actual, variance ($), variance (%) columns | Should Have |

---

## 6. Data Model

### 6.1 Entity Relationships

```
Organization (1) ── defines ──> (Many) Budgets
Budget (1) ─────── contains ──> (Many) Budget Line Items
Budget Line Item (Many) ── references ─> (1) Category
```

Integrated into the full domain model:

```
Treasurer (1) → (Many) Organizations → (Many) Budgets → (Many) Budget Line Items
                                     → (Many) Categories ← Budget Line Items reference
                                     → (Many) Accounts → (Many) Transactions → (Many) Line Items
```

### 6.2 Entity Definitions

#### Budget

```
- id: UUID (primary key, default uuid_generate_v4())
- organization_id: UUID (foreign key → Organization, NOT NULL)
- name: String (required, max 150 characters)
- start_date: Date (required)
- end_date: Date (required)
- status: Enum ['draft', 'active', 'closed'] (default: 'draft')
- notes: Text (optional) — general notes about this budget
- created_at: Timestamp (default NOW())
- updated_at: Timestamp (default NOW())

CONSTRAINTS:
- start_date < end_date (CHECK constraint)
- organization_id + name must be unique within the same organization
```

#### Budget Line Item

```
- id: UUID (primary key, default uuid_generate_v4())
- budget_id: UUID (foreign key → Budget, NOT NULL, ON DELETE CASCADE)
- category_id: UUID (foreign key → Category, NOT NULL, ON DELETE RESTRICT)
- amount: Decimal(12,2) (required, > 0)
- notes: Text (optional) — notes for this specific line
- created_at: Timestamp (default NOW())
- updated_at: Timestamp (default NOW())

CONSTRAINTS:
- budget_id + category_id must be unique (no duplicate categories per budget)
- amount > 0
```

### 6.3 Database Schema

```sql
-- Budgets table
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (start_date < end_date),
  UNIQUE (organization_id, name)
);

-- Budget Line Items table
CREATE TABLE public.budget_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (budget_id, category_id)
);

-- Indexes
CREATE INDEX idx_budgets_organization ON public.budgets(organization_id);
CREATE INDEX idx_budgets_dates ON public.budgets(organization_id, start_date, end_date);
CREATE INDEX idx_budget_line_items_budget ON public.budget_line_items(budget_id);
CREATE INDEX idx_budget_line_items_category ON public.budget_line_items(category_id);

-- Row Level Security
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access budgets in their organizations" ON public.budgets
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access budget line items in their budgets" ON public.budget_line_items
  FOR ALL USING (
    budget_id IN (
      SELECT b.id FROM public.budgets b
      JOIN public.organizations o ON b.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );

-- Updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.budget_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 7. User Interface Requirements

### 7.1 Navigation

- Add **"Budgets"** to the sidebar navigation between "Templates" and "Reports"
- Route: `/organizations/[orgId]/budgets`

### 7.2 Budget List Page

**Route:** `/organizations/[orgId]/budgets`

**Layout:**
- Page title: "Budgets"
- "New Budget" action button
- List of budgets as cards or table rows

**Each budget entry displays:**

| Field | Display |
|-------|---------|
| Name | Budget name (link to detail page) |
| Date Range | "Jan 1, 2026 – Jun 30, 2026" |
| Fiscal Year | Derived label, e.g., "FY 2026" |
| Status | Badge: Draft (gray), Active (green), Closed (blue) |
| Total Budgeted Income | Sum of income line items |
| Total Budgeted Expenses | Sum of expense line items |

**Sorting:** Most recent start date first (descending), then by name.

**Empty state:** "No budgets yet. Create your first budget to start tracking income and expenses against plan."

### 7.3 Budget Create / Edit Form

**Route:** `/organizations/[orgId]/budgets/new` and `/organizations/[orgId]/budgets/[budgetId]/edit`

**Budget Header Fields:**

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| Name | Text input | Yes | - | Max 150 chars. E.g., "FY 2026 Annual Budget", "Fall 2025 Budget" |
| Start Date | Date picker | Yes | First day of current fiscal year | |
| End Date | Date picker | Yes | Last day of current fiscal year | |
| Status | Select | Yes | Draft | Draft / Active / Closed |
| Notes | Textarea | No | - | General notes about this budget |

**Preset date range buttons** (same fiscal year logic as reports):
- Current Fiscal Year
- Previous Fiscal Year
- Current Quarter
- Custom (manual entry)

**Budget Line Items Section:**

Below the header, a table/form for adding category budget amounts:

| Column | Type | Notes |
|--------|------|-------|
| Category | Hierarchical dropdown | Shows "Parent → Child" format; grouped by income/expense |
| Amount | Currency input | Positive values only |
| Notes | Text input | Optional per-line note |
| Remove | Button | Remove this line item |

- "Add Line Item" button to add rows
- Categories already used in this budget are excluded from the dropdown
- Income and Expense line items are grouped with subtotals:
  - **Total Budgeted Income:** $X,XXX.XX
  - **Total Budgeted Expenses:** $X,XXX.XX
  - **Net Budget:** $X,XXX.XX (income - expenses)

**"Copy from Budget" action** (on create form): Select an existing budget to pre-populate all line items. Treasurer then adjusts amounts and dates.

### 7.4 Budget Detail / Budget vs. Actuals Page

**Route:** `/organizations/[orgId]/budgets/[budgetId]`

This is the primary view — the Budget vs. Actuals comparison.

**Header:**
- Budget name, date range, status badge
- Action buttons: Edit, Duplicate, Delete
- Overall summary cards:

| Card | Value |
|------|-------|
| Budgeted Income | Sum of income line items |
| Actual Income | Sum of actual income transactions in date range |
| Budgeted Expenses | Sum of expense line items |
| Actual Expenses | Sum of actual expense transactions in date range |
| Net Budget | Budgeted income - budgeted expenses |
| Net Actual | Actual income - actual expenses |

**Income Section:**

Table with columns:

| Column | Description |
|--------|-------------|
| Category | "Parent → Subcategory" label |
| Budgeted | The budgeted amount |
| Actual | Sum of actual transaction line items for this category within the budget date range |
| Variance ($) | `actual - budgeted` (positive = favorable for income) |
| Variance (%) | `(actual / budgeted) × 100` or "—" if budgeted is 0 |
| Progress | Visual bar showing actual / budgeted ratio |

- Row highlighting: green if actual >= budgeted (income met), amber/red if actual < budgeted
- Subtotal row at bottom

**Expense Section:**

Same table structure, but variance logic is inverted:
- Variance ($): `budgeted - actual` (positive = favorable, meaning under budget)
- Row highlighting: green if actual <= budgeted (under budget), amber/red if actual > budgeted (over budget)
- Subtotal row at bottom

**Unbudgeted Actuals Section** (optional, displayed if transactions exist for categories not in the budget):
- Lists categories with actual spending/income that were not budgeted
- Helps treasurer identify categories they may want to add to the budget

### 7.5 Dashboard Integration

On the organization overview page (`/organizations/[orgId]`), if active budgets exist:

- Add a **"Budget Snapshot"** card showing the currently active budget(s)
- Display: budget name, % of budgeted expenses used, % of budgeted income received
- Link to the full Budget vs. Actuals page

---

## 8. Budget vs. Actuals Computation Logic

### 8.1 Actuals Calculation

For each budget line item with `category_id`:

1. **If the category is a subcategory** (has a `parent_id`):
   - Sum `transaction_line_items.amount` where `category_id` matches AND the parent transaction's `transaction_date` falls within `[budget.start_date, budget.end_date]`

2. **If the category is a parent category** (no `parent_id`, or `parent_id IS NULL`):
   - Sum `transaction_line_items.amount` where `category_id` matches the parent OR any of its child categories AND the parent transaction's `transaction_date` falls within `[budget.start_date, budget.end_date]`

3. **Transaction type filtering:** Only include transactions where `transaction_type` matches the category's `category_type` (income categories only match income transactions, expense categories only match expense transactions)

4. **Status filtering (default):** Include all statuses (uncleared + cleared + reconciled). Optional filter to restrict to specific statuses.

### 8.2 Variance Calculation

```
For income categories:
  variance_amount = actual - budgeted
  favorable = variance_amount >= 0

For expense categories:
  variance_amount = budgeted - actual
  favorable = variance_amount >= 0

variance_percent = budgeted > 0 ? (actual / budgeted) * 100 : null
```

### 8.3 Unbudgeted Actuals

Query all transaction line items within the budget date range whose `category_id` does not appear in any budget line item for that budget. Group by category with totals. This helps treasurers identify missing budget categories.

---

## 9. Server Actions & API

### 9.1 Server Actions

Following the existing colocated pattern, budget actions will live at `app/(dashboard)/organizations/[orgId]/budgets/actions.ts`.

| Action | Input | Behavior |
|--------|-------|----------|
| `createBudget` | Budget header + line items array | Validates with Zod, inserts budget + line items in a single operation, revalidates path, redirects to budget detail |
| `updateBudget` | Budget ID + updated header + line items array | Validates, replaces all line items (delete + re-insert), revalidates path |
| `deleteBudget` | Budget ID | Confirms ownership, deletes budget (cascades to line items), revalidates path, redirects to budget list |
| `duplicateBudget` | Source budget ID + new name + new date range | Copies all line items from source budget into a new budget with draft status |
| `updateBudgetStatus` | Budget ID + new status | Updates status field only |

### 9.2 Zod Validation Schemas

**File:** `lib/validations/budget.ts`

```
budgetLineItemSchema:
  - category_id: UUID (required)
  - amount: positive number, max 2 decimal places
  - notes: string, max 500 chars (optional)

createBudgetSchema:
  - organization_id: UUID (required)
  - name: string, 1-150 chars (required)
  - start_date: YYYY-MM-DD string (required)
  - end_date: YYYY-MM-DD string (required)
  - status: enum ['draft', 'active', 'closed'] (default: 'draft')
  - notes: string, max 1000 chars (optional)
  - line_items: array of budgetLineItemSchema, min 1 item
  - Refinement: start_date < end_date
  - Refinement: no duplicate category_ids in line_items

updateBudgetSchema:
  - Extends createBudgetSchema with budget id

duplicateBudgetSchema:
  - source_budget_id: UUID (required)
  - name: string, 1-150 chars (required)
  - start_date: YYYY-MM-DD string (required)
  - end_date: YYYY-MM-DD string (required)
```

---

## 10. TanStack Query Integration

### 10.1 Query Keys

Add to `hooks/query-keys.ts`:

```
budgets:
  - ['budgets', orgId] — list all budgets for an org
  - ['budgets', orgId, budgetId] — single budget with line items
  - ['budgets', orgId, budgetId, 'actuals'] — budget vs. actuals data
```

### 10.2 Hooks

**File:** `hooks/use-budgets.ts`

| Hook | Purpose |
|------|---------|
| `useBudgets(orgId)` | Fetch all budgets for an organization |
| `useBudget(orgId, budgetId)` | Fetch a single budget with its line items |
| `useBudgetActuals(orgId, budgetId, options?)` | Fetch computed actuals for a budget (status filter option) |

---

## 11. Excel / PDF Export Integration

### 11.1 Excel: Budget vs. Actuals Worksheet

When a budget is selected in report parameters, add a third worksheet **"Budget vs Actuals"** to the Excel export:

**Header Section (Rows 1-5):**
```
Row 1: {Organization Name}
Row 2: Budget vs. Actuals: {Budget Name}
Row 3: {Budget Start Date} to {Budget End Date}
Row 4: Generated: {Current Date/Time}
Row 5: [blank]
```

**Column Definitions:**

| Column | Header | Format | Width |
|--------|--------|--------|-------|
| A | Category | Text | 35 |
| B | Budgeted | Currency ($#,##0.00) | 15 |
| C | Actual | Currency ($#,##0.00) | 15 |
| D | Variance ($) | Currency ($#,##0.00) | 15 |
| E | Variance (%) | Percentage (0.0%) | 12 |

**Data Rows:**
- **INCOME** header row (bold)
- Income category rows (indented for subcategories)
- Income subtotal row (bold)
- [blank row]
- **EXPENSES** header row (bold)
- Expense category rows (indented for subcategories)
- Expense subtotal row (bold)
- [blank row]
- **NET** summary row: budgeted net, actual net, net variance

**Conditional formatting:**
- Favorable variance cells: green fill
- Unfavorable variance cells: red fill

### 11.2 PDF: Budget vs. Actuals Page

Same structure as Excel but rendered as a landscape table using jspdf-autotable, following the existing PDF report pattern.

---

## 12. Route Structure

```
app/(dashboard)/organizations/[orgId]/budgets/
├── page.tsx                    # Budget list
├── actions.ts                  # Server Actions for budget CRUD
├── new/
│   └── page.tsx                # Create budget form
└── [budgetId]/
    ├── page.tsx                # Budget detail / Budget vs. Actuals view
    └── edit/
        └── page.tsx            # Edit budget form
```

---

## 13. Permissions & Security

- **RLS policies** follow the existing ownership chain: Budget → Organization → Treasurer. Only the owning treasurer can access budgets for their organizations.
- **ON DELETE RESTRICT** on `budget_line_items.category_id` prevents deleting a category that is referenced by a budget line item (consistent with transaction line items behavior).
- **ON DELETE CASCADE** from budgets to budget line items: deleting a budget removes all its line items.
- Budget data inherits the same `auth.uid()` validation pattern used by all other organization-scoped entities.

---

## 14. Edge Cases & Business Rules

| Scenario | Behavior |
|----------|----------|
| Category deleted that's in a budget | Blocked by `ON DELETE RESTRICT` — treasurer must remove it from the budget first |
| Category merged (via `merge_categories` RPC) | Budget line items referencing the source category are automatically reassigned to the target category. If the target already has a line item in the same budget, the amounts are summed. |
| Budget date range extends beyond fiscal year | Allowed — budgets are not strictly bound to fiscal year boundaries. The fiscal year label is informational only. |
| Two budgets for overlapping periods | Allowed — this is a core use case (annual + seasonal budgets). Each budget is independent. |
| Zero actual transactions for a budgeted category | Actual = $0.00, variance shows full budgeted amount as unused (favorable for expenses, unfavorable for income) |
| Transactions exist for categories not in the budget | Shown in the "Unbudgeted Actuals" section of the detail page |
| Budget line item for a parent category that also has subcategory line items in the same budget | Not allowed — validation prevents budgeting the same money twice. If a parent is budgeted, its children cannot be individually budgeted in the same budget, and vice versa. |

---

## 15. Future Considerations

These are out of scope for the initial implementation but may be considered later:

- **Budget amendments/versioning:** Track changes to an approved budget over time
- **Multi-year budget comparison:** Side-by-side view of the same budget period across years
- **Budget alerts/notifications:** Email or in-app alerts when a category exceeds its budget threshold
- **Budget approval workflow:** Multi-user support where board members can approve/reject budgets
- **Auto-populate from prior year actuals:** Pre-fill budget amounts based on the previous year's actual transactions
- **Monthly/quarterly budget breakdown:** Distribute an annual budget amount across months for more granular tracking

---

## 16. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | February 2, 2026 | Initial draft |

---

*End of Document*
