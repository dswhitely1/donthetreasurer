# UX Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Treasurer app from functional-but-cold to warm, cohesive, and intentionally designed — inspired by Notion's aesthetic.

**Architecture:** Four sequential layers — (1) warm color palette in globals.css, (2) typography/spacing normalization + PageHeader component, (3) CSS-only animations with transition tokens, (4) data presentation polish + EmptyState component + Sonner toast system. Each layer builds on the previous.

**Tech Stack:** Tailwind CSS 4, CSS custom properties (oklch), Sonner (toast library), Lucide React (icons), shadcn/ui components.

**Spec:** `docs/superpowers/specs/2026-04-04-ux-polish-pass-design.md`

---

## File Structure

### New Files
- `components/layout/page-header.tsx` — Reusable page title + description + action slot
- `components/ui/empty-state.tsx` — Empty state with icon, title, description, CTA

### Modified Files (by layer)

**Layer 1 — Color Palette:**
- `app/globals.css` — Warm neutrals + semantic financial tokens + transition tokens + keyframes
- `@theme inline` block updated with new Tailwind color mappings
- ~20 files with hardcoded green/red/yellow/blue color classes (see Task 2 for full list)

**Layer 2 — Typography & Spacing:**
- `components/layout/page-header.tsx` (new)
- ~21 page files adopting PageHeader + typography weight changes
- Card usages getting shadow + border-radius updates

**Layer 3 — Animations:**
- `app/globals.css` (transition tokens + keyframes already added in Layer 1)
- `components/ui/button.tsx` — active:scale-[0.98]
- `components/layout/sidebar.tsx` — spring easing on collapse
- Dashboard shell or page wrapper — fadeInUp animation class

**Layer 4 — Data & Experience:**
- `components/ui/empty-state.tsx` (new)
- ~13 pages with empty states adopting EmptyState component
- `components/providers.tsx` — add Sonner Toaster
- Transaction table — status badge pills, tabular-nums, row hover transition
- Dashboard page — summary card polish

---

## Task 1: Warm Color Palette — globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Create a feature branch**

```bash
git checkout -b feat/ux-polish-pass
```

- [ ] **Step 2: Update light mode base neutrals in globals.css**

In `app/globals.css`, replace the `:root` block's neutral tokens (lines 49-82). Change these specific values:

```css
:root {
  --radius: 0.625rem;
  --background: oklch(0.995 0.002 75);
  --foreground: oklch(0.145 0.005 50);
  --card: oklch(0.995 0.002 75);
  --card-foreground: oklch(0.145 0.005 50);
  --popover: oklch(0.995 0.002 75);
  --popover-foreground: oklch(0.145 0.005 50);
  --primary: oklch(0.205 0.005 50);
  --primary-foreground: oklch(0.97 0.003 75);
  --secondary: oklch(0.96 0.005 75);
  --secondary-foreground: oklch(0.205 0.005 50);
  --muted: oklch(0.96 0.005 75);
  --muted-foreground: oklch(0.556 0.01 60);
  --accent: oklch(0.96 0.005 75);
  --accent-foreground: oklch(0.205 0.005 50);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0.005 75);
  --input: oklch(0.922 0.005 75);
  --ring: oklch(0.708 0.008 60);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.97 0.003 75);
  --sidebar-foreground: oklch(0.145 0.005 50);
  --sidebar-primary: oklch(0.205 0.005 50);
  --sidebar-primary-foreground: oklch(0.97 0.003 75);
  --sidebar-accent: oklch(0.96 0.005 75);
  --sidebar-accent-foreground: oklch(0.205 0.005 50);
  --sidebar-border: oklch(0.922 0.005 75);
  --sidebar-ring: oklch(0.708 0.008 60);
}
```

- [ ] **Step 3: Update dark mode neutrals**

Replace the `.dark` block (lines 84-116):

