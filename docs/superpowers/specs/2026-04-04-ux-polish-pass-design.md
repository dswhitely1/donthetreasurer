# UX Polish Pass — Design Spec

**Date:** 2026-04-04
**Status:** Approved
**Inspiration:** Warm like Notion — soft, approachable, professional

## Overview

A comprehensive UX polish pass across the entire Treasurer app, organized in four layers:

1. **Color Palette** — warm Notion-style neutrals + semantic financial color tokens
2. **Typography & Spacing** — lighter weights, consistent rhythm, reusable PageHeader component
3. **Animations & Micro-interactions** — CSS-only motion with transition tokens
4. **Data Presentation & Experience** — table polish, empty states, toast notification system

The goal is to make the app feel cohesive, warm, and intentionally designed — not just functional.

---

## Layer 1: Warm Color Palette

### Base Neutrals

Replace the current cool oklch grays with warm stone-based neutrals inspired by Notion.

**Light mode:**

| Token | Current | Proposed | Notes |
|-------|---------|----------|-------|
| `--background` | `oklch(1 0 0)` (pure white) | `oklch(0.995 0.002 75)` (#fffcf9, warm cream) | Subtle warmth |
| `--foreground` | `oklch(0.145 0 0)` (cool black) | `oklch(0.145 0.005 50)` (#1c1917, warm charcoal) | Stone-900 equivalent |
| `--muted` | `oklch(0.97 0 0)` (cool gray) | `oklch(0.96 0.005 75)` (#f5f1ed, warm muted) | Stone-100 equivalent |
| `--muted-foreground` | `oklch(0.556 0 0)` (mid gray) | `oklch(0.556 0.01 60)` (#9b8e82, warm mid) | Stone-500 equivalent |
| `--border` | `oklch(0.922 0 0)` (cool border) | `oklch(0.922 0.005 75)` (#ede8e3, warm border) | Stone-200 equivalent |
| `--input` | `oklch(0.922 0 0)` | `oklch(0.922 0.005 75)` | Match border |
| `--card` | `oklch(1 0 0)` | `oklch(0.995 0.002 75)` | Match background |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.96 0.005 75)` | Match muted |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.96 0.005 75)` | Match muted |

**Dark mode:**

| Token | Current | Proposed | Notes |
|-------|---------|----------|-------|
| `--background` | `oklch(0.145 0 0)` | `oklch(0.145 0.005 50)` (#1c1917) | Warm charcoal |
| `--foreground` | `oklch(0.985 0 0)` | `oklch(0.97 0.003 75)` (#faf5f0) | Warm off-white |
| `--muted` | `oklch(0.269 0 0)` | `oklch(0.269 0.005 50)` (#292524) | Stone-800 |
| `--muted-foreground` | `oklch(0.708 0 0)` | `oklch(0.708 0.008 60)` (#a8a29e) | Stone-400 |
| `--border` | `oklch(1 0 0 / 10%)` | `oklch(0.96 0.005 75 / 10%)` | Warm tinted |
| `--input` | `oklch(1 0 0 / 15%)` | `oklch(0.96 0.005 75 / 15%)` | Warm tinted |
| `--card` | `oklch(0.205 0 0)` | `oklch(0.205 0.005 50)` | Warm dark card |

Sidebar tokens follow the same warm shift.

### Semantic Financial Color Tokens

New CSS custom properties replacing ~150 hardcoded color classes:

```css
:root {
  /* Income — emerald, calm growth */
  --color-income: oklch(0.55 0.16 155);          /* text */
  --color-income-bg: oklch(0.92 0.06 155);       /* badge/pill background */

  /* Expense — rose, warm not alarming */
  --color-expense: oklch(0.45 0.15 15);           /* text */
  --color-expense-bg: oklch(0.92 0.04 15);        /* badge/pill background */

  /* Uncleared — amber, needs attention */
  --color-uncleared: oklch(0.55 0.12 75);         /* text */
  --color-uncleared-bg: oklch(0.92 0.06 85);      /* badge/pill background */

  /* Cleared — emerald, confirmed */
  --color-cleared: oklch(0.55 0.16 155);          /* text (same as income) */
  --color-cleared-bg: oklch(0.92 0.06 155);       /* badge/pill background */

  /* Reconciled — blue, trusted & done */
  --color-reconciled: oklch(0.50 0.14 255);       /* text */
  --color-reconciled-bg: oklch(0.92 0.06 255);    /* badge/pill background */
}
```

**Dark mode variants:**

```css
.dark {
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
}
```

### Files Changed

- `app/globals.css` — all `:root` and `.dark` custom properties updated; new `--color-income/expense/uncleared/cleared/reconciled` tokens added
- `@theme inline` block — update Tailwind color mappings

---

## Layer 2: Typography, Spacing & Components

### Typography Refinements

| Element | Current | Proposed |
|---------|---------|----------|
| Page titles | `text-2xl font-bold tracking-tight` | `text-2xl font-semibold tracking-tight` |
| Section headings | `text-lg font-semibold` | `text-lg font-medium` |
| Description text | `text-sm text-muted-foreground` | `text-[15px] text-muted-foreground leading-relaxed` |
| Card titles | `font-semibold` | `font-medium` |

Overall: lighter weights, slightly more generous line-height. Notion's calm, readable feel.

### Spacing Standardization

| Context | Current | Proposed | Rule |
|---------|---------|----------|------|
| Page padding | `px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8` | `px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10` | More vertical breathing room |
| Card padding | `p-3`, `p-4`, `p-6` (mixed) | `p-5` standard, `p-6` for featured | One default, one emphasis |
| Section gaps | `gap-4`, `gap-6` (mixed) | `gap-6` between sections | Consistent section rhythm |
| Form field gaps | `gap-1.5` | `gap-1.5` (keep) | Already good |
| Title → content gap | `mt-4` to `mt-8` (varies) | `mt-6` standard | Consistent title separation |

### New Component: PageHeader

Extracts the repeated title + description + actions pattern (~12 pages) into one reusable component.

```tsx
// components/layout/page-header.tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode; // action slot (buttons)
}
```

Renders: flex row with title+description on the left, children (actions) on the right. Responsive stacking on mobile.

### Soft Depth: Shadows & Borders

- Interactive cards (accounts, orgs, templates): `shadow-sm` + `hover:shadow-md hover:-translate-y-0.5` with `transition: var(--transition-base)`
- Non-interactive cards (info displays): `shadow-sm` only, no hover
- Border radius: bump from `rounded-lg` to `rounded-xl` on cards for softer feel
- Borders stay but use the warmer `--border` token

### Files Changed

- All `page.tsx` files under `(dashboard)/` — typography weight changes, spacing normalization, adopt `PageHeader`
- `components/layout/page-header.tsx` — new component
- All card usages — padding standardization, shadow + border-radius updates

---

## Layer 3: Animations & Micro-interactions

### Transition Tokens

```css
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
```

### Animation Catalog

| Animation | Where | Timing | Details |
|-----------|-------|--------|---------|
| Card hover lift | Account/org/template cards | `--transition-base` | `hover:-translate-y-0.5 hover:shadow-md` |
| Button press | All buttons | `--transition-fast` | `active:scale-[0.98]` |
| Page fade-in | Page content wrapper | `--transition-slow` | `@keyframes fadeInUp` from opacity-0 translateY(8px) |
| Sidebar collapse | Sidebar width + label opacity | `--transition-spring` | Width 256px ↔ 64px, labels fade |
| Dialog/sheet entry | shadcn dialogs | `--transition-spring` | Pass spring easing through to Radix |
| Toast slide-in | Sonner toasts | `--transition-spring` | Slide from right, fade out on dismiss |
| Table row hover | Transaction table rows | `--transition-fast` | `hover:bg-muted/50` |
| Skeleton pulse | Loading skeletons | — | Warm muted color, gentler pulse keyframe |

### What We're NOT Animating

- No layout height animations (accordion/expandable rows — causes jank)
- No staggered list entry (too slow for data-heavy pages)
- No scroll-triggered animations (dashboard app, not marketing site)
- No route transition animations (Next.js App Router doesn't support cleanly)

### Files Changed

- `app/globals.css` — transition tokens, `fadeInUp` keyframe, warm skeleton pulse
- `components/layout/dashboard-shell.tsx` or page wrapper — apply `fadeInUp` animation class
- Interactive card components — add transition + hover classes
- shadcn Button component — add `active:scale-[0.98]` if not already present

---

## Layer 4: Data Presentation & Experience

### Transaction Table Polish

| Change | Before | After |
|--------|--------|-------|
| Status badges | Flat gray background, plain text | Pill-shaped with semantic background colors (amber for uncleared, green for cleared, blue for reconciled) |
| Amount formatting | `font-normal`, hyphen-minus | `font-medium`, `font-variant-numeric: tabular-nums`, proper minus sign (−) |
| Description column | Normal weight | `font-medium` for visual anchor |
| Row hover | None | Warm `bg-muted/50` with `--transition-fast` |

### Dashboard Summary Cards

- Add `shadow-sm` soft depth
- Use semantic colors for status-specific values (amber for uncleared amount)
- `font-variant-numeric: tabular-nums` on all monetary values
- Slightly larger value text with `font-semibold` instead of `font-bold`

### New Component: EmptyState

Extracts the repeated empty state pattern into one reusable component.

```tsx
// components/ui/empty-state.tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}
```

Renders: centered layout with icon in a warm rounded-square container, title, description, and optional CTA button. Context-specific icons per entity:

- Transactions: `Receipt` icon
- Organizations: `Building2` icon
- Accounts: `Wallet` icon
- Categories: `Tag` icon
- Templates: `CalendarClock` icon
- Budgets: `PiggyBank` icon

### Toast Notification System

**Library:** Sonner (shadcn/ui recommended, lightweight, accessible).

**Setup:**
- Install `sonner` package
- Add `<Toaster />` to the root layout or Providers component
- Custom theme to match warm palette (warm card background, soft shadow, warm border)
- Position: bottom-right

**Usage pattern:**
- Server action success → `toast.success("Transaction created", { description: "Office Supplies — $142.50" })`
- Server action error → `toast.error("Failed to save", { description: error.message })`
- Replace inline error alerts in forms for non-blocking feedback
- Keep inline validation for field-level errors (those stay as-is)

**Toast styling:**
- Warm card background matching `--card`
- Soft shadow: `0 4px 12px rgba(28,25,23,0.08)`
- Semantic icon circles (green checkmark for success, rose X for error)
- Slide-in from right with spring easing

### Files Changed

- `package.json` — add `sonner`
- `components/providers.tsx` or root layout — add `<Toaster />` with custom theme
- `components/ui/empty-state.tsx` — new component
- All pages with empty states — adopt `EmptyState` component
- Transaction table components — status badge pill styling, tabular-nums, row hover
- Dashboard `page.tsx` — summary card shadow + typography refinements
- Server action call sites — add toast calls for success/error feedback

---

## Scope Summary

| Layer | New Components | Files Modified | New Dependencies |
|-------|---------------|----------------|------------------|
| 1. Color Palette | 0 | 1 (globals.css) + all files with hardcoded colors (~15-20) | 0 |
| 2. Typography & Spacing | 1 (PageHeader) | ~12 page files + card usages | 0 |
| 3. Animations | 0 | 1 (globals.css) + ~8 component files | 0 |
| 4. Data & Experience | 1 (EmptyState) + Sonner setup | ~10-15 files | 1 (sonner) |
| **Total** | **2 new + 1 dependency** | **~40-50 files** | **sonner** |

## Implementation Order

Layers should be implemented in order (1→2→3→4) since each builds on the previous:
1. Color palette first — establishes the warm foundation everything else uses
2. Typography & spacing — uses new colors, creates PageHeader
3. Animations — uses new colors for skeleton warmth, references card styles
4. Data & experience — uses all previous layers, adds final polish
