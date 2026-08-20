# Student Balance Letters — Design

**Date:** 2026-08-20
**Status:** Approved for planning

## Problem

A treasurer needs to notify families whose students still owe money for a
season. Today the app can produce a season report listing every enrollment and
its balance, but there is no way to produce per-family correspondence. The
treasurer retypes letters by hand.

## Goal

Let a treasurer maintain a library of reusable letter templates and generate, in
one click, a printable PDF containing one letter per student who still owes
money for a given season.

## Scope

**In scope**
- Org-level letter template library (create, edit, delete, set default)
- Placeholder substitution with a fixed, validated vocabulary
- Band director details stored on the organization and printed as the signature
- A season-scoped generation flow with an editable recipient list
- A multi-page PDF, one letter per page, for printing and handing out

**Out of scope**
- Emailing letters from the app (no mail service exists in the project)
- Postal mailing address blocks (letters are handed out, not mailed)
- Any record of which letters were generated or when (generation is stateless)
- Rich-text formatting (plain text only)
- Per-template layout control (block ordering)

## Decisions

These were settled during brainstorming and are not open questions.

| Question | Decision |
|---|---|
| Letter text configurability | Saved, editable templates in the database |
| Delivery | Printed / handed out — no email, no mailing addresses |
| Templates per org | Multiple named templates, one markable as default |
| Recipient selection | Pre-checked list of everyone owing, treasurer may uncheck |
| History tracking | None — stateless generation |
| Editor | Plain text body plus separate heading and closing fields |
| Auto-printed content | Letterhead + date, balance summary block, payment history |
| Director storage | Four columns on `organizations` |
| Withdrawn enrollments | Never receive a letter, even if they still owe |

## Architecture

Four layers, each independently testable:

1. **Data** — `letter_templates` table; director columns on `organizations`
2. **Pure logic** — placeholder vocabulary and template rendering; no DB, no React
3. **PDF** — letter batch renderer built on jsPDF, mirroring the existing season report generator
4. **Routes/UI** — org-scoped template CRUD; season-scoped generation flow; one POST API route

The generation flow reuses the existing `fetchSeasonReport` pipeline rather than
introducing a second way to compute balances. There is exactly one definition of
what a student owes.

## Data Model

### Migration: director fields on `organizations`

Four nullable columns:

| Column | Type | Notes |
|---|---|---|
| `director_name` | TEXT | e.g. "Jane Doe" |
| `director_title` | TEXT | free text, e.g. "Band Director" |
| `director_email` | TEXT | optional contact line |
| `director_phone` | TEXT | optional contact line |

Nullable because existing organizations have no director recorded, and because
seasons (and therefore letters) are an optional feature.

Stored on the organization rather than the season so that replacing the director
is a single edit that every template and future letter picks up. Editing happens
in the existing inline org form in
`app/(dashboard)/organizations/[orgId]/organization-actions.tsx` — no new page.

### Migration: `letter_templates`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `uuid_generate_v4()` |
| `organization_id` | UUID NOT NULL | FK → `organizations`, `ON DELETE CASCADE` |
| `name` | TEXT NOT NULL | e.g. "First Notice" |
| `heading` | TEXT | optional line under the letterhead |
| `body` | TEXT NOT NULL | blank line separates paragraphs |
| `closing` | TEXT | sign-off phrase only, e.g. "Sincerely," |
| `is_default` | BOOLEAN NOT NULL DEFAULT FALSE | pre-selected when generating |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | managed by the existing `update_updated_at()` trigger |

Constraints and indexes:
- `UNIQUE (organization_id, name)` — keeps the picker unambiguous
- Partial unique index on `(organization_id) WHERE is_default` — at most one default per org
- Index on `organization_id`
- RLS policy copied from `seasons`:
  `organization_id IN (SELECT id FROM organizations WHERE treasurer_id = auth.uid())`

`ON DELETE CASCADE` is correct here, unlike categories: deleting a template
destroys no financial record, so templates hard-delete.

`closing` holds only the sign-off phrase because the name beneath it is rendered
from the organization's director fields.

After both migrations, regenerate `types/database.ts` via
`npx supabase gen types typescript`.

## Placeholder Vocabulary

`lib/letters/placeholders.ts` exports one `as const` array of
`{ token, label, description }`, consumed by both the click-to-insert UI and the
renderer. Adding a token is a one-line change in one file.

