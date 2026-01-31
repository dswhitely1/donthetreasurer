All three files are generated above. Summary of what's included:

**SKILL.md** (~130 lines): QueryClient setup for Next.js App Router with the `isServer` pattern, domain query hook example with Supabase, key concepts table, dependent query pattern, mutation with cascade invalidation, and Context7 documentation references using library ID `/websites/tanstack_query_v5`.

**references/patterns.md** (~145 lines): Query key factory mirroring the Treasurer entity hierarchy, Supabase integration pattern (throw on error), SSR prefetching with `HydrationBoundary`, conditional queries with `enabled`, mutation cache invalidation across related entities (transactions + accounts), optimistic updates for transaction status changes, and three documented anti-patterns (useEffect fetching, stale closures from missing key values, missing error boundaries).

**references/workflows.md** (~140 lines): Installation checklist, step-by-step workflow for adding new domain query hooks, mutation + react-hook-form integration workflow, SSR prefetch workflow with server Supabase client, test utilities setup with `renderWithQuery`, and a debugging guide for stale data issues. All workflows include copyable checklists.

Cross-references to related skills: **supabase**, **react**, **nextjs**, **typescript**, **zod**, **react-hook-form**. 18 code blocks total across all files.