```css
.dark {
  --background: oklch(0.145 0.005 50);
  --foreground: oklch(0.97 0.003 75);
  --card: oklch(0.205 0.005 50);
  --card-foreground: oklch(0.97 0.003 75);
  --popover: oklch(0.205 0.005 50);
  --popover-foreground: oklch(0.97 0.003 75);
  --primary: oklch(0.922 0.005 75);
  --primary-foreground: oklch(0.205 0.005 50);
  --secondary: oklch(0.269 0.005 50);
  --secondary-foreground: oklch(0.97 0.003 75);
  --muted: oklch(0.269 0.005 50);
  --muted-foreground: oklch(0.708 0.008 60);
  --accent: oklch(0.269 0.005 50);
  --accent-foreground: oklch(0.97 0.003 75);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(0.96 0.005 75 / 10%);
  --input: oklch(0.96 0.005 75 / 15%);
  --ring: oklch(0.556 0.008 60);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0.005 50);
  --sidebar-foreground: oklch(0.97 0.003 75);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.97 0.003 75);
  --sidebar-accent: oklch(0.269 0.005 50);
  --sidebar-accent-foreground: oklch(0.97 0.003 75);
  --sidebar-border: oklch(0.96 0.005 75 / 10%);
  --sidebar-ring: oklch(0.556 0.008 60);
}
```

- [ ] **Step 4: Add semantic financial color tokens**

Add these tokens inside the `:root` block, after the `--sidebar-ring` line:

```css
  /* Financial semantic colors — light mode */
  --color-income: oklch(0.55 0.16 155);
  --color-income-bg: oklch(0.92 0.06 155);
  --color-expense: oklch(0.45 0.15 15);
  --color-expense-bg: oklch(0.92 0.04 15);
  --color-uncleared: oklch(0.55 0.12 75);
  --color-uncleared-bg: oklch(0.92 0.06 85);
  --color-cleared: oklch(0.55 0.16 155);
  --color-cleared-bg: oklch(0.92 0.06 155);
  --color-reconciled: oklch(0.50 0.14 255);
  --color-reconciled-bg: oklch(0.92 0.06 255);
```

Add dark mode variants inside the `.dark` block, after `--sidebar-ring`:

```css
  /* Financial semantic colors — dark mode */
  --color-income: oklch(0.78 0.12 155);
  --color-income-bg: oklch(0.25 0.04 155);
  --color-expense: oklch(0.78 0.12 15);
  --color-expense-bg: oklch(0.25 0.04 15);
  --color-uncleared: oklch(0.80 0.10 85);
  --color-uncleared-bg: oklch(0.25 0.04 85);
  --color-cleared: oklch(0.78 0.12 155);
  --color-cleared-bg: oklch(0.25 0.04 155);
  --color-reconciled: oklch(0.78 0.10 255);
  --color-reconciled-bg: oklch(0.25 0.04 255);
```

- [ ] **Step 5: Add Tailwind color mappings for financial tokens**

In the `@theme inline` block, add mappings so these work as Tailwind classes (`text-income`, `bg-income-bg`, etc.):

```css
  --color-income: var(--color-income);
  --color-income-bg: var(--color-income-bg);
  --color-expense: var(--color-expense);
  --color-expense-bg: var(--color-expense-bg);
  --color-uncleared: var(--color-uncleared);
  --color-uncleared-bg: var(--color-uncleared-bg);
  --color-cleared: var(--color-cleared);
  --color-cleared-bg: var(--color-cleared-bg);
  --color-reconciled: var(--color-reconciled);
  --color-reconciled-bg: var(--color-reconciled-bg);
```

- [ ] **Step 6: Add transition tokens, fadeInUp keyframe, and warm skeleton pulse**

Add after the `@layer base` block in globals.css:

```css
/* Motion tokens */
:root {
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;
  --transition-spring: 300ms cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --transition-fast: 0ms;
    --transition-base: 0ms;
    --transition-slow: 0ms;
    --transition-spring: 0ms;
  }
}

/* Page content fade-in */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp var(--transition-slow) both;
}
```

- [ ] **Step 7: Verify the build compiles**

Run: `npm run build`
Expected: Build succeeds with no CSS errors.

- [ ] **Step 8: Commit**

```bash
git add app/globals.css
git commit -m "feat: warm color palette, semantic financial tokens, and motion tokens"
```

---

## Task 2: Replace Hardcoded Color Classes with Semantic Tokens

**Files:** ~20 files across `app/(dashboard)/`. The full list of files and their color usage:

