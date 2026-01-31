# Patterns Reference

## Contents
- Design Decision Framework
- DO/DON'T Pairs
- Financial UI Patterns
- Visual Consistency Rules
- Anti-Patterns
- New Component Checklist

## Design Decision Framework

When making visual decisions for this app, apply this priority order:

1. **Data clarity** — Can the user read and compare numbers easily?
2. **Status visibility** — Is the transaction state immediately obvious?
3. **Consistency** — Does this match existing surfaces?
4. **Aesthetics** — Does it look professional?

If aesthetics conflicts with data clarity, data clarity wins. Always.

## DO/DON'T Pairs

### Currency Formatting

```tsx
// DO — right-aligned, tabular-nums, consistent decimals
<td className="text-right tabular-nums font-medium">$1,234.56</td>
<td className="text-right tabular-nums font-medium">$98.00</td>

// DON'T — left-aligned, proportional, missing decimals
<td className="text-left">$1,234.56</td>
<td className="text-left">$98</td>
```
**Why:** Right-alignment with tabular figures lets users scan a column and instantly compare magnitudes. Left-aligned proportional numbers are unreadable in lists.

### Status Badges

```tsx
// DO — color + text label + icon
<span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
  <Circle className="h-3 w-3" />
  Uncleared
</span>

// DON'T — color dot only
<span className="h-2 w-2 rounded-full bg-yellow-400" />
```
**Why:** Color alone fails for color-blind users. The text label is the primary indicator; color and icon are reinforcement.

### Empty States

```tsx
// DO — helpful, actionable empty state
<div className="flex flex-col items-center py-16 text-center">
  <Wallet className="h-12 w-12 text-muted-foreground/40" />
  <h3 className="mt-4 text-sm font-medium">No accounts yet</h3>
  <p className="mt-1 text-sm text-muted-foreground">Create a checking or savings account to start tracking.</p>
  <Button size="sm" className="mt-4">Add Account</Button>
</div>

// DON'T — bare text
<p className="text-gray-500">No data</p>
```
**Why:** Empty states are onboarding moments. They should guide the user to the next action.

### Card Density

```tsx
// DO — consistent padding, clear hierarchy
<div className="rounded-lg border border-border bg-card p-6">
  <p className="text-sm font-medium text-muted-foreground">Label</p>
  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">$12,450.00</p>
</div>

// DON'T — cramped or inconsistent padding
<div className="rounded-xl border bg-white p-2 shadow-lg">
  <h4 className="text-xs text-gray-400">Label</h4>
  <div className="text-3xl font-bold text-green-500">$12450</div>
</div>
```
**Why:** The DON'T version has: inconsistent radius (`rounded-xl` vs project standard `rounded-lg`), hardcoded colors, excessive shadow, cramped padding, missing number formatting, and gratuitous font size.

### Form Layout

```tsx
// DO — labels above inputs, consistent gap
<div className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="description">Description</Label>
    <Input id="description" placeholder="Office supplies" />
  </div>
  <div className="space-y-2">
    <Label htmlFor="amount">Amount</Label>
    <Input id="amount" type="number" step="0.01" className="tabular-nums" />
  </div>
</div>

// DON'T — inline labels with inconsistent spacing
<div>
  <label className="mr-2">Description</label><input className="border p-1" />
  <label className="ml-4 mr-2">Amount</label><input className="border p-1 w-20" />
</div>
```
**Why:** Top-aligned labels are easier to scan and work better on all screen sizes. Inline labels break on narrow viewports.

## Financial UI Patterns

### Split Transaction Visual

When a transaction has multiple line items, show them nested under the parent row:

```tsx
// Parent row — full transaction info
<tr className="border-b border-border">
  <td className="px-4 py-3">01/15/2025</td>
  <td className="px-4 py-3">Office Supplies</td>
  <td className="px-4 py-3 text-right tabular-nums text-expense">$500.00</td>
  <td className="px-4 py-3"><StatusBadge status="cleared" /></td>
</tr>
// Child rows — indented, lighter
<tr className="border-b border-border bg-muted/30">
  <td className="px-4 py-2" />
  <td className="px-4 py-2 pl-10 text-sm text-muted-foreground">
    Operations &rarr; Supplies — Paper & pens
  </td>
  <td className="px-4 py-2 text-right tabular-nums text-sm">$350.00</td>
  <td />
</tr>
<tr className="border-b border-border bg-muted/30">
  <td className="px-4 py-2" />
  <td className="px-4 py-2 pl-10 text-sm text-muted-foreground">
    Operations &rarr; Equipment — USB drives
  </td>
  <td className="px-4 py-2 text-right tabular-nums text-sm">$150.00</td>
  <td />
</tr>
```

### Reconciled Row Lock

Reconciled transactions are locked (PRD TXN-004). Visually communicate this:

```tsx
<tr className={cn(
  "border-b border-border",
  status === "reconciled" && "opacity-75",
)}>
  {/* cells — edit buttons hidden/disabled for reconciled */}
</tr>
```

## Visual Consistency Rules

| Rule | Standard | Violation |
|------|----------|-----------|
| Border radius | `rounded-lg` for cards, `rounded-md` for inputs/buttons | `rounded-xl`, `rounded-full` on data containers |
| Shadow | `shadow-sm` on cards only, no shadow on table containers | `shadow-lg`, `shadow-xl` |
| Border color | `border-border` token | `border-gray-200`, `border-[#ddd]` |
| Text color | `text-foreground`, `text-muted-foreground` | `text-gray-700`, `text-[#555]` |
| Background | `bg-background`, `bg-card`, `bg-muted` | `bg-white`, `bg-gray-50`, `bg-[#f5f5f5]` |
| Font weight | `font-medium` for emphasis, `font-semibold` for headings | `font-bold` everywhere |
| Number display | `tabular-nums` + right-aligned | Proportional, left-aligned |

## Anti-Patterns

### WARNING: Generic AI Aesthetics

**The Problem:** Claude and other LLMs tend to generate UIs with these generic patterns:
- Purple-to-blue gradients on headers
- Rounded-full pill shapes everywhere
- `shadow-xl` on every card
- Bright saturated accent colors on data surfaces
- Excessive whitespace with centered single-column layouts

**Why This Breaks:** These patterns are optimized for marketing sites, not data-dense financial tools. A treasurer needs to see 50 transactions at once, not 3 cards with drop shadows.

**The Fix:** Follow the patterns in this guide. When in doubt: flat surfaces, tight spacing, neutral colors, bold data.

### WARNING: Styling Inline with Arbitrary Values

**The Problem:**

```tsx
// BAD — arbitrary values bypass the design system
<div className="mt-[13px] p-[18px] text-[15px] text-[#4a5568]">
```

**Why This Breaks:** Arbitrary values create one-off measurements that don't align with the spacing scale. The result looks "off" without anyone being able to say why.

**The Fix:** Use the nearest Tailwind value from the standard scale:

```tsx
// GOOD
<div className="mt-3 p-4 text-sm text-muted-foreground">
```

## New Component Checklist

Copy this checklist when creating a new UI component:

- [ ] Uses `cn()` for conditional classes
- [ ] Uses semantic color tokens (`bg-card`, `text-foreground`), not hardcoded values
- [ ] Dark mode works without additional classes (tokens handle it)
- [ ] Financial numbers use `tabular-nums` and right-alignment
- [ ] Interactive elements have `transition-colors duration-150`
- [ ] Focus states use `focus-visible:ring-2 focus-visible:ring-ring`
- [ ] Empty state is handled with icon + message + action
- [ ] Loading state has skeleton or spinner
- [ ] Reduced motion respected (`motion-safe:` prefix or media query)
- [ ] Border radius uses `rounded-lg` (cards) or `rounded-md` (inputs)
