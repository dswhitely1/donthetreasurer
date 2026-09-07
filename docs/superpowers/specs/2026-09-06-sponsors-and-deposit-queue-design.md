# Sponsors, Sponsorship Levels, and the Deposit Queue — Design

**Date:** 2026-09-06
**Status:** Approved for planning

## Problem

A booster organization sells sponsorships: a business or family pays a set
amount for a school year and receives recognition in return. Checks and cash
arrive over weeks, pile up, and get carried to the bank in one deposit. PayPal
sponsorships arrive electronically and never ride along in that deposit.

The app has no record of any of this. The treasurer tracks sponsors in a
spreadsheet, then hand-enters a deposit as a single lump-sum transaction —
losing which sponsors made it up — and retypes acknowledgment letters by hand
at tax time.

## Goal

Let a treasurer configure sponsorship levels, log each sponsorship payment as
it arrives into a queue, turn a selection from that queue into one correctly
split deposit transaction, renew sponsors year over year, and generate
501(c)(3) acknowledgment letters for a sponsorship year.

## Scope

**In scope**
- Configurable sponsor levels (name, default amount, description)
- Sponsor records with contact and mailing address
- Sponsorship records that double as the payment that created them
- A queue of undeposited sponsorships, and a deposit builder that turns a
  selection into one split income transaction
- Renewal of a sponsor into the next sponsorship year with an editable level
- Sponsor acknowledgment letters, batched per sponsorship year, reusing the
  existing letter-template machinery
- An org-level `sponsors_enabled` feature flag

**Out of scope**
- Pledges or commitments recorded before money arrives
- Installment payments against one sponsorship (see Accepted Trade-offs)
- Emailing letters (no mail service exists in the project)
- Sponsor-facing benefits fulfilment tracking (banners, program ads, tickets)
- Sponsorship figures in the Excel/PDF financial reports — deposits already
  flow into those as ordinary categorized income
- A generic, non-sponsor deposit queue for other cash sources

## Decisions

Settled during brainstorming. These are not open questions.

| Question | Decision |
|---|---|
| Time dimension | Sponsorships have a term, defaulting to the org's fiscal year (July–June for CCV), with an editable end date |
| Level definition | Name plus a default amount; the amount prefills and is editable per sponsorship |
| Pledge stage | None — logging a payment creates the sponsorship |
| Payments per sponsorship | Exactly one; a sponsorship row *is* its payment |
| Deposit shape | One income transaction per deposit, one split line per sponsor |
| PayPal | Same queue, tagged by method, but deposited as its own batch into the PayPal account; existing account fee config creates the companion fee expense |
| Line categories | Chosen at deposit time, with an apply-to-all-lines control |
| Feature gating | Own `sponsors_enabled` org flag; the deposit action lives on the Transactions page |
| Letters | In scope, batched per sponsorship year, reusing `letter_templates` |
| Queue state | Derived from `transaction_id IS NULL` — no status column |

## Architecture

Four layers, each independently testable:

1. **Data** — three new tables, one org flag, one column and one index change
   on `letter_templates`
2. **Pure logic** — sponsorship-year date arithmetic; a type-scoped placeholder
   vocabulary; token building for sponsor letters. No DB, no React.
3. **Actions and routes** — sponsor/level/sponsorship CRUD as Server Actions; a
   deposit Server Action; one POST API route for the letter PDF
4. **UI** — sponsor pages behind the flag, a deposit builder reached from the
   Transactions page, a letters generation page

The deposit action creates transactions through the same rules the existing
transaction form uses, including the processing-fee companion. There is exactly
one definition of how a fee transaction is created (see *Change to Existing
Code*).

## Data Model

Three migrations, in this order.

### Migration: `20260906000001_sponsors.sql`

**`organizations.sponsors_enabled`** — `BOOLEAN NOT NULL DEFAULT FALSE`,
mirroring `seasons_enabled`.