**High usage (8+ replacements):**
- `app/(dashboard)/organizations/[orgId]/page.tsx` — green, red, yellow, blue (status icons, amounts, budget snapshot)
- `app/(dashboard)/organizations/[orgId]/transactions/transaction-table.tsx` — green, red, yellow, blue (amounts, status)
- `app/(dashboard)/organizations/[orgId]/templates/[templateId]/page.tsx` — green, red (income/expense)
- `app/(dashboard)/organizations/[orgId]/reports/page.tsx` — green, red (income/expense amounts)
- `app/(dashboard)/organizations/[orgId]/budgets/[budgetId]/page.tsx` — green, red, blue (variance, net, progress)
- `app/(dashboard)/organizations/[orgId]/accounts/[accountId]/reconcile/[sessionId]/reconcile-matching-view.tsx` — green, red, yellow (amounts, variance)

**Moderate usage (3-6):**
- `app/(dashboard)/organizations/[orgId]/accounts/[accountId]/page.tsx` — green, red, yellow, blue
- `app/(dashboard)/organizations/[orgId]/accounts/page.tsx` — green, yellow, blue
- `app/(dashboard)/organizations/[orgId]/transactions/[transactionId]/page.tsx` — green, red
- `app/(dashboard)/organizations/[orgId]/budgets/page.tsx` — green, red
- `app/(dashboard)/organizations/[orgId]/budgets/budget-form.tsx` — green, red

**Low usage (1-2):**
- `app/(dashboard)/organizations/[orgId]/transactions/transaction-form.tsx` — green
- `app/(dashboard)/organizations/[orgId]/transactions/[transactionId]/category-reassign-form.tsx` — green, red
- `app/(dashboard)/organizations/[orgId]/transactions/[transactionId]/receipt-list.tsx` — red, blue
- `app/(dashboard)/organizations/[orgId]/categories/category-form.tsx` — green
- `app/(dashboard)/organizations/[orgId]/seasons/season-form.tsx` — green
- `app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/page.tsx` — green, red
- `app/(dashboard)/organizations/[orgId]/students/student-form.tsx` — green
- `app/(dashboard)/organizations/[orgId]/accounts/new/new-account-form.tsx` — green
- `app/(dashboard)/settings/settings-form.tsx` — green

**Auth files (keep as-is — these are error state colors, not financial semantic):**
- `app/(auth)/login/login-form.tsx` — red (error alerts)
- `app/(auth)/register/register-form.tsx` — red (error alerts)

- [ ] **Step 1: Define the replacement rules**

Apply these find-and-replace patterns across all files listed above:

| Find | Replace | Context |
|------|---------|---------|
| `text-green-600 dark:text-green-400` | `text-income` | Income amounts, cleared status icons |
| `text-red-600 dark:text-red-400` | `text-expense` | Expense amounts |
| `text-yellow-600 dark:text-yellow-400` | `text-uncleared` | Uncleared status icons |
| `text-blue-600 dark:text-blue-400` | `text-reconciled` | Reconciled status icons |
| `bg-green-500` | `bg-income` | Progress bars, badges |
| `bg-red-500` | `bg-expense` | Progress bars, badges |
| `bg-blue-500` | `bg-reconciled` | Progress bars, badges |
| `bg-green-50 dark:bg-green-950` | `bg-income-bg` | Badge backgrounds |
| `bg-red-50 dark:bg-red-950` | `bg-expense-bg` | Badge backgrounds |
| `bg-yellow-50 dark:bg-yellow-950` | `bg-uncleared-bg` | Badge backgrounds |
| `bg-blue-50 dark:bg-blue-950` | `bg-reconciled-bg` | Badge backgrounds |

**Important context rules:**
- Status icon colors: `text-yellow-*` → `text-uncleared`, `text-green-*` on status icons → `text-cleared`, `text-blue-*` → `text-reconciled`
- Amount colors: `text-green-*` on amounts → `text-income`, `text-red-*` on amounts → `text-expense`
- Category label colors in SelectLabel (`text-green-*` for income type) → `text-income`, (`text-red-*` for expense type) → `text-expense`
- **Do NOT replace** `bg-red-50`/`text-red-700` patterns in auth error alerts (login/register forms) — those are UI error states, not financial semantics

- [ ] **Step 2: Replace colors in high-usage files (6 files)**

Work through each high-usage file. In each file, replace all instances matching the patterns above. Use the context (status icon vs amount vs category label) to choose the correct semantic token.

For each file, open it, find every hardcoded green/red/yellow/blue Tailwind class, and replace with the corresponding semantic token.

- [ ] **Step 3: Replace colors in moderate-usage files (5 files)**

Same process for the moderate-usage files.

- [ ] **Step 4: Replace colors in low-usage files (9 files)**