```
{{organization_name}}  {{season_name}}       {{season_start_date}}  {{season_end_date}}
{{student_first_name}} {{student_last_name}} {{student_full_name}}  {{guardian_name}}
{{fee_amount}}         {{total_paid}}        {{balance_due}}        {{today}}
{{director_name}}      {{director_title}}    {{director_email}}     {{director_phone}}
```

Rules:
- `{{guardian_name}}` falls back to the student's full name when the guardian
  column is empty, so no letter is addressed to a blank.
- Director tokens render as empty strings when unset. The generate page warns
  before producing unsigned letters but does not block.
- Currency tokens format via the existing `formatCurrency()`, dates via
  `formatDate()`, both from `lib/utils.ts`.

## Rendering Engine

`lib/letters/render-template.ts`, two pure functions:

- `buildTokenValues(context) → Record<PlaceholderToken, string>` — formats money
  and dates, applies the guardian fallback, coerces nulls to `""`.
- `renderTemplate(text, values) → string` — a single
  `String.replace(/\{\{\s*(\w+)\s*\}\}/g, fn)` pass.

The replacer is a **function, not a string**, and this is deliberate:

- Single-pass, so a substituted value that itself contains `{{balance_due}}` is
  never re-expanded.
- A `$&` or `$1` sequence inside a student's name cannot corrupt the output.

Unknown tokens render as an empty string. Save-time validation is the real guard
against typos.

`lib/letters/types.ts` defines `LetterRecipient` and `LetterBatchData`
(organization + director + season + template + recipients).

### Change to existing code

`SeasonReportEnrollment.studentName` is formatted `"Last, First"`, but
placeholders need the parts separately. Add `studentFirstName` and
`studentLastName` to the interface and populate them in
`lib/seasons/fetch-season-report.ts`. This is purely additive — the existing
Excel and PDF season reports are unaffected. Splitting the joined string back
apart at render time would be the wrong fix.

## PDF Output

`lib/pdf/generate-letters.ts`, structured like
`lib/pdf/generate-season-report.ts` but **portrait**, not landscape. One page per
recipient:

```
Acme Band Boosters                              August 20, 2026
Outstanding Balance Notice

<rendered body, paragraph-wrapped>

┌──────────────────────────────┐
│ Season Fee          $ 450.00 │
│ Total Paid          $ 200.00 │
│ Balance Due         $ 250.00 │
└──────────────────────────────┘

Payments Received
03/02/2026   $100.00   Check #1043
04/11/2026   $100.00   Cash

Sincerely,

Jane Doe
Band Director
jane@band.org
```

- The greeting lives in the template body (e.g. `Dear {{guardian_name}},`), so
  the treasurer controls its wording.
- The heading line is omitted entirely when blank.
- Body paragraphs split on blank lines and wrap via `splitTextToSize`.
- Balance summary and payment history are `autoTable` calls.
- With no payments recorded, the history section reads
  "No payments received to date."
- Signature block omits email and phone lines when those fields are null.
- A letter that overflows continues onto a second page; the next recipient always
  starts on a fresh page, so no page ever shows two families' balances.
- **No page numbers**, unlike the season report — "Page 3 of 40" on a letter
  handed to a student leaks the size of the delinquency list.

## Routes and UI

### Template CRUD

`app/(dashboard)/organizations/[orgId]/letter-templates/`, following the
`budgets/` layout:

| File | Role |
|---|---|
| `page.tsx` | list: name, default badge, updated date, empty state |
| `new/page.tsx` | wraps the shared form |
| `[templateId]/edit/page.tsx` | wraps the shared form |
| `letter-template-form.tsx` | client form: name, heading, body, closing, make-default |
| `template-actions.tsx` | delete with confirm; set default |
| `actions.ts` | `createLetterTemplate`, `updateLetterTemplate`, `deleteLetterTemplate`, `setDefaultLetterTemplate` |

Actions follow the project convention: Zod validate → mutate → `revalidatePath()`
→ `redirect()`, returning `{ error: string }` or `null`.

The form includes:
- A **click-to-insert placeholder palette** rendered from `LETTER_PLACEHOLDERS`,
  inserting at the cursor position.
- A **live preview pane** running the real `renderTemplate()` against fixed
  sample data, so the treasurer sees the letter while typing rather than
  round-tripping through a PDF.