**`sponsor_levels`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `uuid_generate_v4()` |
| `organization_id` | UUID NOT NULL | FK → `organizations`, `ON DELETE CASCADE` |
| `name` | TEXT NOT NULL | e.g. "Gold" |
| `default_amount` | DECIMAL(12,2) NOT NULL DEFAULT 0.00 | `CHECK (default_amount >= 0)` |
| `description` | TEXT | benefits blurb, optional |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | controls picker order |
| `is_active` | BOOLEAN NOT NULL DEFAULT TRUE | retire a level without deleting it |
| `created_at` / `updated_at` | TIMESTAMPTZ | `updated_at` via the existing trigger |

- `UNIQUE (organization_id, name)`
- Index on `organization_id`

**`sponsors`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `organization_id` | UUID NOT NULL | FK → `organizations`, `ON DELETE CASCADE` |
| `name` | TEXT NOT NULL | business or individual |
| `contact_name` | TEXT | person to address |
| `email` / `phone` | TEXT | |
| `address_line1` / `address_line2` / `city` / `state` / `postal_code` | TEXT | mailing address for letters |
| `notes` | TEXT | |
| `is_active` | BOOLEAN NOT NULL DEFAULT TRUE | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

- Index on `organization_id`, and on `(organization_id, name)` for the picker

**`sponsorships`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `sponsor_id` | UUID NOT NULL | FK → `sponsors`, `ON DELETE RESTRICT` |
| `level_id` | UUID NOT NULL | FK → `sponsor_levels`, `ON DELETE RESTRICT` |
| `term_start_date` | DATE NOT NULL | |
| `term_end_date` | DATE NOT NULL | `CHECK (term_start_date < term_end_date)` |
| `amount` | DECIMAL(12,2) NOT NULL | `CHECK (amount > 0)` |
| `payment_method` | TEXT NOT NULL | `CHECK (payment_method IN ('cash','check','paypal','other'))` |
| `check_number` | TEXT | |
| `received_date` | DATE NOT NULL | when the money reached the treasurer |
| `notes` | TEXT | |
| `transaction_id` | UUID | FK → `transactions`, `ON DELETE SET NULL` |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

- Index on `sponsor_id`, on `transaction_id`, and a partial index on
  `(sponsor_id) WHERE transaction_id IS NULL` for the queue view
- Index on `(term_start_date, term_end_date)` for the letters year picker

`ON DELETE RESTRICT` on both FKs matches the category rule already in the
codebase: a level or sponsor with financial history cannot be deleted, only
deactivated.

**No `status` column.** The queue is exactly `transaction_id IS NULL`. A single
source of truth cannot disagree with itself, and `ON DELETE SET NULL` means
deleting a deposit transaction returns its sponsorships to the queue rather
than stranding them in a stale `'deposited'` state.

There is deliberately no `deposited_at` companion column either: the database
can null `transaction_id` on delete but cannot clear a timestamp beside it, so
the two would drift. The deposit transaction already carries its own date.

**No `line_item_id`.** The existing "reassign line item categories" feature
would make such a link go stale, and nothing needs it.

**No category column anywhere.** Categories are chosen at deposit time and live
only on the resulting line items — so unlike the budgets, templates, and
seasons migrations, this one does **not** require updating the
`merge_categories` RPC.

**RLS**, following `season_enrollments`:

```sql
-- sponsor_levels, sponsors
organization_id IN (SELECT id FROM organizations WHERE treasurer_id = auth.uid())

-- sponsorships
sponsor_id IN (
  SELECT s.id FROM sponsors s
  JOIN organizations o ON s.organization_id = o.id
  WHERE o.treasurer_id = auth.uid()
)
```

`set_updated_at` triggers on all three tables.

### Migration: `20260906000002_letter_template_types.sql`

- `ALTER TABLE letter_templates ADD COLUMN template_type TEXT NOT NULL DEFAULT
  'season_balance' CHECK (template_type IN ('season_balance',
  'sponsor_acknowledgment'))` — existing rows backfill via the default.
- Drop `idx_letter_templates_one_default` and recreate it as a partial unique
  index on `(organization_id, template_type) WHERE is_default`, so an org can
  hold one default season letter and one default sponsor letter at once.
- `UNIQUE (organization_id, name)` is left unchanged. Scoping names by type
  would be marginally nicer and is not worth the churn.