Same process for the low-usage files.

- [ ] **Step 5: Verify the build compiles and spot-check**

Run: `npm run build`
Expected: Build succeeds with no errors.

Run: `grep -r "text-green-600\|text-red-600\|text-yellow-600\|text-blue-600" app/(dashboard)/ --include="*.tsx" -l`
Expected: No files returned (all replaced). Auth files should not appear in this search.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: replace hardcoded colors with semantic financial tokens"
```

---

## Task 3: PageHeader Component

**Files:**
- Create: `components/layout/page-header.tsx`

- [ ] **Step 1: Create the PageHeader component**

```tsx
// components/layout/page-header.tsx
import type { ReactNode } from "react";

interface PageHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {children}
        </div>
      )}
    </div>
  );
}
```

Note the typography changes baked in: `font-semibold` (not bold), `text-[15px] leading-relaxed` for description.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/layout/page-header.tsx
git commit -m "feat: add PageHeader component with warm typography"
```

---

## Task 4: Adopt PageHeader Across All Pages

**Files:** ~21 page files under `app/(dashboard)/`. Each page currently has an ad-hoc title+description+button block that should be replaced with `<PageHeader>`.

- [ ] **Step 1: Replace page headers in list pages (pages with action buttons)**

These pages have the full pattern (title + description + action button):

1. `app/(dashboard)/organizations/page.tsx` — "Organizations" + "New Organization" button
2. `app/(dashboard)/organizations/[orgId]/accounts/page.tsx` — "Accounts" + "New Account" button
3. `app/(dashboard)/organizations/[orgId]/categories/page.tsx` — "Categories" + "New Category" button
4. `app/(dashboard)/organizations/[orgId]/templates/page.tsx` — "Templates" + "New Template" button
5. `app/(dashboard)/organizations/[orgId]/transactions/page.tsx` — "Transactions" + "New Transaction" button
6. `app/(dashboard)/organizations/[orgId]/budgets/page.tsx` — "Budgets" + "New Budget" button
7. `app/(dashboard)/organizations/[orgId]/seasons/page.tsx` — "Seasons" + "New Season" button
8. `app/(dashboard)/organizations/[orgId]/students/page.tsx` — "Students" + "Add Student" button

For each, replace the ad-hoc `<div className="flex...">` block with:

```tsx
import { PageHeader } from "@/components/layout/page-header";

<PageHeader title="[Title]" description="[Description text]">
  <Button asChild>
    <Link href="[create-url]">
      <Plus className="mr-2 h-4 w-4" />
      [Action Label]
    </Link>
  </Button>
</PageHeader>
```

- [ ] **Step 2: Replace page headers in detail/form pages (no action button)**

These pages have title + optional description but no action button:

1. `app/(dashboard)/dashboard/page.tsx` — "Dashboard" welcome
2. `app/(dashboard)/organizations/[orgId]/page.tsx` — Org name header
3. `app/(dashboard)/organizations/[orgId]/accounts/[accountId]/page.tsx` — Account detail
4. `app/(dashboard)/organizations/[orgId]/reports/page.tsx` — "Reports"
5. `app/(dashboard)/settings/page.tsx` — "Settings"
6. `app/(dashboard)/organizations/[orgId]/accounts/[accountId]/reconcile/page.tsx` — "Reconcile"
7. `app/(dashboard)/organizations/[orgId]/accounts/[accountId]/reconcile/[sessionId]/reconcile-matching-view.tsx` — "Reconcile" matching

For each, replace with:

```tsx
<PageHeader title="[Title]" description="[Description]" />
```

- [ ] **Step 3: Replace h1 headers on form pages**

These use `<h1>` instead of `<h2>` — change to PageHeader for consistency:

1. `app/(dashboard)/organizations/[orgId]/seasons/new/page.tsx`
2. `app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/page.tsx`
3. `app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/edit/page.tsx`
4. `app/(dashboard)/organizations/[orgId]/students/new/page.tsx`
5. `app/(dashboard)/organizations/[orgId]/students/[studentId]/edit/page.tsx`

- [ ] **Step 4: Update typography weights across remaining headings**