On the create form only, `closing` pre-fills with `"Sincerely,"`. This is a form
default, not a database default, so an intentionally blank closing stays blank on
edit.

`setDefaultLetterTemplate` clears the previous default in the same action;
otherwise the partial unique index rejects the write.

Validation lives in `lib/validations/letter-template.ts`, mirroring
`lib/validations/season.ts`: `name` 1–100, `heading` ≤150 optional, `body`
1–5000, `closing` ≤300 optional, plus a refinement rejecting unknown
placeholders so `{{ballance_due}}` fails at save instead of printing literally on
forty letters.

### Navigation

`components/layout/sidebar.tsx` gains
`{ label: "Letters", href: "/letter-templates", icon: Mail }` in the existing
`seasonNavItems` array, so it is gated by `seasons_enabled` alongside Seasons and
Students.

### Generation flow

`app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/letters/page.tsx`,
reached from a "Generate Letters" button beside the existing export buttons on
the season detail page.

The server component calls `fetchSeasonReport`, then filters recipients to
enrollments where `balanceDue > 0` **and** `enrollmentStatus === "enrolled"`.
Withdrawn students never receive a letter, even when they still owe.

`generate-letters-form.tsx` (client) provides the template picker, an
all-checked recipient table (name / fee / paid / balance), select-all, a live
count, and the Generate button.

The picker pre-selects the template marked `is_default`. When no template is
marked default, it pre-selects the most recently updated one rather than
starting empty, so the common case is still one click.

### API route

`app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.ts`, **POST**,
body `{ template_id, enrollment_ids[] }` validated with Zod.

POST rather than the GET used by existing exports because forty UUIDs in a query
string is fragile. The client does `fetch` → `blob` → anchor download.

Authorization repeats the guard chain from the existing season PDF route
(`getUser()`, org lookup, `seasons_enabled` check) and adds
`.eq("organization_id", orgId)` to the template fetch.

The recipient list is built by filtering `fetchSeasonReport`'s output down to the
requested IDs. An ID belonging to another season simply fails to match and is
dropped. **Client input can only narrow the set, never widen it.**

Response headers mirror the existing PDF export: `Content-Type: application/pdf`
and a sanitized `Content-Disposition` filename of the form
`{Org}_Letters_{Season}_{YYYY-MM-DD}.pdf`, reusing the same `safeName()`
sanitizing already used by the season PDF route.

## Error Handling

| Case | Behavior |
|---|---|
| No templates exist | Empty state on the generate page linking to template creation |
| Nobody owes | "Everyone is paid up for this season" — no PDF produced |
| Director fields blank | Warning banner linking to org settings; generation still allowed |
| All recipients unchecked | Generate button disabled |
| Template deleted mid-flow | 404 JSON response; inline error banner next to the Generate button |
| Season not found / not owned | 404, matching the existing season PDF route |
| `seasons_enabled` false | 404, matching the existing season PDF route |
| PDF generation throws | 500 with a generic message; details logged server-side |

## Testing

| File | Covers |
|---|---|
| `lib/letters/render-template.test.ts` | every token substitutes; unknown tokens empty; guardian fallback; re-expansion and `$&` injection cases; null director coercion |
| `lib/validations/letter-template.test.ts` | field bounds; unknown-placeholder refinement |
| `lib/pdf/generate-letters.test.ts` | page count equals recipient count; zero-payment recipient; null director omits lines; overflow paginates |
| `app/(dashboard)/organizations/[orgId]/letter-templates/actions.test.ts` | CRUD; set-default swap clears the prior default |
| `app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.test.ts` | unauthenticated rejection; `seasons_enabled` gate; cross-season ID filtering; withdrawn exclusion; response headers |

These paths already fall under the coverage targets configured in
`vitest.config.ts`.

## Risks

- **jsPDF text layout.** Vertical flow with variable-length bodies plus two
  tables is the most likely source of visual defects. Mitigated by building the
  layout with explicit cursor tracking and asserting page counts in tests, but
  the output should be eyeballed once with real data.
- **Placeholder validation drift.** If a token is removed from
  `LETTER_PLACEHOLDERS` while saved templates still reference it, those templates
  render it empty and fail re-validation on next edit. Acceptable: the vocabulary
  is expected to grow, not shrink.
