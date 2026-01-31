# Motion Reference

## Contents
- Motion Philosophy
- CSS Transitions
- Loading States
- Micro-Interactions
- Page Transitions
- Performance
- Anti-Patterns

## Motion Philosophy

The Treasurer app is a **financial data tool**. Motion should communicate state changes, not decorate. Every animation must answer: "What did this help the user understand?"

| Principle | Rule |
|-----------|------|
| Purposeful | Animate to show cause-and-effect (row added, status changed) |
| Fast | 150-200ms for micro-interactions, 200-300ms for layout shifts |
| Subtle | No bounces, no overshoots, no spring physics on data surfaces |
| Reducible | Respect `prefers-reduced-motion` — all motion must degrade gracefully |

No animation library is installed. Use CSS transitions and Tailwind's `transition-*` utilities. If complex orchestration is needed later (page transitions, list reordering), consider `motion` (formerly Framer Motion).

## CSS Transitions

### Standard Easing

```tsx
// Default transition for interactive elements
<button className="transition-colors duration-150">Action</button>

// Expanded element (dropdown, accordion)
<div className="transition-all duration-200 ease-out">Content</div>
```

### Tailwind Transition Utilities

| Class | Duration | Use Case |
|-------|----------|----------|
| `transition-colors duration-150` | 150ms | Hover states, focus rings |
| `transition-opacity duration-200` | 200ms | Fade in/out, disabled states |
| `transition-all duration-200 ease-out` | 200ms | Height/width changes, accordions |
| `transition-transform duration-200` | 200ms | Scale on press, slide in |

### Reduced Motion

ALWAYS include reduced-motion handling for non-essential animation:

```tsx
// GOOD — motion-safe gates the animation
<div className="motion-safe:transition-all motion-safe:duration-200">
  {/* content */}
</div>

// For CSS custom animations
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Loading States

### Skeleton Pattern

Use for data that loads asynchronously (transaction lists, balance cards). Skeletons are preferable to spinners for layout stability.

```tsx
function BalanceCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-7 w-32 animate-pulse rounded bg-muted" />
    </div>
  );
}
```

### Table Loading Skeleton

```tsx
function TransactionRowSkeleton() {
  return (
    <tr className="border-b border-border">
      <td className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 animate-pulse rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-4 w-12 animate-pulse rounded bg-muted" /></td>
    </tr>
  );
}

// Usage: render 5-10 skeleton rows while loading
{isLoading && Array.from({ length: 8 }).map((_, i) => (
  <TransactionRowSkeleton key={i} />
))}
```

### Button Loading State

```tsx
<Button disabled={isPending}>
  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {isPending ? "Saving..." : "Save Transaction"}
</Button>
```

## Micro-Interactions

### Table Row Hover

```tsx
<tr className="border-b border-border transition-colors duration-150 hover:bg-muted/50">
```

### Focus Ring

Use the shadcn/ui focus pattern — visible ring on keyboard focus, invisible on mouse:

```tsx
// Applied via shadcn/ui component styles or manually:
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
```

### Status Change Feedback

When a transaction status changes (uncleared -> cleared), briefly highlight the row:

```tsx
// Apply via a temporary class after mutation success
<tr className={cn(
  "border-b border-border transition-colors duration-150",
  justUpdated && "bg-emerald-50 dark:bg-emerald-900/10",
)}>
```

### Expandable Split Transaction Row

```tsx
// Chevron rotation indicates expand/collapse state
<button
  onClick={() => setExpanded(!expanded)}
  className="transition-transform duration-200"
  aria-expanded={expanded}
>
  <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-90")} />
</button>
```

## Page Transitions

With Next.js App Router, page transitions happen via React Suspense boundaries. Use `loading.tsx` files for route-level loading states.

```tsx
// app/(dashboard)/organizations/[orgId]/transactions/loading.tsx
export default function TransactionsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-10 w-36 animate-pulse rounded bg-muted" />
      </div>
      <div className="rounded-lg border border-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-border px-4 py-3">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

See the **nextjs** skill for `loading.tsx` and Suspense boundary patterns.

## Performance

### Rules

1. NEVER animate `width`, `height`, or `top`/`left` — use `transform` and `opacity` instead
2. Use `will-change` sparingly and only on elements that actually animate repeatedly
3. `animate-pulse` (CSS keyframes) is GPU-accelerated — safe for skeletons
4. `animate-spin` uses `transform: rotate()` — GPU-accelerated, safe for loaders

### WARNING: Layout-Triggering Animations

**The Problem:**

```tsx
// BAD — animating height causes layout recalculation every frame
<div className="transition-[height] duration-300" style={{ height: expanded ? "auto" : "0" }}>
```

**Why This Breaks:** Animating `height` triggers layout on every frame (jank at 60fps). Especially problematic in long transaction tables.

**The Fix:**

```tsx
// GOOD — use grid trick for height animation (GPU-friendly)
<div className={cn(
  "grid transition-[grid-template-rows] duration-200 ease-out",
  expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
)}>
  <div className="overflow-hidden">
    {/* expandable content */}
  </div>
</div>
```

## Anti-Patterns

### WARNING: Decorative Animation on Financial Data

**The Problem:** Animating numbers counting up, bouncing totals, or sliding balances into view.

**Why This Breaks:** Users need to trust that the numbers they see are final. Animation on financial figures creates uncertainty: "Is that the real number or is it still changing?"

**The Fix:** Financial figures appear instantly. Only animate the *container* (fade-in), never the *value*.

```tsx
// BAD
<AnimatedNumber from={0} to={12450} duration={1000} />

// GOOD — container fades, number is immediate
<div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
  <p className="text-2xl font-semibold tabular-nums">$12,450.00</p>
</div>
```