In all modified files, also update:
- Section headings: `text-lg font-semibold` → `text-lg font-medium`
- Card titles in `<CardTitle>`: `font-semibold` → `font-medium` (where explicitly set)

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: adopt PageHeader component across all dashboard pages"
```

---

## Task 5: Spacing & Card Depth Normalization

**Files:** All page files under `app/(dashboard)/` + card component usages.

- [ ] **Step 1: Normalize page content vertical padding**

In the dashboard shell or layout that wraps page content, find the content area padding. If pages set their own padding, update each page:

Find: `px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8`
Replace: `px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10`

If the padding is in `app/(dashboard)/layout.tsx` or `components/layout/dashboard-shell.tsx`, update it once there. Otherwise, update each page's wrapper div.

- [ ] **Step 2: Standardize section gaps**

Across all page files, normalize vertical gaps between major sections:

Find inconsistent: `gap-4` between page sections
Replace: `gap-6` for top-level section spacing

Keep `gap-4` for tighter groupings within sections (e.g., form field groups).

- [ ] **Step 3: Add soft depth to interactive cards**

Find all interactive card elements (account cards, org cards, template cards, budget cards) and add:

```
shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-xl
```

These are cards that link somewhere or have click actions. Look for `<Card>` or `<Link>` wrapping card-like elements in:
- `app/(dashboard)/organizations/page.tsx` — org cards
- `app/(dashboard)/organizations/[orgId]/accounts/page.tsx` — account cards
- `app/(dashboard)/organizations/[orgId]/templates/page.tsx` — template cards
- `app/(dashboard)/organizations/[orgId]/budgets/page.tsx` — budget cards
- `app/(dashboard)/organizations/[orgId]/seasons/page.tsx` — season cards

- [ ] **Step 4: Add soft depth to non-interactive cards**

Info display cards (dashboard summary cards, detail cards) get `shadow-sm rounded-xl` but no hover effect:
- `app/(dashboard)/organizations/[orgId]/page.tsx` — summary balance cards
- `app/(dashboard)/organizations/[orgId]/accounts/[accountId]/page.tsx` — account detail cards
- Settings cards

- [ ] **Step 5: Normalize title-to-content gap**

Ensure the gap between PageHeader and the next content section is consistently `mt-6` across all pages.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: normalize spacing, section gaps, and add card depth"
```

---

## Task 6: Button Press Animation & Sidebar Spring Easing

**Files:**
- Modify: `components/ui/button.tsx`
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Add active press to Button component**

In `components/ui/button.tsx`, update the base class string in `buttonVariants` (line 8). Add `active:scale-[0.98]` to the base classes:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
```

The `transition-all` is already present, so the scale will animate smoothly.

- [ ] **Step 2: Update sidebar collapse easing**

In `components/layout/sidebar.tsx`, find the desktop sidebar `<aside>` element (line 158). Replace `transition-all duration-200` with the spring easing:

Find: `transition-all duration-200`
Replace: `transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]`

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/ui/button.tsx components/layout/sidebar.tsx
git commit -m "feat: add button press animation and sidebar spring easing"
```

---

## Task 7: Page Fade-In Animation

**Files:**
- Modify: The main content wrapper in the dashboard layout

- [ ] **Step 1: Add fadeInUp class to page content wrapper**

Find the element that wraps page content inside the dashboard shell. This is likely in `app/(dashboard)/layout.tsx` or `components/layout/dashboard-shell.tsx` — the `<main>` element or the div that contains `{children}`.

Add the `animate-fade-in-up` class to that wrapper:

```tsx
<main className="flex-1 overflow-y-auto animate-fade-in-up">
  {children}
</main>
```

The `animate-fade-in-up` class was already defined in globals.css in Task 1, Step 6.

- [ ] **Step 2: Verify the animation works**

Run: `npm run dev`
Navigate between pages. Content should fade in with a subtle upward slide (8px) over 300ms.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add page content fade-in animation"
```

---

## Task 8: Table Row Hover Transitions

**Files:**
- Modify: `app/(dashboard)/organizations/[orgId]/transactions/transaction-table.tsx`

- [ ] **Step 1: Add transition to desktop table rows**

Find the desktop `<tr>` elements (around line 638). They already have `hover:bg-muted/30`. Add a transition:

Find: `hover:bg-muted/30`
Replace: `hover:bg-muted/30 transition-colors duration-150`

- [ ] **Step 2: Add transition to mobile card rows**

Find the mobile card elements (around line 392). They already have `hover:bg-muted/30 active:bg-muted/50`. Add a transition:

Find: `hover:bg-muted/30 active:bg-muted/50`
Replace: `hover:bg-muted/30 active:bg-muted/50 transition-colors duration-150`

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/organizations/\[orgId\]/transactions/transaction-table.tsx
git commit -m "feat: add smooth transition to table row hover states"
```

