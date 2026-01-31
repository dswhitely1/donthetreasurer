All 7 files have been generated. Here's a summary of what was created:

**`.claude/skills/react/SKILL.md`** - Main skill file covering:
- Server vs Client component patterns with `"use client"` directive rules
- `Readonly<>` props convention (matching existing `app/layout.tsx` pattern)
- Import ordering per CLAUDE.md conventions
- Context7 library ID resolved: `/websites/react_dev` (score 91.7)
- Cross-references to all 7 related skills

**`references/hooks.md`** - Custom hook patterns:
- Domain hooks for organizations, transactions, categories using TanStack Query
- WARNING: useEffect data fetching anti-pattern with financial app consequences
- WARNING: Missing dependency array items causing stale closures
- WARNING: State for derived values (critical for line item sum validation)

**`references/components.md`** - Component architecture:
- File organization matching planned `components/` structure
- Server vs Client component decision tree
- WARNING: Inline object props breaking memoization
- WARNING: Index as key in dynamic line item lists
- Domain components: AmountDisplay, CategoryLabel, PageHeader

**`references/data-fetching.md`** - Data strategy:
- Server Component → Supabase server client, Client → TanStack Query
- WARNING: `@tanstack/react-query` not yet in package.json (with install instructions + QueryProvider setup)
- Mutation patterns for transaction status updates
- Loading/error state handling at both Server and Client levels

**`references/state.md`** - State management:
- Four categories: UI (useState), Client (Context), Server (TanStack Query), URL (searchParams)
- ActiveOrgProvider context pattern for organization switching
- WARNING: Prop drilling past 3 levels
- URL state pattern for shareable transaction filters

**`references/forms.md`** - Form handling:
- WARNING: react-hook-form, zod, @hookform/resolvers not yet installed
- Full transaction form with `useFieldArray` for split line items
- Zod schema with `.refine()` for line items sum validation
- Server Action integration with `revalidatePath`
- Form workflow checklist

**`references/performance.md`** - Performance optimization:
- `React.memo` for transaction table rows
- `useCallback` for stable handlers passed to memoized children
- WARNING: Inline object props anti-pattern
- Code splitting with `lazy()` and `next/dynamic`
- Domain-specific: category tree and running balance memoization

The skill contains **30+ code blocks** across all files, all using TypeScript and matching the project's conventions.