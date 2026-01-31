# Components Reference

## Contents
- shadcn/ui Setup
- Component Styling Conventions
- Financial Domain Components
- Form Field Styling
- Data Display Components
- Anti-Patterns

## shadcn/ui Setup

shadcn/ui is planned but not yet installed. When setting up, use the `neutral` base color with CSS variables enabled.

### Installation Checklist

Copy this checklist and track progress:
- [ ] Run `npx shadcn@latest init` (select: New York style, Neutral base, CSS variables)
- [ ] Verify `components.json` created with correct aliases
- [ ] Verify `globals.css` updated with oklch token set
- [ ] Install `lib/utils.ts` with `cn()` helper
- [ ] Add first component: `npx shadcn@latest add button`
- [ ] Validate dark mode tokens present in `.dark` block

### The `cn()` Utility

All component styling must use `cn()` for class merging. It combines `clsx` + `tailwind-merge` to handle conditional classes and prevent conflicts.

```tsx
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: "uncleared" | "cleared" | "reconciled" }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
      status === "uncleared" && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      status === "cleared" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      status === "reconciled" && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    )}>
      {status}
    </span>
  );
}
```

## Component Styling Conventions

### Consistent Visual Treatments

| Element | Classes | Notes |
|---------|---------|-------|
| Card | `rounded-lg border border-border bg-card p-6 shadow-sm` | No `shadow-md` or `shadow-lg` — financial data needs flat clarity |
| Table header | `bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground` | Subtle background, uppercase for scanability |
| Input | `rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background` | Matches shadcn/ui input pattern |
| Button (primary) | `bg-primary text-primary-foreground hover:bg-primary/90` | Use shadcn/ui Button component |
| Destructive action | `bg-destructive text-destructive-foreground hover:bg-destructive/90` | Delete transaction, remove line item |

### WARNING: Inconsistent Border Radius

**The Problem:**

```tsx
// BAD — mixing radius values across sibling elements
<div className="rounded-xl border p-4">  {/* card */}
  <button className="rounded-sm px-4 py-2">Save</button>  {/* button */}
  <input className="rounded-full px-3 py-2" />  {/* input */}
</div>
```

**Why This Breaks:** Inconsistent radii create visual noise. Financial apps need uniform, predictable surfaces.

**The Fix:** Use the `--radius` token from shadcn/ui. All components inherit from it:

```tsx
// GOOD — consistent radius via shadcn/ui token
<div className="rounded-lg border p-4">
  <Button>Save</Button>          {/* inherits --radius */}
  <Input placeholder="Amount" /> {/* inherits --radius */}
</div>
```

## Financial Domain Components

### Summary Card Pattern

```tsx
function BalanceCard({ label, amount, variant }: Readonly<{
  label: string;
  amount: number;
  variant?: "default" | "income" | "expense";
}>) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
        variant === "income" && "text-income",
        variant === "expense" && "text-expense",
      )}>
        ${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}
```

### Category Display (Two-Level Hierarchy)

```tsx
// "Parent -> Subcategory" format per PRD Section 7.3
function CategoryLabel({ parent, child }: Readonly<{ parent: string; child?: string }>) {
  return (
    <span className="text-sm">
      {parent}
      {child && (
        <>
          <span className="mx-1 text-muted-foreground">&rarr;</span>
          {child}
        </>
      )}
    </span>
  );
}
```

## Form Field Styling

See the **react-hook-form** skill for form logic. This section covers visual patterns.

### Currency Input

```tsx
// Wrap input with dollar sign prefix
<div className="relative">
  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
    $
  </span>
  <Input
    type="number"
    step="0.01"
    min="0"
    className="pl-7 text-right tabular-nums"
    placeholder="0.00"
  />
</div>
```

### Line Item Row (Split Transactions)

```tsx
<div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
  <div className="flex-1">
    <Select>{/* Category dropdown */}</Select>
  </div>
  <div className="w-32">
    {/* Currency input */}
  </div>
  <div className="flex-1">
    <Input placeholder="Memo (optional)" className="text-sm" />
  </div>
  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
    <Trash2 className="h-4 w-4" />
  </Button>
</div>
```

## Data Display Components

### Transaction Status Icons

Per PRD Section 7.3, use distinct icons — not just color:

```tsx
import { Circle, Check, Lock } from "lucide-react";

const STATUS_ICONS = {
  uncleared: <Circle className="h-4 w-4 text-amber-500" />,
  cleared: <Check className="h-4 w-4 text-emerald-500" />,
  reconciled: <Lock className="h-4 w-4 text-blue-500" />,
} as const;
```

### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <Receipt className="h-12 w-12 text-muted-foreground/40" />
  <h3 className="mt-4 text-sm font-medium">No transactions yet</h3>
  <p className="mt-1 text-sm text-muted-foreground">
    Add your first transaction to get started.
  </p>
  <Button className="mt-4" size="sm">Add Transaction</Button>
</div>
```

## Anti-Patterns

### WARNING: Hardcoded Colors Instead of Tokens

**The Problem:**

```tsx
// BAD — hardcoded hex bypasses theme system
<div className="bg-[#f5f5f5] text-[#333]">
```

**Why This Breaks:** Hardcoded values don't respond to dark mode and create maintenance debt when the theme changes.

**The Fix:**

```tsx
// GOOD — semantic tokens
<div className="bg-muted text-foreground">
```

**When You Might Be Tempted:** When the exact shade you want doesn't exist in the token set. Solution: add it as a CSS variable in `globals.css`, then map it in `@theme inline`.
