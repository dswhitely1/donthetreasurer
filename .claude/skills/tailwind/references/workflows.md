# Tailwind CSS v4 Workflows

## Contents
- Adding a New Design Token
- Setting Up shadcn/ui
- Adding Dark Mode Toggle
- Building Responsive Layouts
- Debugging Styles

---

## Adding a New Design Token

Copy this checklist and track progress:
- [ ] Define the token in `app/globals.css` under `@theme` or `:root`
- [ ] Add dark mode variant in `:root`/`.dark` if applicable
- [ ] Use the generated utility class in components
- [ ] Validate: `npm run build`

### Example: Adding a Sidebar Color

```css
:root { --sidebar: #f8fafc; }
@media (prefers-color-scheme: dark) { :root { --sidebar: #0f172a; } }
@theme inline { --color-sidebar: var(--sidebar); }
```

```tsx
<aside className="w-64 border-r bg-sidebar">
```

Token naming: `--color-{name}` maps to `bg-{name}`, `text-{name}`, `border-{name}`. Use semantic names (`sidebar`, `destructive`) not visual names (`light-blue`).

---

## Setting Up shadcn/ui

shadcn/ui is planned but not yet installed. See the **frontend-design** skill for component selection.

Copy this checklist and track progress:
- [ ] Run `npx shadcn@latest init`
- [ ] Select "New York" style (data-dense financial UI)
- [ ] Verify `globals.css` was updated with shadcn CSS variables and `@theme inline` mappings
- [ ] Confirm `lib/utils.ts` has the `cn()` function
- [ ] Add components: `npx shadcn@latest add button card table dialog`
- [ ] Validate: `npm run build`

1. Run `npx shadcn@latest init`
2. Validate: `npm run build`
3. If build fails, check `globals.css` for missing `@theme inline` mappings
4. Only proceed when build passes

---

## Adding Dark Mode Toggle

The project uses `prefers-color-scheme` (automatic). To add a manual toggle:

Copy this checklist and track progress:
- [ ] Switch from media query to class-based variant in `globals.css`
- [ ] Add theme provider component
- [ ] Add toggle UI
- [ ] Persist preference to localStorage

### Step 1: Update globals.css

```css
/* Replace @media (prefers-color-scheme: dark) with: */
@custom-variant dark (&:where(.dark, .dark *));

:root { --background: #ffffff; --foreground: #171717; }
.dark { --background: #0a0a0a; --foreground: #ededed; }
```

### Step 2: Theme Provider

```tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "system", setTheme: () => {},
});

export function ThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  }, [theme]);
  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export const useTheme = () => useContext(ThemeContext);
```

See the **react** skill for context patterns. See the **nextjs** skill for wrapping in root layout.

---

## Building Responsive Layouts

### Dashboard Shell

```tsx
<div className="flex min-h-screen">
  <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">{/* nav */}</aside>
  <div className="flex flex-1 flex-col">
    <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background px-4" />
    <main className="flex-1 p-4 md:p-6">{children}</main>
  </div>
</div>
```

### Container Queries (v4 built-in)

```tsx
<div className="@container">
  <div className="flex flex-col gap-2 @sm:flex-row @sm:items-center @sm:justify-between">
    <span className="text-sm font-medium">Office Supplies</span>
    <span className="text-sm tabular-nums text-muted-foreground">$350.00</span>
  </div>
</div>
```

---

## Debugging Styles

### Common Build Failures

| Error | Cause | Fix |
|-------|-------|-----|
| Unknown utility `bg-primary` | Missing `--color-primary` in `@theme` | Add token to `globals.css` |
| `@tailwind` not valid | v3 syntax in v4 | Replace with `@import "tailwindcss"` |
| Styles missing in CSS modules | No `@reference` import | Add `@reference "../../app/globals.css"` |
| `@apply` not resolving | Cross-file usage | Use `@reference` or replace with inline utilities |

### Validation Loop

1. Make style changes
2. Validate: `npm run build`
3. If unknown utility error, add missing token to `@theme` in `globals.css`
4. If styles don't appear, check browser DevTools for the CSS variable
5. Only proceed when build passes and styles render correctly
