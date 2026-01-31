# Aesthetics Reference

## Contents
- Typography
- Color System
- Domain-Specific Semantics
- Dark Mode
- Visual Identity

## Typography

The project uses **Geist** (sans) and **Geist Mono** (monospace), loaded via `next/font/google` in `app/layout.tsx` and exposed as CSS variables.

### Font Assignment

```tsx
// app/layout.tsx — fonts are applied as CSS variable classes on <body>
<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
```

```css
/* globals.css — Tailwind v4 maps variables to utilities */
@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

### Type Scale for Financial Data

Financial apps live and die by numeric readability. Use `tabular-nums` on ALL monetary values so digits align vertically in tables and summaries.

```tsx
// GOOD — tabular-nums keeps columns aligned
<td className="text-right font-medium tabular-nums">$1,234.56</td>
<td className="text-right font-medium tabular-nums">$98.00</td>

// BAD — proportional figures misalign dollar amounts
<td className="text-right font-medium">$1,234.56</td>
```

### Hierarchy

| Level | Classes | Usage |
|-------|---------|-------|
| Page title | `text-2xl font-semibold tracking-tight` | Dashboard, report headers |
| Section heading | `text-lg font-medium` | Card titles, table group headers |
| Label | `text-sm font-medium text-muted-foreground` | Form labels, stat labels |
| Body | `text-sm` | Table cells, descriptions |
| Caption | `text-xs text-muted-foreground` | Timestamps, secondary info |
| Monospace | `font-mono text-sm` | Check numbers, EINs, IDs |

### WARNING: Overriding the Font Stack

**The Problem:**

```css
/* BAD — globals.css currently has this fallback that bypasses Geist */
body {
  font-family: Arial, Helvetica, sans-serif;
}
```

**Why This Breaks:** The `body` rule overrides the Geist font variables set on `<body>` via className. Geist loads but never applies because the CSS `font-family` declaration wins over the Tailwind `font-sans` utility on child elements.

**The Fix:**

```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), sans-serif;
}
```

Or remove the `body` block entirely and rely on Tailwind's `font-sans` utility, which already maps to `--font-geist-sans`.

## Color System

When shadcn/ui is installed, the theme uses oklch-based CSS variables. The current scaffold has minimal tokens — expand to the full shadcn/ui set.

### Target Token Structure (globals.css)

```css
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.141 0.005 285.823);
  --primary: oklch(0.21 0.006 285.885);
  --primary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.967 0.001 286.375);
  --muted-foreground: oklch(0.552 0.016 285.938);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.92 0.004 286.32);
  --input: oklch(0.92 0.004 286.32);
  --ring: oklch(0.705 0.015 286.067);
  /* Domain-specific */
  --income: oklch(0.55 0.15 155);
  --expense: oklch(0.55 0.2 25);
}
```

### Base Color: Neutral (not Zinc)

The shadcn/ui "neutral" base is recommended over "zinc" or "slate" for financial apps. Neutral has zero chromatic bias — it won't subtly tint financial data green or blue.

## Domain-Specific Semantics

This is a financial app. Color carries **meaning**, not just decoration.

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--income` | Green (emerald-600) | Emerald-400 | Positive amounts, income rows |
| `--expense` | Red (red-600) | Red-400 | Negative amounts, expense rows |
| `--destructive` | oklch red | oklch red (lighter) | Delete buttons, validation errors |
| `--warning` | Amber-500 | Amber-400 | Uncleared status, pending actions |

### WARNING: Using Red/Green Without Accessibility

**The Problem:** ~8% of males have red-green color vision deficiency. Relying solely on color to distinguish income/expense fails WCAG 2.1 SC 1.4.1.

**The Fix:** Always pair color with a secondary indicator:

```tsx
// GOOD — color + prefix symbol
<span className="text-income">+$500.00</span>
<span className="text-expense">-$350.00</span>

// GOOD — color + icon
<span className="text-income"><ArrowUp className="inline h-3 w-3" /> $500.00</span>

// BAD — color only
<span className="text-green-600">$500.00</span>
<span className="text-red-600">$350.00</span>
```

## Dark Mode

Dark mode is handled via `prefers-color-scheme` media query (system preference) with CSS variables that swap values. shadcn/ui uses a `.dark` class approach — when installed, update to class-based toggling for user control.

```css
/* Current: system-only (media query) */
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

/* Target: class-based via shadcn/ui + next-themes */
.dark {
  --background: oklch(0.141 0.005 285.823);
  --foreground: oklch(0.985 0 0);
  /* ... full dark palette */
}
```

See the **nextjs** skill for `next-themes` provider setup in the App Router layout.

## Visual Identity

The Treasurer app should feel like a **modern ledger** — structured, precise, trustworthy.

| Principle | Expression |
|-----------|------------|
| Precision | `tabular-nums`, aligned columns, consistent decimal places |
| Clarity | High contrast text, generous whitespace, obvious status indicators |
| Trust | Neutral color base, no flashy gradients, restrained use of color |
| Professionalism | Geist's geometric clarity, consistent spacing scale, clean borders |

NEVER use: gradients on data surfaces, rounded-full on data containers, decorative animations on financial figures, bright saturated backgrounds behind numbers.
