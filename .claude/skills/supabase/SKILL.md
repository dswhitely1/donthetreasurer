The three skill files have been generated:

1. **`.claude/skills/supabase/SKILL.md`** — Quick overview with client setup patterns, key concepts table, common query patterns, related skills, and Context7 library IDs for doc lookups.

2. **`.claude/skills/supabase/references/patterns.md`** — Covers the three-client architecture (browser, server, middleware), RLS ownership chain patterns, auth patterns (`getUser` vs `getSession`), type-safe client setup, nested query patterns, and anti-patterns (service role key exposure, N+1 queries, skipping middleware, forgetting RLS).

3. **`.claude/skills/supabase/references/workflows.md`** — Step-by-step workflows for project setup, migration creation/application, type generation feedback loop, auth flow implementation (sign up/in/out with Server Actions), the Server Action CRUD pattern, and deployment checklist.

Key decisions:
- Used `NEXT_PUBLIC_SUPABASE_ANON_KEY` (matching `CLAUDE.md` env vars) rather than the `PUBLISHABLE_KEY` naming from newer Supabase docs
- All examples use the App Router + Server Actions pattern specified in the PRD
- Cross-referenced `nextjs`, `typescript`, `zod`, and `tanstack-query` skills where relevant
- Included 17 code blocks across all files
- WARNING sections cover the most dangerous mistakes: service role key exposure, missing RLS, editing applied migrations, N+1 queries, and skipping middleware