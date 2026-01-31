All six skill files have been generated. Here's a summary of what was created:

**Files created:**

| File | Lines | Focus |
|------|-------|-------|
| `.claude/skills/frontend-design/SKILL.md` | ~100 | Entry point — theme tokens, financial data styling, status indicators |
| `references/aesthetics.md` | ~140 | Typography (Geist), oklch color system, income/expense semantics, dark mode, accessibility |
| `references/components.md` | ~140 | shadcn/ui setup, `cn()` utility, financial cards, form fields, status icons, empty states |
| `references/layouts.md` | ~145 | Dashboard shell, sidebar + org switcher, responsive breakpoints, data table containers, spacing scale |
| `references/motion.md` | ~140 | CSS transitions only (no library), skeletons, loading states, expand/collapse, reduced motion |
| `references/patterns.md` | ~145 | DO/DON'T pairs, split transaction visuals, anti-AI-aesthetic guidance, new component checklist |

**Key design decisions documented:**

- **Neutral base** over zinc/slate (no chromatic bias on financial data)
- **`tabular-nums`** mandatory on all monetary values for column alignment
- **Income/expense** always paired with `+`/`-` prefix (not color alone) for accessibility
- **Status triad**: amber (uncleared), emerald (cleared), blue (reconciled) with icon + text
- **No animation on financial figures** — numbers appear instantly, only containers animate
- **Flagged the `globals.css` bug**: the body `font-family: Arial` rule overrides the Geist font variables