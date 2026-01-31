---
name: tailwind
description: |
  Styles applications using Tailwind CSS v4 with @import syntax and custom properties.
  Use when: adding theme tokens to globals.css, styling components with utility classes, implementing dark mode with prefers-color-scheme, setting up shadcn/ui, or debugging style issues.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Tailwind CSS Skill

Tailwind CSS v4 with `@import "tailwindcss"` syntax (not v3 `@tailwind` directives). Configuration lives in `app/globals.css` using `@theme` blocks — no `tailwind.config.ts`. Dark mode via `prefers-color-scheme` media query and `dark:` variant. Fonts exposed as CSS variables: `--font-geist-sans`, `--font-geist-mono`.

## Quick Start

### Theme Tokens in globals.css

```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.55 0.2 250);
  --radius-lg: 0.75rem;
}

@theme inline {
  --color-background: var(--background);
  --font-sans: var(--font-geist-sans);
}
```

### Component Styling

```tsx
<button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
  Save Transaction
</button>
```

### Dark Mode

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.15 0 0);
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: oklch(0.12 0 0);
    --foreground: oklch(0.95 0 0);
  }
}
```

## Key Concepts

| Concept | Pattern |
|---------|---------|
| v4 import | `@import "tailwindcss"` (not `@tailwind base`) |
| Theme tokens | `@theme { }` in `globals.css` |
| Runtime vars | `@theme inline { }` for CSS variable references |
| Dark mode | `prefers-color-scheme` media query + `dark:` variant |
| No JS config | All config in CSS, no `tailwind.config.ts` |
| shadcn/ui | Uses CSS variables for theming |

## See Also

- [patterns](references/patterns.md) — Theme tokens, component styling, dark mode, anti-patterns
- [workflows](references/workflows.md) — Token creation, shadcn/ui setup, dark mode toggle, debugging

## Related Skills

- See the **react** skill for component patterns
- See the **typescript** skill for type-safe class utilities
- See the **nextjs** skill for layout and page structure
- See the **frontend-design** skill for UI/UX design patterns

## Documentation Resources

> Fetch latest Tailwind CSS documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "tailwindcss"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/tailwindcss`

**Recommended Queries:**
- "Tailwind CSS v4 theme configuration"
- "Tailwind CSS dark mode prefers-color-scheme"
- "Tailwind CSS custom colors oklch"
- "Tailwind CSS v4 migration from v3"
