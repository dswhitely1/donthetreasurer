All 7 files have been generated above. Here's a summary of what was produced:

**SKILL.md** (~120 lines) - Entry point with quick start examples for basic forms and split transaction forms, key concepts table, common patterns (computed totals, server action integration), related skill cross-references, and Context7 documentation lookup instructions using library ID `/websites/react-hook-form`.

**references/hooks.md** (~120 lines) - Covers `useForm`, `useFieldArray`, `useFormContext`, `watch`/`useWatch`, with anti-patterns for register-in-useEffect, index-as-key, and missing defaultValues.

**references/components.md** (~130 lines) - Form component architecture, `useController` for custom components, error display pattern, shadcn/ui integration, with anti-patterns for spreading register on non-inputs and mutating field arrays directly.

**references/data-fetching.md** (~100 lines) - Server Component → Form data flow, edit form data loading, Server Action submission, TanStack Query cache invalidation, plus a warning about the missing `@tanstack/react-query` dependency.

**references/state.md** (~110 lines) - State categories (form/server/UI/URL), form state via `formState`, derived state patterns, with anti-patterns for duplicating form values into useState and storing derived values in state.

**references/forms.md** (~140 lines) - Zod schema patterns for transactions/organizations, the full transaction form with split line items, currency input handling, server-side validation, floating-point comparison warning, and a 10-step new form checklist.

**references/performance.md** (~120 lines) - Re-render isolation with `useWatch`, `watch` vs `useWatch` vs `getValues` decision table, memoization patterns, large form optimization, with anti-patterns for full formState subscription and onChange mode with complex schemas.