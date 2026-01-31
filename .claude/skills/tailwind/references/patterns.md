# Tailwind CSS v4 Patterns

## Contents
- Theme Token Patterns
- Component Styling Patterns
- Dark Mode Patterns
- Anti-Patterns

---

## Theme Token Patterns

### @theme vs @theme inline

All theme customization lives in `app/globals.css`. No `tailwind.config.ts`.

- `@theme` — static values. Generates `--tw-*` CSS variables for use in utilities.
- `@theme inline` — references runtime CSS vars (e.g., dark mode `:root` overrides). No extra vars emitted.

```css
@theme {
  --color-primary: oklch(0.55 0.2 250);
  --radius-lg: 0.75rem;
}

@theme inline {
  --color-background: var(--background);
  --font-sans: var(--font-geist-sans);
}
```

### The cn() Utility

Use `clsx` + `tailwind-merge` for conditional classes. See the **typescript** skill for type patterns.

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```tsx
<button className={cn(
  "rounded-md px-4 py-2 font-medium transition-colors",
  isActive && "bg-primary text-primary-foreground",
  isDisabled && "pointer-events-none opacity-50"
)}>
```

---

## Component Styling Patterns

### Financial Data Display

```tsx
<span className={cn(
  "tabular-nums font-medium",
  type === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
)}>
  {type === "expense" ? "-" : "+"}${amount.toFixed(2)}
</span>
```

### Status Badge Pattern

```tsx
const STATUS_STYLES = {
  uncleared: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  cleared: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
  reconciled: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
} as const;

<span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLES[status])}>
  {status}
</span>
```

### Responsive Table

```tsx
<div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
  <table className="w-full text-sm">
    <thead className="border-b bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
      <tr>
        <th className="whitespace-nowrap px-4 py-3">Date</th>
        <th className="whitespace-nowrap px-4 py-3 text-right">Amount</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{/* rows */}</tbody>
  </table>
</div>
```

---

## Dark Mode Patterns

This project uses `prefers-color-scheme`. To switch to class-based toggling for a manual toggle:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

### WARNING: Inconsistent Dark Mode Strategy

```tsx
// BAD — mixing hardcoded dark colors with theme tokens
<div className="bg-white dark:bg-[#1a1a1a] text-foreground">
```

**Why This Breaks:** `text-foreground` responds to theme changes but `bg-[#1a1a1a]` does not. When shadcn/ui is added, its tokens will conflict with hardcoded values.

```tsx
// GOOD — use theme tokens consistently
<div className="bg-background text-foreground">
```

---

## Anti-Patterns

### WARNING: v3 Syntax in v4

```css
/* BAD — produces build errors in v4 */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* GOOD */
@import "tailwindcss";
```

### WARNING: JS Config for Theme

```typescript
// BAD — v4 ignores JS config for theme tokens
export default { theme: { extend: { colors: { primary: "#3b82f6" } } } };
```

```css
/* GOOD — CSS-native configuration */
@theme { --color-primary: #3b82f6; }
```

### WARNING: @apply Overuse

```css
/* BAD — breaks co-location, requires @reference in CSS modules */
.btn-primary {
  @apply rounded-md bg-primary px-4 py-2 text-sm font-medium;
}
```

Use `cn()` and composition in components instead. Reserve `@apply` for global resets only.

### WARNING: Arbitrary Values as Design Tokens

```tsx
// BAD — scattered hardcoded values, impossible to maintain
<div className="rounded-[7px] p-[13px] text-[#4a7c59]">

// GOOD — define token in @theme, reference by name
<div className="rounded-lg p-3 text-success">
```

If you need a value more than once, make it a `@theme` token in `globals.css`.