After both migrations, regenerate `types/database.ts` via
`npx supabase gen types typescript`.

## Sponsorship Year

`lib/sponsors/sponsorship-year.ts`, pure and unit-tested:

- `getSponsorshipTerm(fiscalYearStartMonth, referenceDate) → { startDate, endDate }`
  returns the term containing `referenceDate`: start is the most recent first-of-
  the-fiscal-month on or before it, end is one year later minus a day. With
  `fiscal_year_start_month = 7`, a payment received 2026-10-14 yields
  2026-07-01 → 2027-06-30.
- `formatTermLabel(startDate, endDate) → string` — e.g. "2026–27".

Both dates are prefilled from this helper on the payment form and remain
editable, since a sponsorship may be sold on a non-standard term.

**Renewal** reads the sponsor's most recent sponsorship by `term_start_date`,
then opens the payment form for the next term with the level prefilled and
changeable. It is a prefill, not a copy: nothing is written until the treasurer
submits, so a renewal that never gets paid leaves no row behind.

## Queue and Deposit Flow

### Logging a payment

`/organizations/[orgId]/sponsorships/new` (optionally `?sponsor_id=` or
`?renew_from=`): sponsor, level, amount (prefilled from the level's
`default_amount`), term dates, payment method, check number, date received,
notes. On save the sponsorship exists with `transaction_id IS NULL` — it is in
the queue.

### Building the deposit

The Transactions page gains a "Deposit from queue" button beside the existing
new-transaction action, rendered only when `sponsors_enabled` and the queue is
non-empty, labelled with the queued count. It opens
`/organizations/[orgId]/transactions/deposit`.

The screen shows the queue grouped by payment method on one side and the
deposit being assembled on the other: account, date, description (defaulting to
"Sponsorship deposit"), status (same control as the transaction form, since a
deposit already on the statement should be enterable as cleared), and the
`apply_fee` checkbox when the chosen account carries fee config — all matching
the existing transaction form.

Each selected sponsorship becomes one line: amount fixed from the sponsorship,
memo prefilled `Sponsor Name — Level` and editable, and a category select. An
apply-to-all-lines category control sits above the list so a ten-check deposit
is one pick rather than ten.

### The deposit action

`app/(dashboard)/organizations/[orgId]/transactions/deposit/actions.ts`.

The submitted payload carries **sponsorship ids, category ids, and memos — never
amounts**. Amounts and payment methods are re-read from the database inside the
action, so a tampered form cannot post a deposit whose lines disagree with the
sponsorship records.

Validation, in order:

1. Every sponsorship id resolves to a sponsorship owned by this organization
   and currently unclaimed. Anything else is rejected as a whole.
2. PayPal items may not be mixed with cash/check/other items in one deposit —
   enforced server-side, not only in the UI.
3. Every line has a category belonging to the organization and still active.
4. At least one line.

Then, mirroring the compensating-transaction pattern the fee code already uses:

1. Insert the income transaction with `amount` = the server-computed sum.
2. Insert one line item per sponsorship.
3. Claim the sponsorships with an `UPDATE ... WHERE transaction_id IS NULL`
   filter and count the affected rows. If fewer rows were claimed than were
   selected, another tab or window deposited one first: delete the transaction
   and its line items, and return an error naming the conflict.
4. Create the fee companion transaction if applicable, via the extracted helper.
5. `revalidatePath()` the transactions and sponsors routes, then redirect to
   the new transaction.

### Editing after deposit

A deposited sponsorship locks `sponsor_id`, `amount`, `level_id`, and
`payment_method`, since its ledger line already exists — `notes` stay
editable. Deleting a deposited
sponsorship is blocked with a message pointing at the deposit transaction. This
follows the reconciled-transaction locking rule the app already applies.

Deleting the deposit transaction itself needs no special handling: `ON DELETE
SET NULL` returns every sponsorship on it to the queue.

## Change to Existing Code

The processing-fee companion currently lives inline in `createTransaction`
(`app/(dashboard)/organizations/[orgId]/transactions/actions.ts:169-232`) — the
fee calculation, the active-category re-check, the line item insert, and the
delete-on-failure rollback. The deposit action needs identical behavior.

