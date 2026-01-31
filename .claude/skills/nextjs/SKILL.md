Generated the three Next.js skill files:

**`.claude/skills/nextjs/SKILL.md`** (~130 lines)
- Overview of the App Router architecture with route groups, Server Actions, and API Routes
- Quick start examples for Server Components, Server Actions, and API Routes
- Key concepts table, missing solution warnings, related skills, and Context7 documentation reference

**`.claude/skills/nextjs/references/patterns.md`** (~150 lines)
- Route organization matching the PRD structure with `(auth)` and `(dashboard)` groups
- Server Component vs Client Component decision guidance with code examples
- Server Action patterns with Zod validation
- API Route for Excel export
- Layout with auth guard and loading states
- 3 anti-patterns with WARNING blocks: `useEffect` data fetching, mutations during rendering, `"use client"` on pages

**`.claude/skills/nextjs/references/workflows.md`** (~150 lines)
- Step-by-step checklists for adding pages, Server Actions, and API Routes
- Supabase middleware setup for auth session refresh
- Build/lint validation with iterate-until-pass pattern
- 4 common build errors with fixes: `params` Promise type (Next.js 16), server/client import boundary, missing `"use client"`, metadata in client components