---
name: frontend-design
description: |
  Designs UIs with Tailwind CSS v4, shadcn/ui components, and CSS custom properties.
  Use when: building dashboard layouts, designing financial data displays, implementing status indicators, creating form layouts, choosing color semantics for income/expense, or implementing dark mode and responsive breakpoints.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Frontend Design Skill

Dashboard-style financial application with neutral color base (no chromatic bias on financial data). Income/expense styling uses semantic colors (green/red) paired with `+`/`-` prefix for accessibility. Status triad: amber (uncleared), emerald (cleared), blue (reconciled). All monetary values use `tabular-nums` for column alignment. shadcn/ui components with `cn()` utility for variant composition. No animation on financial figures.

## Quick Start

### Financial Amount Display

```tsx
<span className="font-mono tabular-nums text-green-600">+$1,250.00</span>
<span className="font-mono tabular-nums text-red-600">-$500.00</span>
```

### Status Indicator

```tsx
const STATUS_STYLES = {
  uncleared: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  cleared: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  reconciled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
} as const;
```

### Dashboard Card

```tsx
<div className="rounded-lg border bg-card p-6">
  <p className="text-sm text-muted-foreground">Total Balance</p>
  <p className="text-2xl font-semibold tabular-nums">$12,450.00</p>
</div>
```

## Key Concepts

| Concept | Pattern |
|---------|---------|
| Neutral base | No chromatic bias on financial data |
| `tabular-nums` | Mandatory on all monetary values |
| Income/expense | Color + `+`/`-` prefix (not color alone) |
| Status colors | Amber (uncleared), emerald (cleared), blue (reconciled) |
| Dark mode | `prefers-color-scheme` + `dark:` variants |
| No number animation | Financial figures appear instantly |
| shadcn/ui | `cn()` utility for variant composition |

## See Also

- [aesthetics](references/aesthetics.md) — Typography (Geist), oklch colors, income/expense semantics, accessibility
- [components](references/components.md) — shadcn/ui setup, cn() utility, financial cards, status icons
- [layouts](references/layouts.md) — Dashboard shell, sidebar, responsive breakpoints, data tables
- [motion](references/motion.md) — CSS transitions, skeletons, loading states, reduced motion
- [patterns](references/patterns.md) — DO/DON'T pairs, split transaction visuals, new component checklist

## Related Skills

- See the **tailwind** skill for CSS v4 configuration and theme tokens
- See the **react** skill for component architecture
- See the **nextjs** skill for layout and page structure
- See the **typescript** skill for type-safe style constants