Extract it to `lib/transactions/create-fee-companion.ts` as a function taking
the Supabase client, the account's fee config, the source transaction's amount
and description, and returning `{ error } | null`. `createTransaction` calls it
in place of its inline block; the deposit action calls the same function.

This is the only refactor proposed, and it sits directly in the path of the
work. Copying fifty lines of money-handling logic into a second action is how
the two silently diverge.

## Letters

### Placeholder vocabulary

`lib/letters/placeholders.ts` splits its flat `LETTER_PLACEHOLDERS` array into
a shared set plus one set per template type:

- **Shared** — `organization_name`, `organization_ein`, `today`,
  `director_name`, `director_title`, `director_email`, `director_phone`
- **`season_balance`** — every existing student/season token, unchanged
- **`sponsor_acknowledgment`** — `sponsor_name`, `contact_name`, `level_name`,
  `sponsorship_amount`, `received_date`, `payment_method`, `term_start_date`,
  `term_end_date`, `term_label`

`organization_ein` is new and shared: a 501(c)(3) acknowledgment normally
carries the EIN, and `organizations.ein` already exists.

`findUnknownPlaceholders(text, templateType)` becomes type-aware, so
`{{student_first_name}}` in a sponsor letter is caught at save time exactly as
a typo is today. `lib/validations/letter-template.ts` passes the type through.
The template form's click-to-insert palette lists only the active type's tokens
and re-renders when the type changes.

Existing templates keep working: their type backfills to `season_balance` and
their vocabulary is unchanged.

### Renderer generalization

`LetterRecipient` and `generateLettersPdf` are student-shaped today
(`studentFirstName`, `feeAmount`, a payments table). Generalize them to render
from precomputed token values plus an optional detail table:

- `LetterRecipient` becomes `{ id, tokenValues, detailTable? }` where
  `detailTable` is `{ title, rows }`.
- `LetterBatchData` keeps organization, director, template, and `generatedOn`,
  and drops its season-specific fields into the per-recipient token values.
- The season path builds that shape in its existing API route; its PDF output
  is unchanged.

The renderer's layout logic — pagination, paragraph splitting, signature block,
`ensureSpace` — is worth sharing. Its field names are not.

Sponsor letters use no detail table: a single sponsorship is fully described by
its tokens, and a one-row table would be noise.

### Generation flow

`/organizations/[orgId]/sponsor-letters`: a sponsorship-year picker (distinct
`(term_start_date, term_end_date)` pairs found in the data, defaulting to the
current term), a template picker limited to `sponsor_acknowledgment` templates,
and a recipient list.

The list includes **every** sponsorship in the term, deposited or not — a check
in hand is money received, whether or not the treasurer has been to the bank.
Deposit status shows on each row so one can be held back deliberately.

Selection posts to `POST /api/organizations/[orgId]/sponsor-letters` with
`{ template_id, sponsorship_ids }`, mirroring the season letters route: verify
the user, verify the org and its `sponsors_enabled` flag, verify the template
belongs to the org and is of the sponsor type, narrow the requested ids against
what the query actually returned (the client can narrow the set, never widen
it), and stream back one PDF with a page per sponsor.

`generatedOn` uses `new Date().toLocaleDateString("en-CA")` for the same reason
the season route documents: a UTC cutoff dates evening batches "tomorrow".

## Routes and Navigation

Sidebar gains a single "Sponsors" item (lucide `Handshake`) when
`sponsors_enabled`. Levels and Letters are reached from the sponsors index
rather than adding three sidebar entries.

One existing-nav fix: "Letters" (`/letter-templates`) is currently rendered
only under `seasons_enabled`. It must show when `seasons_enabled ||
sponsors_enabled`, or an org that uses sponsors but not seasons has no way to
reach the template library.