---

## Task 9: Transaction Table Data Presentation Polish

**Files:**
- Modify: `app/(dashboard)/organizations/[orgId]/transactions/transaction-table.tsx`

- [ ] **Step 1: Add tabular-nums to amount columns**

Find all elements displaying monetary amounts in the transaction table. Add `tabular-nums` to their className so numbers align in columns:

Find amount cells (look for `formatCurrency` calls) and add:
```
font-variant-numeric: tabular-nums (via Tailwind: tabular-nums)
```

Also add `font-medium` to amount display elements for visual weight.

- [ ] **Step 2: Replace status text badges with semantic pill badges**

Find the status display elements in the table. Replace flat gray badges with pill-shaped semantic badges:

For uncleared status:
```tsx
<span className="inline-flex items-center rounded-full bg-uncleared-bg px-2.5 py-0.5 text-xs font-medium text-uncleared">
  Uncleared
</span>
```

For cleared status:
```tsx
<span className="inline-flex items-center rounded-full bg-cleared-bg px-2.5 py-0.5 text-xs font-medium text-cleared">
  Cleared
</span>
```

For reconciled status:
```tsx
<span className="inline-flex items-center rounded-full bg-reconciled-bg px-2.5 py-0.5 text-xs font-medium text-reconciled">
  Reconciled
</span>
```

- [ ] **Step 3: Use proper minus sign for expenses**

Find where expense amounts are formatted. If using a custom format, replace the hyphen-minus (`-`) with the proper minus sign (`−`, Unicode U+2212):

In `lib/utils.ts`, find `formatCurrency`. If it uses a simple `-` prefix, update to use `−`. If it uses `Intl.NumberFormat`, verify the locale handles this correctly (most do).

- [ ] **Step 4: Add font-medium to description/payee column**

Find the primary description column in the table (the transaction description or payee). Add `font-medium` to make it the visual anchor of each row.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: polish transaction table with semantic badges and tabular nums"
```

---

## Task 10: Dashboard Summary Card Polish

**Files:**
- Modify: `app/(dashboard)/organizations/[orgId]/page.tsx`

- [ ] **Step 1: Polish the 4 summary balance cards**

Find the summary cards section (around lines 220-280) with Total Balance, Uncleared, Cleared, Reconciled.

Update each card:
- Add `shadow-sm rounded-xl` for soft depth
- Add `tabular-nums` to monetary values
- Change amount font from `font-bold` → `font-semibold`
- Use semantic colors for status-specific values:
  - Uncleared amount: `text-uncleared`
  - Cleared amount: `text-cleared`
  - Reconciled amount: `text-reconciled`
  - Total balance: keep `text-foreground`

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/organizations/\[orgId\]/page.tsx
git commit -m "feat: polish dashboard summary cards with semantic colors and depth"
```

---

## Task 11: EmptyState Component

**Files:**
- Create: `components/ui/empty-state.tsx`

- [ ] **Step 1: Create the EmptyState component**

```tsx
// components/ui/empty-state.tsx
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateAction {
  readonly label: string;
  readonly href?: string;
  readonly onClick?: () => void;
}

interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly action?: EmptyStateAction;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-medium text-foreground">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action && (
        action.href ? (
          <Button asChild className="mt-5">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button className="mt-5" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/ui/empty-state.tsx
git commit -m "feat: add EmptyState component with icon and warm styling"
```

---

## Task 12: Adopt EmptyState Across All Pages

**Files:** ~13 pages with empty states.

- [ ] **Step 1: Replace empty states in list pages**

For each page with an empty state, replace the ad-hoc dashed-border div with `<EmptyState>`. Use these icon assignments:

```tsx
import { EmptyState } from "@/components/ui/empty-state";
import { Building2, Wallet, Tag, Receipt, CalendarClock, PiggyBank, Users, Trophy } from "lucide-react";
```