| Route | Purpose |
|---|---|
| `/organizations/[orgId]/sponsors` | Sponsor list, queue summary, links to levels and letters |
| `/organizations/[orgId]/sponsors/new` | Create sponsor |
| `/organizations/[orgId]/sponsors/[sponsorId]` | Detail: contact, sponsorship history, Renew |
| `/organizations/[orgId]/sponsors/[sponsorId]/edit` | Edit sponsor |
| `/organizations/[orgId]/sponsor-levels` | Level list and CRUD |
| `/organizations/[orgId]/sponsorships/new` | Log a payment (`?sponsor_id`, `?renew_from`) |
| `/organizations/[orgId]/sponsorships/[sponsorshipId]/edit` | Edit a sponsorship |
| `/organizations/[orgId]/sponsor-letters` | Batch letter generation |
| `/organizations/[orgId]/transactions/deposit` | Deposit builder |
| `POST /api/organizations/[orgId]/sponsor-letters` | Letter PDF |

Each page group gets `loading.tsx`, matching the seasons and students routes.

Every page and action re-checks `sponsors_enabled` server-side and 404s when it
is off — a feature flag that only hides nav links is not a boundary.

`sponsors_enabled` is edited in the existing inline org form
(`organization-actions.tsx`) beside `seasons_enabled`, and added to
`createOrganizationSchema` / `updateOrganizationSchema` with the same
`preprocess` boolean coercion.

## Validation Schemas

`lib/validations/sponsor.ts`:

- `SPONSOR_PAYMENT_METHODS = ['cash','check','paypal','other'] as const` with a
  label map, following `TRANSACTION_STATUSES`
- `createSponsorSchema` / `updateSponsorSchema`
- `createSponsorLevelSchema` / `updateSponsorLevelSchema`
- `createSponsorshipSchema` / `updateSponsorshipSchema` — term dates ordered,
  amount positive, `check_number` accepted only when the method is `check`
- `depositFromQueueSchema` — account, date, description, status, `apply_fee`,
  and a JSON `lines` string of `{ sponsorship_id, category_id, memo }`,
  matching how the transaction form already passes `line_items`
- `sponsorLetterRequestSchema` — `{ template_id, sponsorship_ids }`

Forms use `useActionState` with Server Actions, as the rest of this codebase
does.

## Testing

Colocated Vitest files, following the existing pattern:

| File | Covers |
|---|---|
| `lib/sponsors/sponsorship-year.test.ts` | Term boundaries across fiscal start months, year rollover, leap years |
| `lib/letters/placeholders.test.ts` | Extended: type-scoped vocabulary, cross-type token rejection |
| `lib/letters/render-template.test.ts` | Extended: sponsor token values and formatting |
| `lib/transactions/create-fee-companion.test.ts` | Extracted helper, including the rollback path |
| `.../sponsors/actions.test.ts` | Sponsor and level CRUD, delete-restrict behavior |
| `.../sponsorships/actions.test.ts` | Payment logging, renewal prefill, post-deposit field locking |
| `.../transactions/deposit/actions.test.ts` | Amounts derived server-side; PayPal mixing rejected; already-claimed race rolls the transaction back; fee companion on a fee-configured account |
| `.../api/.../sponsor-letters/route.test.ts` | Auth, flag check, template type check, id narrowing |

The deposit action test is the one that matters most: it is the only place in
this feature where money is written.

Note for the implementer: this repo has pre-existing `tsc` and `lint` failures
and a broken `test:coverage` script that predate this work. Verify against the
baseline rather than assuming a clean tree.

## Accepted Trade-offs

**A sponsorship cannot be paid in installments.** Two checks for one
sponsorship means two rows, which duplicates the level in the letter for that
sponsor. Accepted deliberately: in two years of running this, no sponsorship
has ever been paid in parts. If that changes, splitting a `sponsor_payments`
table out of `sponsorships` is a contained migration, and the absence of a
pledge stage means nothing else depends on the collapsed shape.

**A sponsor with two sponsorships in one term gets two letter pages.** Correct
for an itemized receipt, mildly redundant otherwise. Not worth merging logic
for until it happens.

**Sponsorship income appears in reports only as ordinary categorized income.**
There is no sponsor dimension in the Excel or PDF reports. A "sponsorships by
level for the year" report is a natural follow-up, deliberately not in this
build.