| Page | Icon | Title | Description |
|------|------|-------|-------------|
| `organizations/page.tsx` | `Building2` | "No organizations yet" | "Create your first organization to get started." |
| `accounts/page.tsx` | `Wallet` | "No accounts yet" | "Create your first account to start tracking finances." |
| `categories/page.tsx` | `Tag` | "No categories yet" | "Create categories to organize your transactions." |
| `transactions/page.tsx` | `Receipt` | "No transactions yet" | "Create your first transaction to start tracking." |
| `templates/page.tsx` | `CalendarClock` | "No templates yet" | "Create a template for recurring transactions." |
| `budgets/page.tsx` | `PiggyBank` | "No budgets yet" | "Create a budget to track spending goals." |
| `seasons/page.tsx` | `Trophy` | "No seasons yet" | "Create a season to track activities." |
| `students/page.tsx` | `Users` | "No students yet" | "Add a student to get started." |
| `reports/page.tsx` | `Receipt` | "No report data" | "Adjust your filters or add transactions." |

For each, the pattern is:

```tsx
<EmptyState
  icon={[Icon]}
  title="[Title]"
  description="[Description]"
  action={{ label: "[+ Action Label]", href: "[create-url]" }}
/>
```

Pages with compact empty states (p-8 variants inside sections) should also use EmptyState but may omit the action prop if the CTA doesn't make sense in that context.

- [ ] **Step 2: Handle inline/section empty states**

Some pages have smaller empty states within sections (e.g., org overview page line 474). Replace these with EmptyState too, keeping the action button appropriate to the context.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: adopt EmptyState component across all pages"
```

---

## Task 13: Toast Notification System with Sonner

**Files:**
- Modify: `package.json` — add sonner
- Modify: `components/providers.tsx` — add Toaster
- Modify: Server action call sites — add toast feedback

- [ ] **Step 1: Install Sonner**

```bash
npm install sonner
```

- [ ] **Step 2: Add Toaster to Providers**

In `components/providers.tsx`, add the Sonner Toaster with custom warm styling:

```tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!bg-card !text-card-foreground !border-border !shadow-lg",
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Add toast calls to key mutation actions**

Find client components that call server actions and add toast feedback. Focus on the main CRUD operations:

For form components that use `useActionState` or call server actions directly, add toast on success/error. Example pattern:

```tsx
import { toast } from "sonner";

// After a successful server action:
toast.success("Transaction created", {
  description: "Office Supplies — $142.50",
});

// After a failed server action:
toast.error("Failed to save", {
  description: result.error,
});
```

Apply to the most common mutation points:
- Transaction create/edit forms
- Account create/edit forms
- Category create/edit/merge
- Organization create/edit
- Template create/edit
- Reconciliation completion
- Bulk actions (clear, reconcile, delete)

**Note:** Keep inline field-level validation errors as-is. Toast is for action-level feedback (success/failure of the overall operation).

- [ ] **Step 4: Verify build and test a toast**

Run: `npm run build`
Expected: Build succeeds.

Run: `npm run dev`
Test: Create a transaction and verify the success toast appears bottom-right with warm styling.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Sonner toast system with warm styling for action feedback"
```

---

## Task 14: Loading Skeleton Warmth

**Files:** All `loading.tsx` files under `app/(dashboard)/` (14 files).

- [ ] **Step 1: Verify skeletons already use warm colors**

The Skeleton component at `components/ui/skeleton.tsx` uses `bg-muted`. Since we updated `--muted` to warm stone in Task 1, the skeletons should already be warm. Verify by running `npm run dev` and checking a loading state.

If the pulse animation looks too aggressive, update the skeleton to use a gentler animation. In `components/ui/skeleton.tsx`:

```tsx
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}
```

The warm `bg-muted` color should make the pulse feel natural. No changes needed if it already looks good.

- [ ] **Step 2: Commit (only if changes were made)**

```bash
git add components/ui/skeleton.tsx
git commit -m "refactor: warm skeleton loading pulse"
```

---

## Task 15: Final Verification & Cleanup

- [ ] **Step 1: Full build check**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Lint check**

```bash
npm run lint
```

Expected: No lint errors.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: All existing tests pass.

- [ ] **Step 4: Visual spot-check**

Run: `npm run dev`

Check these pages manually:
1. Dashboard — warm tones, summary cards with shadow
2. Organizations list — warm empty state or card hover lift
3. Transactions list — semantic status badges, tabular amounts, row hover
4. Reports page — income/expense colors using semantic tokens
5. Settings — warm cards
6. Dark mode — toggle system preference and verify all pages

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final polish pass cleanup"
```
