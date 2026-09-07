# Sponsors and Deposit Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a treasurer configure sponsorship levels, log sponsorship payments into a queue as they arrive, turn a selection from that queue into one correctly split deposit transaction, renew sponsors year over year, and generate 501(c)(3) acknowledgment letters.

**Architecture:** Three new tables (`sponsor_levels`, `sponsors`, `sponsorships`) behind a `sponsors_enabled` org flag. A sponsorship row doubles as the payment that created it; the queue is exactly `transaction_id IS NULL`. A deposit Server Action re-reads amounts from the database and writes one income transaction with one line item per sponsor. Letters reuse `letter_templates` by adding a `template_type` column and splitting the placeholder vocabulary per type.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 strict · Supabase (PostgreSQL + RLS) · Zod 4 · jsPDF + jspdf-autotable · date-fns 4 · Vitest 4 · Tailwind CSS 4 · shadcn/ui

**Spec:** `docs/superpowers/specs/2026-09-06-sponsors-and-deposit-queue-design.md`

## Global Constraints

- **Branch:** all work lands on `feat/sponsors-and-deposit-queue`. Never commit to `main`.
- **Forms use `useActionState` with Server Actions.** This codebase does not use react-hook-form despite what CLAUDE.md says. Mirror `app/(dashboard)/organizations/[orgId]/students/student-form.tsx`.
- **Server Actions** return `{ error: string } | null`, call `revalidatePath("/dashboard", "layout")`, then `redirect()`. Mirror `app/(dashboard)/organizations/[orgId]/students/actions.ts`.
- **Auth:** always `supabase.auth.getUser()`, never `getSession()`.
- **Every sponsor page and action re-checks `sponsors_enabled` server-side** and 404s (pages) or errors (actions) when off. A flag that only hides nav links is not a boundary.
- **Naming:** files kebab-case, components PascalCase, functions camelCase, domain enums as `as const` arrays (never TS `enum`).
- **Imports:** React/Next → external → `@/lib`, `@/components`, `@/hooks` → relative → `import type`.
- **`params` and `searchParams` are Promises** in Next.js 16 — always `await` them.
- **Money is `DECIMAL(12,2)`** in the database and `number` in TypeScript. Format via `formatCurrency()` from `lib/utils.ts`, dates via `formatDate()`.
- **Tests are colocated** (`*.test.ts` beside the source). Run a single file with `npx vitest run <path>`.
- **Baseline is not clean.** This repo has pre-existing `tsc` and `lint` failures and a broken `test:coverage` script that predate this work. Capture the baseline before Task 1 and compare against it — do not chase failures you did not cause.

---

## File Structure

**New — data and pure logic**
| File | Responsibility |
|---|---|
| `supabase/migrations/20260906000001_sponsors.sql` | Three tables, the org flag, indexes, RLS, triggers |
| `supabase/migrations/20260906000002_letter_template_types.sql` | `template_type` column and the reworked default index |
| `lib/sponsors/sponsorship-year.ts` | Term arithmetic; wraps `lib/fiscal-year.ts` |
| `lib/validations/sponsor.ts` | Every Zod schema for sponsors, levels, sponsorships, deposits, letters |
| `lib/transactions/create-fee-companion.ts` | Fee companion transaction, extracted from `createTransaction` |

**New — routes**
| File | Responsibility |
|---|---|
| `app/(dashboard)/organizations/[orgId]/sponsor-levels/{page,actions,level-form,level-list}.tsx` | Level CRUD |
| `app/(dashboard)/organizations/[orgId]/sponsors/{page,actions,sponsor-form}.tsx` + `new/`, `[sponsorId]/`, `[sponsorId]/edit/` | Sponsor CRUD and detail |
| `app/(dashboard)/organizations/[orgId]/sponsorships/{actions,sponsorship-form}.tsx` + `new/`, `[sponsorshipId]/edit/` | Payment logging, editing, renewal |
| `app/(dashboard)/organizations/[orgId]/transactions/deposit/{page,actions,deposit-builder}.tsx` | Deposit builder |
| `app/(dashboard)/organizations/[orgId]/sponsor-letters/{page,generate-sponsor-letters-form}.tsx` | Letter batch UI |
| `app/api/organizations/[orgId]/sponsor-letters/route.ts` | Letter PDF |

**Modified**
| File | Change |
|---|---|
| `lib/validations/organization.ts` | `sponsors_enabled` |
| `app/(dashboard)/organizations/[orgId]/organization-actions.tsx` | `sponsors_enabled` toggle |
| `app/(dashboard)/organizations/[orgId]/transactions/actions.ts:169-232` | Call the extracted fee helper |
| `app/(dashboard)/organizations/[orgId]/transactions/page.tsx` | "Deposit from queue" button |
| `lib/letters/placeholders.ts` | Type-scoped vocabulary |
| `lib/letters/types.ts`, `lib/letters/render-template.ts`, `lib/pdf/generate-letters.ts` | Generalized recipient shape |
| `app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.ts` | Build the generalized shape |
| `lib/validations/letter-template.ts`, `.../letter-templates/*` | Template type |
| `components/layout/sidebar.tsx` | Sponsors nav; Letters gating fix |
| `types/database.ts` | Regenerated |

---

## Task 1: Migrations and the organization flag

**Files:**
- Create: `supabase/migrations/20260906000001_sponsors.sql`
- Modify: `lib/validations/organization.ts`
- Modify: `app/(dashboard)/organizations/[orgId]/organization-actions.tsx`
- Modify: `types/database.ts` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: nothing
- Produces: tables `sponsor_levels`, `sponsors`, `sponsorships`; `organizations.sponsors_enabled`; `Tables<"sponsors">`, `Tables<"sponsor_levels">`, `Tables<"sponsorships">` in `types/database.ts`

- [ ] **Step 1: Capture the baseline before touching anything**

```bash
npx tsc --noEmit 2>&1 | tail -20 > /tmp/baseline-tsc.txt
npm run lint 2>&1 | tail -20 > /tmp/baseline-lint.txt
npm test 2>&1 | tail -20 > /tmp/baseline-test.txt
cat /tmp/baseline-tsc.txt /tmp/baseline-lint.txt /tmp/baseline-test.txt
```

Expected: a handful of pre-existing `tsc` and `lint` errors. Record them. Every later "expected: passes" means "no new failures beyond this baseline".

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260906000001_sponsors.sql`:

```sql
-- Sponsors, configurable sponsorship levels, and the undeposited-payment queue.
ALTER TABLE public.organizations
  ADD COLUMN sponsors_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE public.sponsor_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (default_amount >= 0),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE TABLE public.sponsors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row is one sponsorship AND the single payment that created it.
-- The queue is exactly `transaction_id IS NULL`; there is deliberately no
-- status column and no deposited_at, because ON DELETE SET NULL can return a
-- row to the queue but cannot clear a companion timestamp beside it.
CREATE TABLE public.sponsorships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE RESTRICT,
  level_id UUID NOT NULL REFERENCES public.sponsor_levels(id) ON DELETE RESTRICT,
  term_start_date DATE NOT NULL,
  term_end_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'check', 'paypal', 'other')),
  check_number TEXT,
  received_date DATE NOT NULL,
  notes TEXT,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (term_start_date < term_end_date)
);

CREATE INDEX idx_sponsor_levels_organization ON public.sponsor_levels(organization_id);
CREATE INDEX idx_sponsors_organization ON public.sponsors(organization_id);
CREATE INDEX idx_sponsors_name ON public.sponsors(organization_id, name);
CREATE INDEX idx_sponsorships_sponsor ON public.sponsorships(sponsor_id);
CREATE INDEX idx_sponsorships_transaction ON public.sponsorships(transaction_id);
CREATE INDEX idx_sponsorships_queue ON public.sponsorships(sponsor_id) WHERE transaction_id IS NULL;
CREATE INDEX idx_sponsorships_term ON public.sponsorships(term_start_date, term_end_date);

ALTER TABLE public.sponsor_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access sponsor levels in their organizations" ON public.sponsor_levels
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access sponsors in their organizations" ON public.sponsors
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access sponsorships for their sponsors" ON public.sponsorships
  FOR ALL USING (
    sponsor_id IN (
      SELECT s.id FROM public.sponsors s
      JOIN public.organizations o ON s.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sponsor_levels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sponsors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sponsorships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

Note: no `merge_categories` RPC update is needed. Unlike the budgets, templates, and seasons migrations, no sponsor table holds a `category_id` — categories are chosen at deposit time and live only on line items.

- [ ] **Step 3: Apply the migration and regenerate types**

```bash
npx supabase db push
npx supabase gen types typescript --linked > types/database.ts
git diff --stat types/database.ts
```

Expected: `types/database.ts` gains `sponsor_levels`, `sponsors`, `sponsorships`, and `sponsors_enabled` on `organizations`.

- [ ] **Step 4: Add `sponsors_enabled` to the organization schema**

In `lib/validations/organization.ts`, directly after the `seasons_enabled` field in `createOrganizationSchema`:

```ts
  sponsors_enabled: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .default(false),
```

- [ ] **Step 5: Add the toggle to the organization form**

In `app/(dashboard)/organizations/[orgId]/organization-actions.tsx`, find the `seasons_enabled` checkbox and add an identically-structured one beside it named `sponsors_enabled`, labelled "Enable sponsor tracking", with helper text "Track sponsors, sponsorship levels, and a queue of payments waiting to be deposited." Make sure the organization update action reads `sponsors_enabled` out of the `FormData` and includes it in the `update()` payload — a checkbox that is never read is worse than no checkbox.

- [ ] **Step 6: Verify nothing regressed**

```bash
npx tsc --noEmit 2>&1 | tail -20
npm test 2>&1 | tail -10
```

Expected: no failures beyond the Step 1 baseline.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260906000001_sponsors.sql types/database.ts lib/validations/organization.ts "app/(dashboard)/organizations/[orgId]/organization-actions.tsx"
git commit -m "feat(sponsors): add sponsor tables, RLS, and the sponsors_enabled flag"
```

---

## Task 2: Sponsorship year arithmetic

**Files:**
- Create: `lib/sponsors/sponsorship-year.ts`
- Test: `lib/sponsors/sponsorship-year.test.ts`

**Interfaces:**
- Consumes: `getFiscalYearRange(fiscalStartMonth, referenceDate)` from `lib/fiscal-year.ts`, which already returns `{ start, end, label }` for the fiscal year containing the reference date
- Produces:
  - `interface SponsorshipTerm { startDate: string; endDate: string; label: string }`
  - `getSponsorshipTerm(fiscalYearStartMonth: number, referenceDate?: Date): SponsorshipTerm`
  - `getNextSponsorshipTerm(startDate: string, endDate: string): SponsorshipTerm`
  - `formatTermLabel(startDate: string, endDate: string): string`

- [ ] **Step 1: Write the failing test**

Create `lib/sponsors/sponsorship-year.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import {
  formatTermLabel,
  getNextSponsorshipTerm,
  getSponsorshipTerm,
} from "./sponsorship-year";

describe("getSponsorshipTerm", () => {
  it("returns July through June for a July fiscal start", () => {
    const term = getSponsorshipTerm(7, new Date(2026, 9, 14));
    expect(term.startDate).toBe("2026-07-01");
    expect(term.endDate).toBe("2027-06-30");
  });

  it("returns the prior term for a date before the fiscal start month", () => {
    const term = getSponsorshipTerm(7, new Date(2026, 2, 14));
    expect(term.startDate).toBe("2025-07-01");
    expect(term.endDate).toBe("2026-06-30");
  });

  it("returns a calendar year for a January fiscal start", () => {
    const term = getSponsorshipTerm(1, new Date(2026, 9, 14));
    expect(term.startDate).toBe("2026-01-01");
    expect(term.endDate).toBe("2026-12-31");
  });

  it("labels a term that spans two calendar years", () => {
    const term = getSponsorshipTerm(7, new Date(2026, 9, 14));
    expect(term.label).toBe("2026–27");
  });
});

describe("formatTermLabel", () => {
  it("uses a single year when the term does not span a year boundary", () => {
    expect(formatTermLabel("2026-01-01", "2026-12-31")).toBe("2026");
  });

  it("uses an en dash and a two-digit end year across a boundary", () => {
    expect(formatTermLabel("2026-07-01", "2027-06-30")).toBe("2026–27");
  });
});

describe("getNextSponsorshipTerm", () => {
  it("advances both dates by one year for a renewal", () => {
    const next = getNextSponsorshipTerm("2026-07-01", "2027-06-30");
    expect(next.startDate).toBe("2027-07-01");
    expect(next.endDate).toBe("2028-06-30");
    expect(next.label).toBe("2027–28");
  });

  it("preserves a non-standard term length", () => {
    const next = getNextSponsorshipTerm("2026-09-15", "2027-03-14");
    expect(next.startDate).toBe("2027-09-15");
    expect(next.endDate).toBe("2028-03-14");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/sponsors/sponsorship-year.test.ts`
Expected: FAIL — "Failed to resolve import ./sponsorship-year".

- [ ] **Step 3: Write the implementation**

Create `lib/sponsors/sponsorship-year.ts`:

```ts
import { addYears, format, parseISO } from "date-fns";

import { getFiscalYearRange } from "@/lib/fiscal-year";

export interface SponsorshipTerm {
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** Display label, e.g. "2026–27" */
  label: string;
}

/**
 * A term spanning two calendar years reads "2026–27"; one inside a single
 * calendar year is just that year. Uses an en dash, matching the date ranges
 * the reports already print.
 */
export function formatTermLabel(startDate: string, endDate: string): string {
  const startYear = startDate.slice(0, 4);
  const endYear = endDate.slice(0, 4);
  if (startYear === endYear) return startYear;
  return `${startYear}–${endYear.slice(2)}`;
}

/**
 * The sponsorship term containing `referenceDate`, derived from the
 * organization's fiscal year so a July–June org gets July–June sponsorships
 * without a second configuration knob.
 */
export function getSponsorshipTerm(
  fiscalYearStartMonth: number,
  referenceDate: Date = new Date()
): SponsorshipTerm {
  const range = getFiscalYearRange(fiscalYearStartMonth, referenceDate);
  return {
    startDate: range.start,
    endDate: range.end,
    label: formatTermLabel(range.start, range.end),
  };
}

/**
 * The same term one year later, for renewals. Shifts both endpoints rather
 * than recomputing from the fiscal year, so a sponsorship sold on a
 * non-standard term renews on that same non-standard term.
 */
export function getNextSponsorshipTerm(
  startDate: string,
  endDate: string
): SponsorshipTerm {
  const nextStart = format(addYears(parseISO(startDate), 1), "yyyy-MM-dd");
  const nextEnd = format(addYears(parseISO(endDate), 1), "yyyy-MM-dd");
  return {
    startDate: nextStart,
    endDate: nextEnd,
    label: formatTermLabel(nextStart, nextEnd),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/sponsors/sponsorship-year.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/sponsors/sponsorship-year.ts lib/sponsors/sponsorship-year.test.ts
git commit -m "feat(sponsors): derive sponsorship terms from the org fiscal year"
```

---

## Task 3: Validation schemas

**Files:**
- Create: `lib/validations/sponsor.ts`
- Test: `lib/validations/sponsor.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `SPONSOR_PAYMENT_METHODS` (`readonly ["cash","check","paypal","other"]`) and `SPONSOR_PAYMENT_METHOD_LABELS`
  - `createSponsorSchema` / `updateSponsorSchema`
  - `createSponsorLevelSchema` / `updateSponsorLevelSchema`
  - `createSponsorshipSchema` / `updateSponsorshipSchema`
  - `depositLineSchema`, `depositLinesArraySchema`, `depositFromQueueSchema`
  - `sponsorLetterRequestSchema`
  - Types: `SponsorPaymentMethod`, `CreateSponsorshipInput`, `DepositLineInput`, `DepositFromQueueInput`

- [ ] **Step 1: Write the failing test**

Create `lib/validations/sponsor.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import {
  createSponsorLevelSchema,
  createSponsorSchema,
  createSponsorshipSchema,
  depositLinesArraySchema,
} from "./sponsor";

const orgId = "660e8400-e29b-41d4-a716-446655440000";
const sponsorId = "770e8400-e29b-41d4-a716-446655440000";
const levelId = "880e8400-e29b-41d4-a716-446655440000";
const categoryId = "990e8400-e29b-41d4-a716-446655440000";
const sponsorshipId = "aa0e8400-e29b-41d4-a716-446655440000";

function validSponsorship(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: orgId,
    sponsor_id: sponsorId,
    level_id: levelId,
    term_start_date: "2026-07-01",
    term_end_date: "2027-06-30",
    amount: "500",
    payment_method: "check",
    check_number: "1043",
    received_date: "2026-08-14",
    notes: "",
    ...overrides,
  };
}

describe("createSponsorSchema", () => {
  it("accepts a sponsor with only a name", () => {
    const result = createSponsorSchema.safeParse({
      organization_id: orgId,
      name: "Acme Hardware",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createSponsorSchema.safeParse({
      organization_id: orgId,
      name: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("createSponsorLevelSchema", () => {
  it("coerces the default amount from a form string", () => {
    const result = createSponsorLevelSchema.safeParse({
      organization_id: orgId,
      name: "Gold",
      default_amount: "500",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.default_amount).toBe(500);
  });

  it("rejects a negative default amount", () => {
    const result = createSponsorLevelSchema.safeParse({
      organization_id: orgId,
      name: "Gold",
      default_amount: "-1",
    });
    expect(result.success).toBe(false);
  });
});

describe("createSponsorshipSchema", () => {
  it("accepts a valid check sponsorship", () => {
    const result = createSponsorshipSchema.safeParse(validSponsorship());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(500);
  });

  it("rejects a term that ends before it starts", () => {
    const result = createSponsorshipSchema.safeParse(
      validSponsorship({ term_start_date: "2027-07-01", term_end_date: "2026-06-30" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/end date/i);
    }
  });

  it("rejects a zero amount", () => {
    const result = createSponsorshipSchema.safeParse(
      validSponsorship({ amount: "0" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a check number on a cash payment", () => {
    const result = createSponsorshipSchema.safeParse(
      validSponsorship({ payment_method: "cash", check_number: "1043" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/check number/i);
    }
  });

  it("accepts a check payment with no check number recorded", () => {
    const result = createSponsorshipSchema.safeParse(
      validSponsorship({ check_number: "" })
    );
    expect(result.success).toBe(true);
  });
});

describe("depositLinesArraySchema", () => {
  it("requires at least one line", () => {
    expect(depositLinesArraySchema.safeParse([]).success).toBe(false);
  });

  it("rejects the same sponsorship twice", () => {
    const line = { sponsorship_id: sponsorshipId, category_id: categoryId, memo: "Acme" };
    const result = depositLinesArraySchema.safeParse([line, line]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/once/i);
    }
  });

  it("carries no amount field, so amounts cannot be client-supplied", () => {
    const result = depositLinesArraySchema.safeParse([
      { sponsorship_id: sponsorshipId, category_id: categoryId, memo: "Acme", amount: 999999 },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect("amount" in result.data[0]).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/validations/sponsor.test.ts`
Expected: FAIL — "Failed to resolve import ./sponsor".

- [ ] **Step 3: Write the schemas**

Create `lib/validations/sponsor.ts`:

```ts
import { z } from "zod";

import { TRANSACTION_STATUSES } from "./transaction";

export const SPONSOR_PAYMENT_METHODS = [
  "cash",
  "check",
  "paypal",
  "other",
] as const;

export type SponsorPaymentMethod = (typeof SPONSOR_PAYMENT_METHODS)[number];

export const SPONSOR_PAYMENT_METHOD_LABELS: Record<
  SponsorPaymentMethod,
  string
> = {
  cash: "Cash",
  check: "Check",
  paypal: "PayPal",
  other: "Other",
};

/** PayPal money arrives electronically and never rides along in a bank deposit. */
export const ELECTRONIC_PAYMENT_METHODS: readonly SponsorPaymentMethod[] = [
  "paypal",
];

const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional()
    .or(z.literal(""));

export const createSponsorSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  name: z
    .string()
    .min(1, "Sponsor name is required.")
    .max(150, "Sponsor name must be 150 characters or fewer."),
  contact_name: optionalText(100, "Contact name"),
  email: z
    .string()
    .email("Email must be a valid email address.")
    .max(255, "Email must be 255 characters or fewer.")
    .optional()
    .or(z.literal("")),
  phone: optionalText(30, "Phone"),
  address_line1: optionalText(150, "Address"),
  address_line2: optionalText(150, "Address line 2"),
  city: optionalText(100, "City"),
  state: optionalText(50, "State"),
  postal_code: optionalText(20, "Postal code"),
  notes: optionalText(1000, "Notes"),
  is_active: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .default(false),
});

export const updateSponsorSchema = createSponsorSchema.extend({
  id: z.string().uuid("Invalid sponsor ID."),
});

export const createSponsorLevelSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  name: z
    .string()
    .min(1, "Level name is required.")
    .max(100, "Level name must be 100 characters or fewer."),
  default_amount: z.coerce
    .number()
    .nonnegative("Default amount cannot be negative."),
  description: optionalText(500, "Description"),
  sort_order: z.coerce.number().int().default(0),
  is_active: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .default(false),
});

export const updateSponsorLevelSchema = createSponsorLevelSchema.extend({
  id: z.string().uuid("Invalid level ID."),
});

const sponsorshipBaseSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  sponsor_id: z.string().uuid("Invalid sponsor ID."),
  level_id: z.string().uuid("Invalid sponsorship level ID."),
  term_start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Term start must be a valid date."),
  term_end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Term end must be a valid date."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  payment_method: z.enum(SPONSOR_PAYMENT_METHODS, {
    message: "Invalid payment method.",
  }),
  check_number: optionalText(20, "Check number"),
  received_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Received date must be a valid date."),
  notes: optionalText(1000, "Notes"),
});

/**
 * A check number on a cash payment is a data-entry slip, not a harmless extra:
 * it would print on the acknowledgment letter.
 */
function checkSponsorshipConsistency(
  data: z.infer<typeof sponsorshipBaseSchema>,
  ctx: z.RefinementCtx
): void {
  if (data.term_end_date <= data.term_start_date) {
    ctx.addIssue({
      code: "custom",
      path: ["term_end_date"],
      message: "Term end date must be after the term start date.",
    });
  }

  if (data.check_number && data.payment_method !== "check") {
    ctx.addIssue({
      code: "custom",
      path: ["check_number"],
      message: "A check number can only be recorded on a check payment.",
    });
  }
}

export const createSponsorshipSchema = sponsorshipBaseSchema.superRefine(
  checkSponsorshipConsistency
);

export const updateSponsorshipSchema = sponsorshipBaseSchema
  .extend({ id: z.string().uuid("Invalid sponsorship ID.") })
  .superRefine(checkSponsorshipConsistency);

/**
 * Deposit lines carry no amount. Amounts are re-read from the sponsorship rows
 * inside the action, so a tampered form cannot post a deposit whose lines
 * disagree with the records they claim to represent.
 */
export const depositLineSchema = z.object({
  sponsorship_id: z.string().uuid("Invalid sponsorship ID."),
  category_id: z.string().uuid("Invalid category ID."),
  memo: optionalText(255, "Memo"),
});

export const depositLinesArraySchema = z
  .array(depositLineSchema)
  .min(1, "Select at least one queued payment.")
  .superRefine((lines, ctx) => {
    const ids = new Set<string>();
    for (const line of lines) {
      if (ids.has(line.sponsorship_id)) {
        ctx.addIssue({
          code: "custom",
          message: "Each queued payment can only be deposited once.",
        });
        return;
      }
      ids.add(line.sponsorship_id);
    }
  });

export const depositFromQueueSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  account_id: z.string().uuid("Invalid account ID."),
  transaction_date: z.string().min(1, "Deposit date is required."),
  description: z
    .string()
    .min(1, "Description is required.")
    .max(255, "Description must be 255 characters or fewer."),
  status: z
    .enum(TRANSACTION_STATUSES, { message: "Invalid status." })
    .default("uncleared"),
  cleared_at: z.string().optional().or(z.literal("")),
  apply_fee: z.string().optional(),
  lines: z.string().min(1, "Deposit lines are required."),
});

export const sponsorLetterRequestSchema = z.object({
  template_id: z.string().uuid(),
  sponsorship_ids: z.array(z.string().uuid()).min(1),
});

export type CreateSponsorInput = z.infer<typeof createSponsorSchema>;
export type CreateSponsorLevelInput = z.infer<typeof createSponsorLevelSchema>;
export type CreateSponsorshipInput = z.infer<typeof createSponsorshipSchema>;
export type DepositLineInput = z.infer<typeof depositLineSchema>;
export type DepositFromQueueInput = z.infer<typeof depositFromQueueSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/validations/sponsor.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/validations/sponsor.ts lib/validations/sponsor.test.ts
git commit -m "feat(sponsors): add validation schemas for sponsors, levels, and deposits"
```

---
## Task 4: Sponsor levels — guard, actions, and page

**Files:**
- Create: `lib/sponsors/guard.ts`
- Create: `app/(dashboard)/organizations/[orgId]/sponsor-levels/actions.ts`
- Create: `app/(dashboard)/organizations/[orgId]/sponsor-levels/page.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/sponsor-levels/loading.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/sponsor-levels/level-form.tsx`
- Test: `app/(dashboard)/organizations/[orgId]/sponsor-levels/actions.test.ts`

**Interfaces:**
- Consumes: `createSponsorLevelSchema`, `updateSponsorLevelSchema` (Task 3)
- Produces:
  - `fetchSponsorsOrg(supabase, orgId): Promise<SponsorsOrg | null>` where `SponsorsOrg = { id: string; name: string; fiscal_year_start_month: number }` — returns `null` when the org does not exist or `sponsors_enabled` is false. Every sponsor page and action calls this.
  - Server Actions `createSponsorLevel`, `updateSponsorLevel`, `deleteSponsorLevel`

- [ ] **Step 1: Write the guard**

Create `lib/sponsors/guard.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface SponsorsOrg {
  id: string;
  name: string;
  fiscal_year_start_month: number;
}

/**
 * Resolves an organization only when sponsor tracking is switched on for it.
 * Hiding the nav link is presentation; this is the boundary. RLS already
 * restricts rows to the signed-in treasurer, so a null here means "off or
 * not yours" and both answers are a 404 to the caller.
 */
export async function fetchSponsorsOrg(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<SponsorsOrg | null> {
  const { data } = await supabase
    .from("organizations")
    .select("id, name, fiscal_year_start_month, sponsors_enabled")
    .eq("id", orgId)
    .single();

  if (!data || !data.sponsors_enabled) return null;

  return {
    id: data.id,
    name: data.name,
    fiscal_year_start_month: data.fiscal_year_start_month,
  };
}
```

- [ ] **Step 2: Write the failing action test**

Create `app/(dashboard)/organizations/[orgId]/sponsor-levels/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";
import {
  mockRedirect,
  mockRevalidatePath,
  RedirectError,
} from "@/test/mocks/next-navigation";

import type { MockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...(args as [string])),
}));

import { createClient } from "@/lib/supabase/server";
import { createSponsorLevel, deleteSponsorLevel } from "./actions";

const mockedCreateClient = vi.mocked(createClient);
const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";
const levelId = "880e8400-e29b-41d4-a716-446655440000";

describe("sponsor level actions", () => {
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockedCreateClient.mockResolvedValue(mockSupabase as never);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);
  });

  function makeFormData(data: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [key, val] of Object.entries(data)) fd.set(key, val);
    return fd;
  }

  it("rejects a level when sponsor tracking is disabled for the org", async () => {
    mockSupabase.mockResult({
      data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: false },
      error: null,
    });

    const result = await createSponsorLevel(
      null,
      makeFormData({ organization_id: orgId, name: "Gold", default_amount: "500" })
    );

    expect(result).toEqual({ error: "Sponsor tracking is not enabled." });
  });

  it("returns a validation error for an empty level name", async () => {
    const result = await createSponsorLevel(
      null,
      makeFormData({ organization_id: orgId, name: "", default_amount: "500" })
    );

    expect(result?.error).toMatch(/name is required/i);
  });

  it("explains that a level in use cannot be deleted", async () => {
    mockSupabase
      .mockChain()
      .sequence([
        { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
        { data: null, error: { message: "violates foreign key constraint", code: "23503" } },
      ]);

    const result = await deleteSponsorLevel(
      null,
      makeFormData({ id: levelId, organization_id: orgId })
    );

    expect(result?.error).toMatch(/in use/i);
  });

  it("redirects back to the levels page after a successful create", async () => {
    mockSupabase
      .mockChain()
      .sequence([
        { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
        { data: null, error: null },
      ]);

    await expect(
      createSponsorLevel(
        null,
        makeFormData({ organization_id: orgId, name: "Gold", default_amount: "500" })
      )
    ).rejects.toThrow(RedirectError);

    expect(mockRedirect).toHaveBeenCalledWith(
      `/organizations/${orgId}/sponsor-levels`
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run "app/(dashboard)/organizations/[orgId]/sponsor-levels/actions.test.ts"`
Expected: FAIL — "Failed to resolve import ./actions".

- [ ] **Step 4: Write the actions**

Create `app/(dashboard)/organizations/[orgId]/sponsor-levels/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import {
  createSponsorLevelSchema,
  updateSponsorLevelSchema,
} from "@/lib/validations/sponsor";

export async function createSponsorLevel(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = createSponsorLevelSchema.safeParse({
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    default_amount: formData.get("default_amount") as string,
    description: formData.get("description") as string,
    sort_order: (formData.get("sort_order") as string) || "0",
    // An unchecked checkbox is absent from the FormData, not present-and-false.
    // `get() ?? "true"` would quietly reactivate every level you try to retire.
    is_active: formData.getAll("is_active").includes("true") ? "true" : "false",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const org = await fetchSponsorsOrg(supabase, parsed.data.organization_id);
  if (!org) return { error: "Sponsor tracking is not enabled." };

  const { error } = await supabase.from("sponsor_levels").insert({
    organization_id: parsed.data.organization_id,
    name: parsed.data.name,
    default_amount: parsed.data.default_amount,
    description: parsed.data.description || null,
    sort_order: parsed.data.sort_order,
    is_active: parsed.data.is_active,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A level with that name already exists." };
    }
    return { error: "Failed to create the level. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${parsed.data.organization_id}/sponsor-levels`);
}

export async function updateSponsorLevel(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = updateSponsorLevelSchema.safeParse({
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    default_amount: formData.get("default_amount") as string,
    description: formData.get("description") as string,
    sort_order: (formData.get("sort_order") as string) || "0",
    is_active: formData.getAll("is_active").includes("true") ? "true" : "false",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const org = await fetchSponsorsOrg(supabase, parsed.data.organization_id);
  if (!org) return { error: "Sponsor tracking is not enabled." };

  const { error } = await supabase
    .from("sponsor_levels")
    .update({
      name: parsed.data.name,
      default_amount: parsed.data.default_amount,
      description: parsed.data.description || null,
      sort_order: parsed.data.sort_order,
      is_active: parsed.data.is_active,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A level with that name already exists." };
    }
    return { error: "Failed to update the level. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${parsed.data.organization_id}/sponsor-levels`);
}

export async function deleteSponsorLevel(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;
  const organizationId = formData.get("organization_id") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const org = await fetchSponsorsOrg(supabase, organizationId);
  if (!org) return { error: "Sponsor tracking is not enabled." };

  const { error } = await supabase
    .from("sponsor_levels")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    // ON DELETE RESTRICT from sponsorships. Deactivating keeps the history
    // intact, which is what the treasurer actually wants here.
    if (error.code === "23503") {
      return {
        error:
          "This level is in use by one or more sponsorships and cannot be deleted. Mark it inactive instead.",
      };
    }
    return { error: "Failed to delete the level. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organizationId}/sponsor-levels`);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run "app/(dashboard)/organizations/[orgId]/sponsor-levels/actions.test.ts"`
Expected: PASS, 4 tests.

- [ ] **Step 6: Build the page and form**

`page.tsx` is a Server Component: `await params`, `createClient()`, `fetchSponsorsOrg()`, `notFound()` when null, then select levels ordered by `sort_order, name` and render a table of name / default amount / description / active with edit and delete controls, plus the create form. Mirror the structure of `app/(dashboard)/organizations/[orgId]/letter-templates/page.tsx`.

```tsx
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import { formatCurrency } from "@/lib/utils";
import { LevelForm } from "./level-form";

export default async function SponsorLevelsPage({
  params,
}: Readonly<{ params: Promise<{ orgId: string }> }>) {
  const { orgId } = await params;
  const supabase = await createClient();

  const org = await fetchSponsorsOrg(supabase, orgId);
  if (!org) notFound();

  const { data: levels } = await supabase
    .from("sponsor_levels")
    .select("*")
    .eq("organization_id", orgId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Sponsorship Levels</h1>
        <p className="text-sm text-muted-foreground">
          Levels prefill the amount when you log a sponsorship payment. The
          amount stays editable on each sponsorship.
        </p>
      </div>
      {/* level table + <LevelForm mode="create" orgId={orgId} /> */}
    </div>
  );
}
```

`level-form.tsx` is a Client Component using `useActionState`, with fields `name`, `default_amount` (`type="number" step="0.01" min="0"`), `description`, `sort_order`, `is_active`. Copy the error-banner and `useId` conventions from `student-form.tsx` exactly.

The active checkbox must be `<input type="checkbox" name="is_active" value="true" defaultChecked={defaultValues?.is_active ?? true} />`. The action reads it with `getAll().includes("true")` because an unchecked checkbox is absent from the FormData rather than present-and-false — the same reason applies to the sponsor form in Task 5.

`loading.tsx` mirrors `app/(dashboard)/organizations/[orgId]/students/loading.tsx`.

- [ ] **Step 7: Verify the page compiles**

```bash
npx tsc --noEmit 2>&1 | tail -20
```

Expected: no new errors beyond the Task 1 baseline.

- [ ] **Step 8: Commit**

```bash
git add lib/sponsors/guard.ts "app/(dashboard)/organizations/[orgId]/sponsor-levels"
git commit -m "feat(sponsors): configurable sponsorship levels"
```

---

## Task 5: Sponsors — actions, list, detail, edit

**Files:**
- Create: `app/(dashboard)/organizations/[orgId]/sponsors/actions.ts`
- Create: `app/(dashboard)/organizations/[orgId]/sponsors/sponsor-form.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/sponsors/page.tsx`, `loading.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/sponsors/new/page.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/sponsors/[sponsorId]/page.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/sponsors/[sponsorId]/edit/page.tsx`
- Test: `app/(dashboard)/organizations/[orgId]/sponsors/actions.test.ts`

**Interfaces:**
- Consumes: `fetchSponsorsOrg` (Task 4), `createSponsorSchema` / `updateSponsorSchema` (Task 3), `formatTermLabel` (Task 2)
- Produces: Server Actions `createSponsor`, `updateSponsor`, `deleteSponsor`

- [ ] **Step 1: Write the failing action test**

Create `app/(dashboard)/organizations/[orgId]/sponsors/actions.test.ts` with the same mock preamble as Task 4 (copy the `vi.mock` block, `createMockSupabaseClient` setup, and `makeFormData` helper verbatim — the engineer may be reading tasks out of order), covering:

```ts
  it("rejects a sponsor when sponsor tracking is disabled", async () => {
    mockSupabase.mockResult({
      data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: false },
      error: null,
    });

    const result = await createSponsor(
      null,
      makeFormData({ organization_id: orgId, name: "Acme Hardware" })
    );

    expect(result).toEqual({ error: "Sponsor tracking is not enabled." });
  });

  it("returns a validation error for an empty sponsor name", async () => {
    const result = await createSponsor(
      null,
      makeFormData({ organization_id: orgId, name: "" })
    );

    expect(result?.error).toMatch(/name is required/i);
  });

  it("stores blank optional fields as null rather than empty strings", async () => {
    const insert = vi.fn(() => Promise.resolve({ data: null, error: null }));
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true },
                  error: null,
                }),
            }),
          }),
        } as never;
      }
      return { insert } as never;
    });

    await expect(
      createSponsor(
        null,
        makeFormData({ organization_id: orgId, name: "Acme Hardware", email: "" })
      )
    ).rejects.toThrow(RedirectError);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Acme Hardware", email: null, city: null })
    );
  });

  it("explains that a sponsor with sponsorship history cannot be deleted", async () => {
    mockSupabase
      .mockChain()
      .sequence([
        { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
        { data: null, error: { message: "violates foreign key constraint", code: "23503" } },
      ]);

    const result = await deleteSponsor(
      null,
      makeFormData({ id: sponsorId, organization_id: orgId })
    );

    expect(result?.error).toMatch(/sponsorship history/i);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "app/(dashboard)/organizations/[orgId]/sponsors/actions.test.ts"`
Expected: FAIL — "Failed to resolve import ./actions".

- [ ] **Step 3: Write the actions**

`createSponsor` / `updateSponsor` follow the Task 4 shape exactly: parse with `createSponsorSchema` / `updateSponsorSchema`, `getUser()`, `fetchSponsorsOrg()`, then insert or update. The full field mapping, with every optional field coerced to `null`:

```ts
  const { error } = await supabase.from("sponsors").insert({
    organization_id: parsed.data.organization_id,
    name: parsed.data.name,
    contact_name: parsed.data.contact_name || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address_line1: parsed.data.address_line1 || null,
    address_line2: parsed.data.address_line2 || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    postal_code: parsed.data.postal_code || null,
    notes: parsed.data.notes || null,
    is_active: parsed.data.is_active,
  });
```

`deleteSponsor` mirrors `deleteSponsorLevel`, with this message on error code `23503`:

```ts
      return {
        error:
          "This sponsor has sponsorship history and cannot be deleted. Mark them inactive instead.",
      };
```

Redirect targets: create and update go to `/organizations/${orgId}/sponsors/${id}` for create (read the inserted id back with `.select("id").single()`) and the same for update; delete goes to `/organizations/${orgId}/sponsors`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/(dashboard)/organizations/[orgId]/sponsors/actions.test.ts"`
Expected: PASS, 4 tests.

- [ ] **Step 5: Build the pages**

- `sponsors/page.tsx` — guard, then list sponsors ordered by `name`, each row showing name, contact, and its current-term sponsorship level if one exists. Above the table: a queue callout reading "N payments waiting to be deposited" linking to `/organizations/${orgId}/transactions/deposit`, plus links to Sponsorship Levels and Sponsor Letters. The queue count comes from:

```ts
  const { count: queuedCount } = await supabase
    .from("sponsorships")
    .select("id, sponsors!inner(organization_id)", { count: "exact", head: true })
    .eq("sponsors.organization_id", orgId)
    .is("transaction_id", null);
```

- `sponsors/new/page.tsx` — guard, render `<SponsorForm mode="create" orgId={orgId} />`.
- `sponsors/[sponsorId]/page.tsx` — guard, load the sponsor and their sponsorships (joined to `sponsor_levels(name)` and `transactions(id, transaction_date, description)`) ordered by `term_start_date` descending. Render contact details, then a sponsorship history table: term label via `formatTermLabel`, level, amount, method, received date, and a deposit column reading either "In queue" or a link to the transaction. Header actions: "Log payment", "Renew" (links to `/organizations/${orgId}/sponsorships/new?sponsor_id=${sponsorId}&renew_from=${mostRecentSponsorshipId}`, rendered only when a prior sponsorship exists), and "Edit".
- `sponsors/[sponsorId]/edit/page.tsx` — guard, load the sponsor, render `<SponsorForm mode="edit" orgId={orgId} defaultValues={sponsor} />`.

`sponsor-form.tsx` mirrors `student-form.tsx`: `useActionState`, `useId`, the destructive error banner, fields for name, contact name, email, phone, the five address fields, notes, and an `is_active` checkbox.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit 2>&1 | tail -20
npx vitest run "app/(dashboard)/organizations/[orgId]/sponsors/actions.test.ts"
```

Expected: no new type errors; tests pass.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/organizations/[orgId]/sponsors"
git commit -m "feat(sponsors): sponsor records with contact and mailing details"
```

---

## Task 6: Sponsorships — logging payments, editing, renewal

**Files:**
- Create: `app/(dashboard)/organizations/[orgId]/sponsorships/actions.ts`
- Create: `app/(dashboard)/organizations/[orgId]/sponsorships/sponsorship-form.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/sponsorships/new/page.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/sponsorships/[sponsorshipId]/edit/page.tsx`
- Test: `app/(dashboard)/organizations/[orgId]/sponsorships/actions.test.ts`

**Interfaces:**
- Consumes: `fetchSponsorsOrg` (Task 4); `createSponsorshipSchema` / `updateSponsorshipSchema`, `SPONSOR_PAYMENT_METHODS`, `SPONSOR_PAYMENT_METHOD_LABELS` (Task 3); `getSponsorshipTerm`, `getNextSponsorshipTerm` (Task 2)
- Produces: Server Actions `createSponsorship`, `updateSponsorship`, `deleteSponsorship`

- [ ] **Step 1: Write the failing test for the post-deposit lock**

Create `app/(dashboard)/organizations/[orgId]/sponsorships/actions.test.ts` with the Task 4 mock preamble, plus:

```ts
  const sponsorshipId = "aa0e8400-e29b-41d4-a716-446655440000";
  const transactionId = "bb0e8400-e29b-41d4-a716-446655440000";

  function validSponsorshipForm(overrides: Record<string, string> = {}) {
    return makeFormData({
      id: sponsorshipId,
      organization_id: orgId,
      sponsor_id: sponsorId,
      level_id: levelId,
      term_start_date: "2026-07-01",
      term_end_date: "2027-06-30",
      amount: "500",
      payment_method: "check",
      check_number: "1043",
      received_date: "2026-08-14",
      notes: "",
      ...overrides,
    });
  }

  it("refuses to change the amount of a sponsorship that has been deposited", async () => {
    mockSupabase.mockChain().sequence([
      { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
      {
        data: {
          id: sponsorshipId,
          amount: 500,
          level_id: levelId,
          payment_method: "check",
          transaction_id: transactionId,
          sponsors: { organization_id: orgId },
        },
        error: null,
      },
    ]);

    const result = await updateSponsorship(null, validSponsorshipForm({ amount: "750" }));

    expect(result?.error).toMatch(/already been deposited/i);
  });

  it("allows editing notes on a deposited sponsorship", async () => {
    mockSupabase.mockChain().sequence([
      { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
      {
        data: {
          id: sponsorshipId,
          amount: 500,
          level_id: levelId,
          payment_method: "check",
          transaction_id: transactionId,
          sponsors: { organization_id: orgId },
        },
        error: null,
      },
      { data: null, error: null },
    ]);

    await expect(
      updateSponsorship(null, validSponsorshipForm({ notes: "Renewed by phone" }))
    ).rejects.toThrow(RedirectError);
  });

  it("refuses to delete a sponsorship that has been deposited", async () => {
    mockSupabase.mockChain().sequence([
      { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
      {
        data: { id: sponsorshipId, transaction_id: transactionId, sponsors: { organization_id: orgId } },
        error: null,
      },
    ]);

    const result = await deleteSponsorship(
      null,
      makeFormData({ id: sponsorshipId, organization_id: orgId })
    );

    expect(result?.error).toMatch(/deposit/i);
  });

  it("rejects a sponsorship whose sponsor belongs to another organization", async () => {
    mockSupabase.mockChain().sequence([
      { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
      { data: null, error: null },
    ]);

    const result = await createSponsorship(null, validSponsorshipForm());

    expect(result?.error).toMatch(/sponsor not found/i);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "app/(dashboard)/organizations/[orgId]/sponsorships/actions.test.ts"`
Expected: FAIL — "Failed to resolve import ./actions".

- [ ] **Step 3: Write the actions**

Create `app/(dashboard)/organizations/[orgId]/sponsorships/actions.ts`. `createSponsorship` parses with `createSponsorshipSchema`, checks `getUser()` and `fetchSponsorsOrg()`, then verifies the sponsor and level belong to this org before inserting:

```ts
  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("id")
    .eq("id", parsed.data.sponsor_id)
    .eq("organization_id", parsed.data.organization_id)
    .single();

  if (!sponsor) return { error: "Sponsor not found." };

  const { data: level } = await supabase
    .from("sponsor_levels")
    .select("id")
    .eq("id", parsed.data.level_id)
    .eq("organization_id", parsed.data.organization_id)
    .single();

  if (!level) return { error: "Sponsorship level not found." };

  const { error } = await supabase.from("sponsorships").insert({
    sponsor_id: parsed.data.sponsor_id,
    level_id: parsed.data.level_id,
    term_start_date: parsed.data.term_start_date,
    term_end_date: parsed.data.term_end_date,
    amount: parsed.data.amount,
    payment_method: parsed.data.payment_method,
    check_number: parsed.data.check_number || null,
    received_date: parsed.data.received_date,
    notes: parsed.data.notes || null,
  });
```

`updateSponsorship` additionally loads the existing row and enforces the post-deposit lock:

```ts
  const { data: existing } = await supabase
    .from("sponsorships")
    .select("id, amount, level_id, payment_method, transaction_id, sponsors!inner(organization_id)")
    .eq("id", parsed.data.id)
    .eq("sponsors.organization_id", parsed.data.organization_id)
    .single();

  if (!existing) return { error: "Sponsorship not found." };

  // The ledger line for a deposited sponsorship already exists. Letting the
  // amount drift away from it would silently desynchronize the two, so the
  // treasurer edits the deposit instead — deleting it returns every
  // sponsorship on it to the queue.
  if (existing.transaction_id) {
    const changesLockedFields =
      Number(existing.amount) !== parsed.data.amount ||
      existing.level_id !== parsed.data.level_id ||
      existing.payment_method !== parsed.data.payment_method;

    if (changesLockedFields) {
      return {
        error:
          "This sponsorship has already been deposited. Delete or edit the deposit transaction to change its amount, level, or payment method.",
      };
    }
  }
```

`deleteSponsorship` loads the same row and refuses when `transaction_id` is set:

```ts
  if (existing.transaction_id) {
    return {
      error:
        "This sponsorship is part of a deposit. Delete the deposit transaction first — that returns its payments to the queue.",
    };
  }
```

All three redirect to `/organizations/${orgId}/sponsors/${sponsorId}` after `revalidatePath("/dashboard", "layout")`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/(dashboard)/organizations/[orgId]/sponsorships/actions.test.ts"`
Expected: PASS, 4 tests.

- [ ] **Step 5: Build the form and pages**

`sponsorship-form.tsx` (Client Component, `useActionState`) takes `orgId`, `sponsors`, `levels`, `defaultValues?`, and `defaultTerm: SponsorshipTerm`. Behavior:

- Selecting a level sets the amount input to that level's `default_amount` **only while the treasurer has not typed in the amount field** — track a `touched` flag in state so a prefill never overwrites a deliberate entry.
- `payment_method` is a select over `SPONSOR_PAYMENT_METHODS` using `SPONSOR_PAYMENT_METHOD_LABELS`; the check-number input renders only when `check` is selected, matching the schema rule that a check number cannot ride on a cash payment.
- Term start and end default from `defaultTerm` and stay editable.
- `received_date` defaults to today via `new Date().toLocaleDateString("en-CA")`.

`new/page.tsx` awaits `params` and `searchParams`, guards, loads sponsors and active levels, then computes the default term:

```ts
  const { sponsor_id: sponsorIdParam, renew_from: renewFrom } = await searchParams;

  let defaultTerm = getSponsorshipTerm(org.fiscal_year_start_month);
  let defaultLevelId: string | undefined;
  let defaultSponsorId = typeof sponsorIdParam === "string" ? sponsorIdParam : undefined;

  if (typeof renewFrom === "string") {
    const { data: previous } = await supabase
      .from("sponsorships")
      .select("id, sponsor_id, level_id, term_start_date, term_end_date, sponsors!inner(organization_id)")
      .eq("id", renewFrom)
      .eq("sponsors.organization_id", orgId)
      .single();

    if (previous) {
      // A renewal is a prefill, not a copy: nothing is written until the
      // treasurer submits, so a renewal that never gets paid leaves no row.
      defaultTerm = getNextSponsorshipTerm(previous.term_start_date, previous.term_end_date);
      defaultLevelId = previous.level_id;
      defaultSponsorId = previous.sponsor_id;
    }
  }
```

`[sponsorshipId]/edit/page.tsx` guards, loads the sponsorship (joined through `sponsors!inner(organization_id)`), and renders the form in edit mode. When `transaction_id` is set, render a muted banner above the form: "This sponsorship was deposited on {date}. Amount, level, and payment method are locked." and mark those three inputs `disabled`.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit 2>&1 | tail -20
npm test 2>&1 | tail -10
```

Expected: no new failures beyond baseline.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/organizations/[orgId]/sponsorships"
git commit -m "feat(sponsors): log sponsorship payments into the deposit queue"
```

---

## Task 7: Extract the fee companion helper

**Files:**
- Create: `lib/transactions/create-fee-companion.ts`
- Test: `lib/transactions/create-fee-companion.test.ts`
- Modify: `app/(dashboard)/organizations/[orgId]/transactions/actions.ts:169-232`

**Interfaces:**
- Consumes: `calculateFee(amount, feePercentage, feeFlatAmount)` from `lib/validations/account.ts`
- Produces:
  ```ts
  interface FeeAccountConfig {
    id: string;
    fee_percentage: number | null;
    fee_flat_amount: number | null;
    fee_category_id: string | null;
  }
  interface FeeCompanionInput {
    account: FeeAccountConfig;
    amount: number;
    transactionDate: string;
    description: string;
    status: "uncleared" | "cleared" | "reconciled";
    clearedAt: string | null;
  }
  createFeeCompanionTransaction(
    supabase: SupabaseClient<Database>,
    input: FeeCompanionInput
  ): Promise<{ error: string } | null>
  ```
  Returns `null` when no fee applies and when the companion is created successfully; returns `{ error }` when the companion fails and the caller must warn.

This is a pure refactor plus its first test. `createTransaction`'s observable behavior must not change.

- [ ] **Step 1: Write the failing test**

Create `lib/transactions/create-fee-companion.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";
import { createFeeCompanionTransaction } from "./create-fee-companion";

import type { MockSupabaseClient } from "@/test/mocks/supabase";

const accountId = "cc0e8400-e29b-41d4-a716-446655440000";
const feeCategoryId = "dd0e8400-e29b-41d4-a716-446655440000";

describe("createFeeCompanionTransaction", () => {
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
  });

  function input(overrides: Record<string, unknown> = {}) {
    return {
      account: {
        id: accountId,
        fee_percentage: 2.9,
        fee_flat_amount: 0.3,
        fee_category_id: feeCategoryId,
      },
      amount: 100,
      transactionDate: "2026-08-14",
      description: "Sponsorship deposit",
      status: "uncleared" as const,
      clearedAt: null,
      ...overrides,
    };
  }

  it("does nothing when the account has no fee category", async () => {
    const result = await createFeeCompanionTransaction(
      mockSupabase as never,
      input({ account: { id: accountId, fee_percentage: 2.9, fee_flat_amount: null, fee_category_id: null } })
    );

    expect(result).toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("does nothing when the account has a category but no fee rates", async () => {
    const result = await createFeeCompanionTransaction(
      mockSupabase as never,
      input({ account: { id: accountId, fee_percentage: null, fee_flat_amount: null, fee_category_id: feeCategoryId } })
    );

    expect(result).toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("skips the companion when the fee category has been deactivated", async () => {
    mockSupabase.mockResult({ data: { id: feeCategoryId, is_active: false }, error: null });

    const result = await createFeeCompanionTransaction(mockSupabase as never, input());

    expect(result).toBeNull();
  });

  it("creates an expense transaction for the computed fee", async () => {
    const inserts: unknown[] = [];
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "categories") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: feeCategoryId, is_active: true }, error: null }) }) }),
        } as never;
      }
      if (table === "transactions") {
        return {
          insert: (payload: unknown) => {
            inserts.push(payload);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: "fee-txn" }, error: null }) }) };
          },
        } as never;
      }
      return {
        insert: (payload: unknown) => {
          inserts.push(payload);
          return Promise.resolve({ data: null, error: null });
        },
      } as never;
    });

    const result = await createFeeCompanionTransaction(mockSupabase as never, input());

    expect(result).toBeNull();
    expect(inserts[0]).toEqual(
      expect.objectContaining({
        account_id: accountId,
        amount: 3.2,
        transaction_type: "expense",
        description: "Processing fee: Sponsorship deposit",
      })
    );
  });

  it("deletes the fee transaction and reports when its line item fails", async () => {
    const del = vi.fn(() => ({ eq: () => Promise.resolve({ data: null, error: null }) }));
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "categories") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: feeCategoryId, is_active: true }, error: null }) }) }),
        } as never;
      }
      if (table === "transactions") {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "fee-txn" }, error: null }) }) }),
          delete: del,
        } as never;
      }
      return {
        insert: () => Promise.resolve({ data: null, error: { message: "boom" } }),
      } as never;
    });

    const result = await createFeeCompanionTransaction(mockSupabase as never, input());

    expect(del).toHaveBeenCalled();
    expect(result?.error).toMatch(/processing fee/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/transactions/create-fee-companion.test.ts`
Expected: FAIL — "Failed to resolve import ./create-fee-companion".

- [ ] **Step 3: Write the helper**

Create `lib/transactions/create-fee-companion.ts` by moving the block at `app/(dashboard)/organizations/[orgId]/transactions/actions.ts:169-232` verbatim, changing only what it reads from:

```ts
import { calculateFee } from "@/lib/validations/account";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface FeeAccountConfig {
  id: string;
  fee_percentage: number | null;
  fee_flat_amount: number | null;
  fee_category_id: string | null;
}

export interface FeeCompanionInput {
  account: FeeAccountConfig;
  /** Gross amount of the income transaction the fee is charged against. */
  amount: number;
  transactionDate: string;
  description: string;
  status: "uncleared" | "cleared" | "reconciled";
  clearedAt: string | null;
}

/**
 * Creates the companion expense transaction for a processing fee.
 *
 * Returns null both when no fee applies and when the companion is written
 * successfully — the caller only needs to react to `{ error }`, which means
 * the income transaction stands but the fee did not, and the treasurer has to
 * add it by hand.
 *
 * Shared by the transaction form and the sponsorship deposit builder so the
 * two cannot drift apart on money handling.
 */
export async function createFeeCompanionTransaction(
  supabase: SupabaseClient<Database>,
  { account, amount, transactionDate, description, status, clearedAt }: FeeCompanionInput
): Promise<{ error: string } | null> {
  if (!account.fee_category_id) return null;
  if (!account.fee_percentage && !account.fee_flat_amount) return null;

  const feeAmount = calculateFee(
    amount,
    account.fee_percentage,
    account.fee_flat_amount
  );
  if (feeAmount <= 0) return null;

  const { data: feeCat } = await supabase
    .from("categories")
    .select("id, is_active")
    .eq("id", account.fee_category_id)
    .single();

  if (!feeCat?.is_active) return null;

  const { data: feeTxn, error: feeTxnError } = await supabase
    .from("transactions")
    .insert({
      account_id: account.id,
      transaction_date: transactionDate,
      amount: feeAmount,
      transaction_type: "expense",
      description: `Processing fee: ${description}`,
      status,
      cleared_at: clearedAt,
    })
    .select("id")
    .single();

  if (feeTxnError || !feeTxn) {
    return {
      error:
        "Income transaction was created, but the processing fee could not be created. Please add the fee manually.",
    };
  }

  const { error: feeLiError } = await supabase
    .from("transaction_line_items")
    .insert({
      transaction_id: feeTxn.id,
      category_id: account.fee_category_id,
      amount: feeAmount,
    });

  if (feeLiError) {
    await supabase.from("transactions").delete().eq("id", feeTxn.id);
    return {
      error:
        "Income transaction was created, but the processing fee line item failed. Please add the fee manually.",
    };
  }

  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/transactions/create-fee-companion.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Replace the inline block in `createTransaction`**

Delete lines 169-232 of `app/(dashboard)/organizations/[orgId]/transactions/actions.ts` and put this in their place, keeping the surrounding `apply_fee` and income-type conditions that the helper deliberately does not own:

```ts
  if (parsed.data.apply_fee === "true" && parsed.data.transaction_type === "income") {
    const feeError = await createFeeCompanionTransaction(supabase, {
      account,
      amount: parsed.data.amount,
      transactionDate: parsed.data.transaction_date,
      description: parsed.data.description,
      status: parsed.data.status,
      clearedAt,
    });

    if (feeError) return feeError;
  }
```

Add the import, and remove the now-unused `calculateFee` import if nothing else in the file uses it (check with `grep -n calculateFee` before deleting).

- [ ] **Step 6: Verify the refactor changed no behavior**

```bash
npx vitest run "app/(dashboard)/organizations/[orgId]/transactions/actions.test.ts"
npx tsc --noEmit 2>&1 | tail -20
```

Expected: the existing transaction action tests still pass unchanged. If any needed editing, the refactor was not behavior-preserving — revert and redo.

- [ ] **Step 7: Commit**

```bash
git add lib/transactions/create-fee-companion.ts lib/transactions/create-fee-companion.test.ts "app/(dashboard)/organizations/[orgId]/transactions/actions.ts"
git commit -m "refactor(transactions): extract the processing-fee companion helper"
```

---

## Task 8: The deposit action

**Files:**
- Create: `app/(dashboard)/organizations/[orgId]/transactions/deposit/actions.ts`
- Test: `app/(dashboard)/organizations/[orgId]/transactions/deposit/actions.test.ts`

**Interfaces:**
- Consumes: `depositFromQueueSchema`, `depositLinesArraySchema`, `ELECTRONIC_PAYMENT_METHODS` (Task 3); `fetchSponsorsOrg` (Task 4); `createFeeCompanionTransaction` (Task 7)
- Produces: Server Action `createDepositFromQueue(prevState, formData)`

This is the only task in the plan that writes money. Test it hardest.

- [ ] **Step 1: Write the failing test**

Create `app/(dashboard)/organizations/[orgId]/transactions/deposit/actions.test.ts` with the Task 4 mock preamble plus:

```ts
  const accountId = "cc0e8400-e29b-41d4-a716-446655440000";
  const categoryId = "990e8400-e29b-41d4-a716-446655440000";
  const sponsorshipA = "aa0e8400-e29b-41d4-a716-446655440000";
  const sponsorshipB = "ab0e8400-e29b-41d4-a716-446655440000";

  function depositForm(lines: unknown[], overrides: Record<string, string> = {}) {
    return makeFormData({
      organization_id: orgId,
      account_id: accountId,
      transaction_date: "2026-08-20",
      description: "Sponsorship deposit",
      status: "uncleared",
      lines: JSON.stringify(lines),
      ...overrides,
    });
  }

  it("rejects a deposit that mixes PayPal with cash or check", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "organizations") {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null }) }) }) } as never;
      }
      if (table === "sponsorships") {
        return {
          select: () => ({
            in: () => ({
              eq: () => Promise.resolve({
                data: [
                  { id: sponsorshipA, amount: 500, payment_method: "check", transaction_id: null, sponsors: { organization_id: orgId, name: "Acme" }, sponsor_levels: { name: "Gold" } },
                  { id: sponsorshipB, amount: 250, payment_method: "paypal", transaction_id: null, sponsors: { organization_id: orgId, name: "Baker" }, sponsor_levels: { name: "Silver" } },
                ],
                error: null,
              }),
            }),
          }),
        } as never;
      }
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) } as never;
    });

    const result = await createDepositFromQueue(
      null,
      depositForm([
        { sponsorship_id: sponsorshipA, category_id: categoryId, memo: "Acme — Gold" },
        { sponsorship_id: sponsorshipB, category_id: categoryId, memo: "Baker — Silver" },
      ])
    );

    expect(result?.error).toMatch(/PayPal/i);
  });

  it("rejects a sponsorship that is already on another deposit", async () => {
    const captured = wireDeposit({
      sponsorships: [
        { id: sponsorshipA, amount: 500, payment_method: "check", transaction_id: "existing-txn", sponsors: { organization_id: orgId, name: "Acme" }, sponsor_levels: { name: "Gold" } },
      ],
    });

    const result = await createDepositFromQueue(
      null,
      depositForm([{ sponsorship_id: sponsorshipA, category_id: categoryId, memo: "Acme — Gold" }])
    );

    expect(result?.error).toMatch(/already been deposited/i);
    expect(captured.transactionInserts).toHaveLength(0);
  });

  it("rejects a sponsorship id belonging to another organization", async () => {
    // The org filter on the query excludes it, so it simply is not returned.
    wireDeposit({ sponsorships: [] });

    const result = await createDepositFromQueue(
      null,
      depositForm([{ sponsorship_id: sponsorshipA, category_id: categoryId, memo: "Acme — Gold" }])
    );

    expect(result?.error).toMatch(/no longer in the queue/i);
  });

  it("computes the transaction amount from the database, not the form", async () => {
    const captured = wireDeposit({ sponsorships: twoQueuedCheckSponsorships() });

    await expect(
      createDepositFromQueue(
        null,
        depositForm([
          { sponsorship_id: sponsorshipA, category_id: categoryId, memo: "Acme — Gold" },
          { sponsorship_id: sponsorshipB, category_id: categoryId, memo: "Baker — Silver" },
        ])
      )
    ).rejects.toThrow(RedirectError);

    expect(captured.transactionInserts[0]).toEqual(
      expect.objectContaining({
        amount: 750,
        transaction_type: "income",
        account_id: accountId,
      })
    );
  });

  it("writes one line item per selected sponsorship", async () => {
    const captured = wireDeposit({ sponsorships: twoQueuedCheckSponsorships() });

    await expect(
      createDepositFromQueue(
        null,
        depositForm([
          { sponsorship_id: sponsorshipA, category_id: categoryId, memo: "Acme — Gold" },
          { sponsorship_id: sponsorshipB, category_id: categoryId, memo: "Baker — Silver" },
        ])
      )
    ).rejects.toThrow(RedirectError);

    expect(captured.lineItemInserts[0]).toEqual([
      expect.objectContaining({ amount: 500, category_id: categoryId, memo: "Acme — Gold" }),
      expect.objectContaining({ amount: 250, category_id: categoryId, memo: "Baker — Silver" }),
    ]);
  });

  it("rolls the transaction back when a sponsorship is claimed by a concurrent deposit", async () => {
    // Two lines selected, but only one row still had transaction_id IS NULL by
    // the time the claim ran — the other window won the race.
    const captured = wireDeposit({
      sponsorships: twoQueuedCheckSponsorships(),
      claimedCount: 1,
    });

    const result = await createDepositFromQueue(
      null,
      depositForm([
        { sponsorship_id: sponsorshipA, category_id: categoryId, memo: "Acme — Gold" },
        { sponsorship_id: sponsorshipB, category_id: categoryId, memo: "Baker — Silver" },
      ])
    );

    expect(result?.error).toMatch(/another window/i);
    expect(captured.deletedTransactionIds).toContain("new-txn");
  });
```

Both the mixing test above and these four share one wiring helper. Define it once, above the `it` blocks:

```ts
  function twoQueuedCheckSponsorships() {
    return [
      { id: sponsorshipA, amount: 500, payment_method: "check", transaction_id: null, sponsors: { organization_id: orgId, name: "Acme" }, sponsor_levels: { name: "Gold" } },
      { id: sponsorshipB, amount: 250, payment_method: "check", transaction_id: null, sponsors: { organization_id: orgId, name: "Baker" }, sponsor_levels: { name: "Silver" } },
    ];
  }

  /**
   * Wires `from()` per table for the deposit action's query sequence and
   * captures every write, so each test asserts on what was actually sent to
   * the database rather than on call counts.
   */
  function wireDeposit({
    sponsorships,
    claimedCount,
  }: {
    sponsorships: unknown[];
    claimedCount?: number;
  }) {
    const captured = {
      transactionInserts: [] as unknown[],
      lineItemInserts: [] as unknown[],
      deletedTransactionIds: [] as string[],
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true },
                  error: null,
                }),
            }),
          }),
        } as never;
      }

      if (table === "accounts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: {
                        id: accountId,
                        organization_id: orgId,
                        fee_percentage: null,
                        fee_flat_amount: null,
                        fee_category_id: null,
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        } as never;
      }

      if (table === "sponsorships") {
        return {
          select: () => ({
            in: () => ({ eq: () => Promise.resolve({ data: sponsorships, error: null }) }),
          }),
          update: () => ({
            in: () => ({
              is: () =>
                Promise.resolve({
                  count: claimedCount ?? sponsorships.length,
                  error: null,
                }),
            }),
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        } as never;
      }

      if (table === "categories") {
        return {
          select: () => ({
            in: () => ({
              eq: () => ({ eq: () => Promise.resolve({ data: [{ id: categoryId }], error: null }) }),
            }),
          }),
        } as never;
      }

      if (table === "transactions") {
        return {
          insert: (payload: unknown) => {
            captured.transactionInserts.push(payload);
            return {
              select: () => ({ single: () => Promise.resolve({ data: { id: "new-txn" }, error: null }) }),
            };
          },
          delete: () => ({
            eq: (_column: string, value: string) => {
              captured.deletedTransactionIds.push(value);
              return Promise.resolve({ data: null, error: null });
            },
          }),
        } as never;
      }

      return {
        insert: (payload: unknown) => {
          captured.lineItemInserts.push(payload);
          return Promise.resolve({ data: null, error: null });
        },
      } as never;
    });

    return captured;
  }
```

Rewrite the PayPal-mixing test above to use `wireDeposit` too, passing one `check` and one `paypal` sponsorship — the inline `from.mockImplementation` shown there is the same wiring spelled out longhand.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "app/(dashboard)/organizations/[orgId]/transactions/deposit/actions.test.ts"`
Expected: FAIL — "Failed to resolve import ./actions".

- [ ] **Step 3: Write the action**

Create `app/(dashboard)/organizations/[orgId]/transactions/deposit/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import { createFeeCompanionTransaction } from "@/lib/transactions/create-fee-companion";
import {
  depositFromQueueSchema,
  depositLinesArraySchema,
  ELECTRONIC_PAYMENT_METHODS,
} from "@/lib/validations/sponsor";

export async function createDepositFromQueue(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = depositFromQueueSchema.safeParse({
    organization_id: formData.get("organization_id") as string,
    account_id: formData.get("account_id") as string,
    transaction_date: formData.get("transaction_date") as string,
    description: formData.get("description") as string,
    status: (formData.get("status") as string) || "uncleared",
    cleared_at: (formData.get("cleared_at") as string) ?? "",
    apply_fee: (formData.get("apply_fee") as string) ?? "",
    lines: formData.get("lines") as string,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let rawLines: unknown;
  try {
    rawLines = JSON.parse(parsed.data.lines);
  } catch {
    return { error: "Deposit lines are malformed. Please try again." };
  }

  const parsedLines = depositLinesArraySchema.safeParse(rawLines);
  if (!parsedLines.success) {
    return { error: parsedLines.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const org = await fetchSponsorsOrg(supabase, parsed.data.organization_id);
  if (!org) return { error: "Sponsor tracking is not enabled." };

  const { data: account } = await supabase
    .from("accounts")
    .select("id, organization_id, fee_percentage, fee_flat_amount, fee_category_id")
    .eq("id", parsed.data.account_id)
    .eq("organization_id", parsed.data.organization_id)
    .eq("is_active", true)
    .single();

  if (!account) return { error: "Account not found." };

  // Amounts come from here, never from the form. The client chooses WHICH
  // payments to deposit and how to categorize them; what each one is worth is
  // already recorded.
  const sponsorshipIds = parsedLines.data.map((line) => line.sponsorship_id);
  const { data: sponsorships } = await supabase
    .from("sponsorships")
    .select(
      "id, amount, payment_method, transaction_id, sponsors!inner(organization_id, name), sponsor_levels(name)"
    )
    .in("id", sponsorshipIds)
    .eq("sponsors.organization_id", parsed.data.organization_id);

  const found = sponsorships ?? [];

  if (found.length !== sponsorshipIds.length) {
    return {
      error:
        "One or more selected payments are no longer in the queue. Reload the page and try again.",
    };
  }

  if (found.some((sponsorship) => sponsorship.transaction_id)) {
    return {
      error:
        "One or more selected payments have already been deposited. Reload the page and try again.",
    };
  }

  // PayPal money never rides along in a bank deposit: it lands in a different
  // account and carries a processing fee. Mixing the two would produce a
  // transaction that matches no real movement of money.
  const hasElectronic = found.some((s) =>
    ELECTRONIC_PAYMENT_METHODS.includes(s.payment_method as never)
  );
  const hasPhysical = found.some(
    (s) => !ELECTRONIC_PAYMENT_METHODS.includes(s.payment_method as never)
  );

  if (hasElectronic && hasPhysical) {
    return {
      error:
        "PayPal payments cannot be deposited together with cash or check payments. Deposit them separately.",
    };
  }

  const categoryIds = [...new Set(parsedLines.data.map((l) => l.category_id))];
  const { data: categories } = await supabase
    .from("categories")
    .select("id")
    .in("id", categoryIds)
    .eq("organization_id", parsed.data.organization_id)
    .eq("is_active", true);

  if ((categories?.length ?? 0) !== categoryIds.length) {
    return { error: "One or more categories are invalid or inactive." };
  }

  const amountById = new Map(found.map((s) => [s.id, Number(s.amount)]));
  const total = parsedLines.data.reduce(
    (sum, line) => sum + (amountById.get(line.sponsorship_id) ?? 0),
    0
  );

  let clearedAt: string | null = null;
  if (parsed.data.status === "cleared" || parsed.data.status === "reconciled") {
    clearedAt = parsed.data.cleared_at
      ? parsed.data.cleared_at + "T00:00:00.000Z"
      : new Date().toISOString();
  }

  const { data: transaction, error: txnError } = await supabase
    .from("transactions")
    .insert({
      account_id: parsed.data.account_id,
      transaction_date: parsed.data.transaction_date,
      amount: Number(total.toFixed(2)),
      transaction_type: "income",
      description: parsed.data.description,
      status: parsed.data.status,
      cleared_at: clearedAt,
    })
    .select("id")
    .single();

  if (txnError || !transaction) {
    return { error: "Failed to create the deposit. Please try again." };
  }

  const { error: liError } = await supabase.from("transaction_line_items").insert(
    parsedLines.data.map((line) => ({
      transaction_id: transaction.id,
      category_id: line.category_id,
      amount: amountById.get(line.sponsorship_id) ?? 0,
      memo: line.memo || null,
    }))
  );

  if (liError) {
    await supabase.from("transactions").delete().eq("id", transaction.id);
    return { error: "Failed to create the deposit lines. Please try again." };
  }

  // Claim the queue rows under the same condition that made them eligible.
  // Two tabs depositing the same check would otherwise both succeed, and the
  // money would be recorded twice.
  const { count: claimed, error: claimError } = await supabase
    .from("sponsorships")
    .update({ transaction_id: transaction.id }, { count: "exact" })
    .in("id", sponsorshipIds)
    .is("transaction_id", null);

  if (claimError || claimed !== sponsorshipIds.length) {
    await supabase
      .from("sponsorships")
      .update({ transaction_id: null })
      .eq("transaction_id", transaction.id);
    await supabase.from("transactions").delete().eq("id", transaction.id);
    return {
      error:
        "One of these payments was deposited from another window while you were working. Nothing was saved — reload the page and try again.",
    };
  }

  if (parsed.data.apply_fee === "true") {
    const feeError = await createFeeCompanionTransaction(supabase, {
      account,
      amount: Number(total.toFixed(2)),
      transactionDate: parsed.data.transaction_date,
      description: parsed.data.description,
      status: parsed.data.status,
      clearedAt,
    });

    if (feeError) return feeError;
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${parsed.data.organization_id}/transactions/${transaction.id}`
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/(dashboard)/organizations/[orgId]/transactions/deposit/actions.test.ts"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/organizations/[orgId]/transactions/deposit/actions.ts" "app/(dashboard)/organizations/[orgId]/transactions/deposit/actions.test.ts"
git commit -m "feat(sponsors): deposit queued sponsorship payments as one split transaction"
```

---

## Task 9: The deposit builder UI

**Files:**
- Create: `app/(dashboard)/organizations/[orgId]/transactions/deposit/page.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/transactions/deposit/loading.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/transactions/deposit/deposit-builder.tsx`
- Modify: `app/(dashboard)/organizations/[orgId]/transactions/page.tsx`

**Interfaces:**
- Consumes: `createDepositFromQueue` (Task 8), `fetchSponsorsOrg` (Task 4), `SPONSOR_PAYMENT_METHOD_LABELS` (Task 3)
- Produces: nothing other tasks depend on

- [ ] **Step 1: Build the page**

`page.tsx` awaits `params`, guards with `fetchSponsorsOrg` and `notFound()`, then loads:

```ts
  const { data: queue } = await supabase
    .from("sponsorships")
    .select(
      "id, amount, payment_method, check_number, received_date, term_start_date, term_end_date, sponsors!inner(id, name, organization_id), sponsor_levels(name)"
    )
    .eq("sponsors.organization_id", orgId)
    .is("transaction_id", null)
    .order("received_date", { ascending: true });
```

plus active accounts (`id, name, account_type, fee_percentage, fee_flat_amount, fee_category_id`) and active income-capable categories for the line pickers. Pass them to `<DepositBuilder />`. When the queue is empty, render an empty state pointing at "Log a payment" instead of the builder.

- [ ] **Step 2: Build the client component**

`deposit-builder.tsx` (`"use client"`, `useActionState(createDepositFromQueue, null)`) holds:

- `selected: Set<string>` of sponsorship ids, `categoryByLine: Record<string, string>`, `memoByLine: Record<string, string>`.
- The queue rendered in two groups — "Cash & Checks" and "PayPal" — each row a checkbox with sponsor name, level, amount, method, check number, and received date.
- A running total of the selection, rendered with `formatCurrency`.
- An "Apply category to all selected lines" select above the line list that writes every entry in `categoryByLine` at once, so a ten-check deposit is one pick.
- Deposit fields: account select, date (defaulting to today via `toLocaleDateString("en-CA")`), description defaulting to `Sponsorship deposit`, status select over `TRANSACTION_STATUSES`, and an `apply_fee` checkbox rendered only when the selected account has `fee_category_id` and a rate — mirroring `transaction-form.tsx`.
- A hidden `lines` input serialized on submit:

```tsx
<input
  type="hidden"
  name="lines"
  value={JSON.stringify(
    [...selected].map((id) => ({
      sponsorship_id: id,
      category_id: categoryByLine[id] ?? "",
      memo: memoByLine[id] ?? "",
    }))
  )}
/>
```

Client-side, disable submit when the selection is empty, when any selected line has no category, or when the selection mixes PayPal with cash/check — showing the same wording the action returns, so the two never contradict each other. The server check in Task 8 remains the authority.

Memos default to `${sponsorName} — ${levelName}` and stay editable.

- [ ] **Step 3: Add the entry point to the transactions page**

In `app/(dashboard)/organizations/[orgId]/transactions/page.tsx`, load the org's `sponsors_enabled` and the queue count (the `head: true` count query from Task 5), and render beside the existing "New Transaction" button:

```tsx
{sponsorsEnabled && queuedCount > 0 && (
  <Button asChild variant="outline">
    <Link href={`/organizations/${orgId}/transactions/deposit`}>
      Deposit from queue ({queuedCount})
    </Link>
  </Button>
)}
```

- [ ] **Step 4: Verify end to end in the running app**

```bash
npm run dev
```

Walk it: enable sponsor tracking on the org, add a Gold level at $500, add two sponsors, log a check payment for each, open Transactions, click "Deposit from queue (2)", select both, apply a category to all, submit. Confirm one income transaction of $1000 with two line items, and that both sponsorships now show their deposit on the sponsor detail page. Then delete that transaction and confirm both payments reappear in the queue.

- [ ] **Step 5: Verify types and tests**

```bash
npx tsc --noEmit 2>&1 | tail -20
npm test 2>&1 | tail -10
```

Expected: no new failures beyond the Task 1 baseline.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/organizations/[orgId]/transactions"
git commit -m "feat(sponsors): deposit builder reachable from the transactions page"
```

---
## Task 10: Letter template types and a type-scoped placeholder vocabulary

**Files:**
- Create: `supabase/migrations/20260906000002_letter_template_types.sql`
- Modify: `lib/letters/placeholders.ts`
- Modify: `lib/letters/placeholders.test.ts`
- Modify: `lib/validations/letter-template.ts`
- Modify: `app/(dashboard)/organizations/[orgId]/letter-templates/{actions.ts,letter-template-form.tsx,page.tsx}`
- Modify: `types/database.ts` (regenerated)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `LETTER_TEMPLATE_TYPES` (`readonly ["season_balance","sponsor_acknowledgment"]`), `LetterTemplateType`, `LETTER_TEMPLATE_TYPE_LABELS`
  - `LETTER_PLACEHOLDERS_BY_TYPE: Record<LetterTemplateType, readonly LetterPlaceholder[]>`
  - `getPlaceholders(type: LetterTemplateType): readonly LetterPlaceholder[]`
  - `findUnknownPlaceholders(text: string, type?: LetterTemplateType): string[]` — the type defaults to `"season_balance"` so existing callers keep working

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260906000002_letter_template_types.sql`:

```sql
-- Letter templates now serve two audiences: families who owe season fees, and
-- sponsors who need a 501(c)(3) acknowledgment. Existing rows are all the
-- former, which the default backfills.
ALTER TABLE public.letter_templates
  ADD COLUMN template_type TEXT NOT NULL DEFAULT 'season_balance'
    CHECK (template_type IN ('season_balance', 'sponsor_acknowledgment'));

-- One default per TYPE, so an org can hold a default season letter and a
-- default sponsor letter at the same time.
DROP INDEX IF EXISTS idx_letter_templates_one_default;

CREATE UNIQUE INDEX idx_letter_templates_one_default
  ON public.letter_templates(organization_id, template_type)
  WHERE is_default;

CREATE INDEX idx_letter_templates_type
  ON public.letter_templates(organization_id, template_type);
```

```bash
npx supabase db push
npx supabase gen types typescript --linked > types/database.ts
```

- [ ] **Step 2: Write the failing placeholder tests**

Append to `lib/letters/placeholders.test.ts`:

```ts
describe("LETTER_PLACEHOLDERS_BY_TYPE", () => {
  it("offers season tokens to season templates", () => {
    const tokens = getPlaceholders("season_balance").map((p) => p.token);
    expect(tokens).toContain("student_first_name");
    expect(tokens).toContain("balance_due");
  });

  it("offers sponsor tokens to sponsor templates", () => {
    const tokens = getPlaceholders("sponsor_acknowledgment").map((p) => p.token);
    expect(tokens).toContain("sponsor_name");
    expect(tokens).toContain("sponsorship_amount");
    expect(tokens).toContain("term_label");
  });

  it("keeps student tokens out of sponsor templates", () => {
    const tokens = getPlaceholders("sponsor_acknowledgment").map((p) => p.token);
    expect(tokens).not.toContain("student_first_name");
  });

  it("shares organization and director tokens across both types", () => {
    for (const type of LETTER_TEMPLATE_TYPES) {
      const tokens = getPlaceholders(type).map((p) => p.token);
      expect(tokens).toContain("organization_name");
      expect(tokens).toContain("organization_ein");
      expect(tokens).toContain("director_name");
      expect(tokens).toContain("today");
    }
  });
});

describe("findUnknownPlaceholders with a template type", () => {
  it("flags a student token used in a sponsor letter", () => {
    const unknown = findUnknownPlaceholders(
      "Thank you {{student_first_name}}",
      "sponsor_acknowledgment"
    );
    expect(unknown).toEqual(["student_first_name"]);
  });

  it("flags a sponsor token used in a season letter", () => {
    const unknown = findUnknownPlaceholders(
      "Thank you {{sponsor_name}}",
      "season_balance"
    );
    expect(unknown).toEqual(["sponsor_name"]);
  });

  it("accepts shared tokens in either type", () => {
    for (const type of LETTER_TEMPLATE_TYPES) {
      expect(findUnknownPlaceholders("{{organization_name}} {{today}}", type)).toEqual([]);
    }
  });

  it("defaults to the season vocabulary when no type is given", () => {
    expect(findUnknownPlaceholders("{{balance_due}}")).toEqual([]);
  });
});
```

Add `getPlaceholders` and `LETTER_TEMPLATE_TYPES` to the file's import from `./placeholders`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run lib/letters/placeholders.test.ts`
Expected: FAIL — `getPlaceholders is not a function`.

- [ ] **Step 4: Restructure the vocabulary**

Rewrite `lib/letters/placeholders.ts` so the single flat array becomes three, composed per type. Keep the existing `LETTER_PLACEHOLDERS` export as the union of all three — the existing duplicate-token and label/description tests still consume it, and the union has no duplicates because each token is defined exactly once.

```ts
export const LETTER_TEMPLATE_TYPES = [
  "season_balance",
  "sponsor_acknowledgment",
] as const;

export type LetterTemplateType = (typeof LETTER_TEMPLATE_TYPES)[number];

export const LETTER_TEMPLATE_TYPE_LABELS: Record<LetterTemplateType, string> = {
  season_balance: "Season Balance Notice",
  sponsor_acknowledgment: "Sponsor Acknowledgment",
};

export interface LetterPlaceholder {
  token: string;
  label: string;
  description: string;
}

const SHARED_PLACEHOLDERS = [
  { token: "organization_name", label: "Organization Name", description: "The organization's name" },
  { token: "organization_ein", label: "Organization EIN", description: "The organization's EIN, for tax acknowledgments" },
  { token: "today", label: "Today's Date", description: "The date the letter is generated, MM/DD/YYYY" },
  { token: "director_name", label: "Director Name", description: "Director name from organization settings" },
  { token: "director_title", label: "Director Title", description: "Director title from organization settings" },
  { token: "director_email", label: "Director Email", description: "Director email from organization settings" },
  { token: "director_phone", label: "Director Phone", description: "Director phone from organization settings" },
] as const;

const SEASON_PLACEHOLDERS = [
  // every existing season/student entry, moved here verbatim:
  // season_name, season_start_date, season_end_date, student_first_name,
  // student_last_name, student_full_name, guardian_name, fee_amount,
  // total_paid, balance_due
] as const;

const SPONSOR_PLACEHOLDERS = [
  { token: "sponsor_name", label: "Sponsor Name", description: "The sponsoring business or person" },
  { token: "contact_name", label: "Contact Name", description: "The sponsor's contact person, falling back to the sponsor name" },
  { token: "level_name", label: "Sponsorship Level", description: "The level the sponsor purchased, e.g. Gold" },
  { token: "sponsorship_amount", label: "Sponsorship Amount", description: "The amount received, formatted as currency" },
  { token: "received_date", label: "Date Received", description: "When the payment was received, MM/DD/YYYY" },
  { token: "payment_method", label: "Payment Method", description: "Cash, Check, PayPal, or Other" },
  { token: "term_start_date", label: "Term Start", description: "Sponsorship term start, MM/DD/YYYY" },
  { token: "term_end_date", label: "Term End", description: "Sponsorship term end, MM/DD/YYYY" },
  { token: "term_label", label: "Sponsorship Year", description: "The sponsorship year, e.g. 2026–27" },
] as const;

export const LETTER_PLACEHOLDERS = [
  ...SHARED_PLACEHOLDERS,
  ...SEASON_PLACEHOLDERS,
  ...SPONSOR_PLACEHOLDERS,
] as const;

export type PlaceholderToken = (typeof LETTER_PLACEHOLDERS)[number]["token"];

export const LETTER_PLACEHOLDERS_BY_TYPE: Record<
  LetterTemplateType,
  readonly LetterPlaceholder[]
> = {
  season_balance: [...SHARED_PLACEHOLDERS, ...SEASON_PLACEHOLDERS],
  sponsor_acknowledgment: [...SHARED_PLACEHOLDERS, ...SPONSOR_PLACEHOLDERS],
};

export function getPlaceholders(
  type: LetterTemplateType
): readonly LetterPlaceholder[] {
  return LETTER_PLACEHOLDERS_BY_TYPE[type];
}

/**
 * Tokens present in `text` that are not part of the vocabulary for this
 * template type, de-duplicated. Scoping by type is what stops
 * `{{student_first_name}}` from silently rendering blank on every sponsor
 * letter — it fails at save time instead.
 */
export function findUnknownPlaceholders(
  text: string,
  type: LetterTemplateType = "season_balance"
): string[] {
  const known = new Set(getPlaceholders(type).map((p) => p.token));
  const unknown: string[] = [];
  for (const match of text.matchAll(createPlaceholderPattern())) {
    const token = match[1];
    if (!known.has(token) && !unknown.includes(token)) {
      unknown.push(token);
    }
  }
  return unknown;
}
```

Keep `createPlaceholderPattern` exactly as it is, including its comment about fresh regex instances.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/letters/placeholders.test.ts`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 6: Thread the type through validation and the template UI**

In `lib/validations/letter-template.ts`:

```ts
  template_type: z.enum(LETTER_TEMPLATE_TYPES, {
    message: "Invalid template type.",
  }).default("season_balance"),
```

and change `checkPlaceholders` to take the parsed `template_type` and pass it as the second argument to `findUnknownPlaceholders`.

In `letter-template-form.tsx`, add a template-type select (disabled in edit mode — changing a saved template's type could invalidate every placeholder in its body; deleting and recreating is clearer), hold the selected type in state, and drive the click-to-insert palette from `getPlaceholders(selectedType)`.

In `letter-templates/page.tsx` and `actions.ts`, read and write `template_type`, and group the template list under two headings using `LETTER_TEMPLATE_TYPE_LABELS`.

- [ ] **Step 7: Verify**

```bash
npx vitest run lib/letters "app/(dashboard)/organizations/[orgId]/letter-templates"
npx tsc --noEmit 2>&1 | tail -20
```

Expected: all letter tests pass; no new type errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260906000002_letter_template_types.sql types/database.ts lib/letters lib/validations/letter-template.ts "app/(dashboard)/organizations/[orgId]/letter-templates"
git commit -m "feat(letters): scope templates and placeholders by template type"
```

---

## Task 11: Generalize the letter renderer

**Files:**
- Modify: `lib/letters/types.ts`
- Modify: `lib/letters/render-template.ts`
- Modify: `lib/pdf/generate-letters.ts`
- Modify: `lib/pdf/generate-letters.test.ts`
- Modify: `app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.ts`

**Interfaces:**
- Consumes: `renderTemplate`, `LETTER_PLACEHOLDERS_BY_TYPE` (Task 10)
- Produces:
  ```ts
  interface LetterDetailTable { title?: string; rows: string[][]; emptyMessage?: string }
  interface LetterRecipient { id: string; tokenValues: Record<string, string>; detailTables?: LetterDetailTable[] }
  interface LetterBatchData {
    organizationName: string;
    director: LetterDirector;
    generatedOn: string;
    template: LetterTemplateContent;
    recipients: LetterRecipient[];
  }
  buildSeasonTokenValues(context): Record<string, string>   // renamed from buildTokenValues
  buildSponsorTokenValues(context): Record<string, string>  // added in Task 12
  ```

The season letters PDF output must be byte-for-byte equivalent in structure after this task. This is a refactor with one new capability, not a redesign.

- [ ] **Step 1: Update the types**

Rewrite `lib/letters/types.ts` to the shapes above. `LetterDirector` and `LetterTemplateContent` are unchanged. `LetterPayment` moves out — payment rows become plain `string[]` rows inside a `LetterDetailTable`.

`detailTables` is an array because the season letter renders two: the balance summary box and the payment history. `emptyMessage` preserves the existing "no payments recorded" line that prints in place of an empty table.

- [ ] **Step 2: Rename the season token builder**

In `lib/letters/render-template.ts`, rename `buildTokenValues` to `buildSeasonTokenValues` and widen its return type to `Record<string, string>`. Its body is unchanged, including the guardian fallback. Update `lib/letters/render-template.test.ts` imports.

- [ ] **Step 3: Update the PDF renderer**

In `lib/pdf/generate-letters.ts`, `renderLetter` currently reads `recipient.feeAmount`, `recipient.payments`, and so on. Change it to:

- render heading/body/closing with `renderTemplate(text, recipient.tokenValues)`
- iterate `recipient.detailTables ?? []`, calling `autoTable` per table, printing `title` above the table when set, and printing `emptyMessage` instead of the table when `rows` is empty and a message is given

Everything else — margins, pagination, `ensureSpace`, `buildSignatureLines`, the fresh page per recipient — stays exactly as it is.

- [ ] **Step 4: Update the PDF test fixtures**

`lib/pdf/generate-letters.test.ts` builds recipient fixtures at the top of the file. Rewrite those fixtures to the new shape — `tokenValues` with the tokens the fixture template uses, and `detailTables` for the balance box and payments — and leave all 15 assertions untouched. The test named "handles a recipient with no payments" now exercises `emptyMessage`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run lib/pdf/generate-letters.test.ts lib/letters/render-template.test.ts`
Expected: PASS, with no assertion bodies changed.

- [ ] **Step 6: Update the season letters route**

In `app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.ts`, build the new recipient shape from the season report:

```ts
    const recipients: LetterRecipient[] = report.enrollments
      .filter(
        (enrollment) =>
          requested.has(enrollment.id) &&
          enrollment.enrollmentStatus === "enrolled" &&
          enrollment.balanceDue > 0
      )
      .map((enrollment) => ({
        id: enrollment.id,
        tokenValues: buildSeasonTokenValues({
          organizationName: org.name,
          organizationEin: org.ein,
          director: { /* the four org director fields */ },
          seasonName: report.seasonName,
          seasonStartDate: report.startDate,
          seasonEndDate: report.endDate,
          generatedOn: today,
          enrollment,
        }),
        detailTables: [
          {
            rows: [
              ["Season Fee", formatCurrency(enrollment.feeAmount)],
              ["Total Paid", formatCurrency(enrollment.totalPaid)],
              ["Balance Due", formatCurrency(enrollment.balanceDue)],
            ],
          },
          {
            title: "Payments Received",
            emptyMessage: "No payments recorded.",
            rows: enrollment.payments.map((payment) => [
              formatDate(payment.payment_date),
              formatCurrency(payment.amount),
              payment.payment_method ?? "",
            ]),
          },
        ],
      }));
```

Add `ein` to the org `select()` in that route so `{{organization_ein}}` resolves.

- [ ] **Step 7: Verify the season letters still generate**

```bash
npx vitest run "app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.test.ts"
npm run dev
```

Generate a season letter batch in the browser and compare the PDF against one generated before this task. Same layout, same content.

- [ ] **Step 8: Commit**

```bash
git add lib/letters lib/pdf "app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.ts"
git commit -m "refactor(letters): render from token values so any entity can produce letters"
```

---

## Task 12: Sponsor acknowledgment letters

**Files:**
- Create: `lib/letters/sponsor-token-values.ts`
- Test: `lib/letters/sponsor-token-values.test.ts`
- Create: `app/api/organizations/[orgId]/sponsor-letters/route.ts`
- Test: `app/api/organizations/[orgId]/sponsor-letters/route.test.ts`
- Create: `app/(dashboard)/organizations/[orgId]/sponsor-letters/page.tsx`, `loading.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/sponsor-letters/generate-sponsor-letters-form.tsx`

**Interfaces:**
- Consumes: `LetterBatchData`, `LetterRecipient` (Task 11); `formatTermLabel` (Task 2); `fetchSponsorsOrg` (Task 4); `sponsorLetterRequestSchema`, `SPONSOR_PAYMENT_METHOD_LABELS` (Task 3); `generateLettersPdf` (Task 11)
- Produces: `buildSponsorTokenValues(context: SponsorLetterContext): Record<string, string>`

- [ ] **Step 1: Write the failing token test**

Create `lib/letters/sponsor-token-values.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { buildSponsorTokenValues } from "./sponsor-token-values";

function context(overrides: Record<string, unknown> = {}) {
  return {
    organizationName: "CCV Band Boosters",
    organizationEin: "12-3456789",
    director: { name: "Jane Doe", title: "Band Director", email: "jane@ccv.org", phone: "555-0100" },
    generatedOn: "2026-09-06",
    sponsorName: "Acme Hardware",
    contactName: "Dale Cooper",
    levelName: "Gold",
    amount: 500,
    receivedDate: "2026-08-14",
    paymentMethod: "check" as const,
    termStartDate: "2026-07-01",
    termEndDate: "2027-06-30",
    ...overrides,
  };
}

describe("buildSponsorTokenValues", () => {
  it("formats the amount as currency", () => {
    expect(buildSponsorTokenValues(context()).sponsorship_amount).toBe("$500.00");
  });

  it("formats dates as MM/DD/YYYY", () => {
    const values = buildSponsorTokenValues(context());
    expect(values.received_date).toBe("08/14/2026");
    expect(values.term_start_date).toBe("07/01/2026");
    expect(values.term_end_date).toBe("06/30/2027");
  });

  it("labels the sponsorship year across the boundary", () => {
    expect(buildSponsorTokenValues(context()).term_label).toBe("2026–27");
  });

  it("prints a human label for the payment method", () => {
    expect(buildSponsorTokenValues(context()).payment_method).toBe("Check");
  });

  it("falls back to the sponsor name when no contact is recorded", () => {
    const values = buildSponsorTokenValues(context({ contactName: null }));
    expect(values.contact_name).toBe("Acme Hardware");
  });

  it("renders a missing EIN and missing director fields as empty strings", () => {
    const values = buildSponsorTokenValues(
      context({ organizationEin: null, director: { name: null, title: null, email: null, phone: null } })
    );
    expect(values.organization_ein).toBe("");
    expect(values.director_name).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/letters/sponsor-token-values.test.ts`
Expected: FAIL — "Failed to resolve import ./sponsor-token-values".

- [ ] **Step 3: Write the token builder**

Create `lib/letters/sponsor-token-values.ts` mirroring `buildSeasonTokenValues`: format money via `formatCurrency`, dates via `formatDate`, coerce every null to `""`, apply the contact-name fallback (no letter should open "Dear ,"), map `payment_method` through `SPONSOR_PAYMENT_METHOD_LABELS`, and compute `term_label` via `formatTermLabel`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/letters/sponsor-token-values.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the failing route test**

Create `app/api/organizations/[orgId]/sponsor-letters/route.test.ts` modelled on the season letters route test, covering:

```ts
  it("returns 401 when no user is signed in", async () => { /* getUser resolves null */ });

  it("returns 404 when sponsor tracking is disabled for the org", async () => { /* sponsors_enabled: false */ });

  it("returns 404 for a template belonging to another organization", async () => { /* template query returns null */ });

  it("returns 400 for a season template used as a sponsor letter", async () => {
    // template row has template_type: "season_balance"
    // expect the body to mention that the template is not a sponsor template
  });

  it("ignores sponsorship ids outside the organization", async () => {
    // Request two ids; the sponsorships query returns one. Expect a PDF for
    // exactly one recipient — the client can narrow the set, never widen it.
  });

  it("returns 400 when no requested sponsorship survives the filter", async () => { /* query returns [] */ });

  it("returns a PDF with the expected content type", async () => {
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
  });
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run "app/api/organizations/[orgId]/sponsor-letters/route.test.ts"`
Expected: FAIL — "Failed to resolve import ./route".

- [ ] **Step 7: Write the route**

`POST /api/organizations/[orgId]/sponsor-letters` follows the season letters route step for step: `await params`, `getUser()`, `fetchSponsorsOrg()` (404 when null), parse the body with `sponsorLetterRequestSchema`, load the template scoped to `organization_id` **and** `template_type = 'sponsor_acknowledgment'`, then:

```ts
  const { data: sponsorships } = await supabase
    .from("sponsorships")
    .select(
      "id, amount, payment_method, received_date, term_start_date, term_end_date, sponsors!inner(name, contact_name, organization_id), sponsor_levels(name)"
    )
    .in("id", parsed.data.sponsorship_ids)
    .eq("sponsors.organization_id", orgId)
    .order("received_date", { ascending: true });
```

Map each row through `buildSponsorTokenValues` into a `LetterRecipient` with no `detailTables` — a single sponsorship is fully described by its tokens, and a one-row table would be noise. Return the buffer from `generateLettersPdf(batch)` with `Content-Type: application/pdf` and a `Content-Disposition` filename built from the org name and term label, using the same `safeName()` helper the season route defines.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run "app/api/organizations/[orgId]/sponsor-letters/route.test.ts"`
Expected: PASS, 7 tests.

- [ ] **Step 9: Build the generation page**

`sponsor-letters/page.tsx` guards with `fetchSponsorsOrg`, then loads the distinct terms and the sponsor templates:

```ts
  const { data: terms } = await supabase
    .from("sponsorships")
    .select("term_start_date, term_end_date, sponsors!inner(organization_id)")
    .eq("sponsors.organization_id", orgId)
    .order("term_start_date", { ascending: false });

  // Distinct terms, newest first, defaulting to the org's current term.
  const uniqueTerms = [
    ...new Map(
      (terms ?? []).map((t) => [`${t.term_start_date}|${t.term_end_date}`, t])
    ).values(),
  ];
```

`generate-sponsor-letters-form.tsx` is a Client Component with a term select, a template select, a checkbox list of that term's sponsorships (name, level, amount, and a "In queue" / "Deposited" marker), select-all/none, and a submit that POSTs to the API route and downloads the returned blob. Copy the fetch-and-download mechanics from `seasons/[seasonId]/letters/generate-letters-form.tsx` exactly.

Every sponsorship in the term is listed regardless of deposit state: a check in hand is money received, whether or not the treasurer has been to the bank. The marker exists so one can be held back deliberately.

- [ ] **Step 10: Verify end to end**

```bash
npm run dev
```

Create a sponsor-acknowledgment template using `{{sponsor_name}}`, `{{sponsorship_amount}}`, `{{term_label}}`, and `{{organization_ein}}`; generate letters for the current term; confirm one page per sponsor with the tokens filled in and the director signature block at the bottom.

- [ ] **Step 11: Commit**

```bash
git add lib/letters/sponsor-token-values.ts lib/letters/sponsor-token-values.test.ts "app/api/organizations/[orgId]/sponsor-letters" "app/(dashboard)/organizations/[orgId]/sponsor-letters"
git commit -m "feat(sponsors): generate 501(c)(3) acknowledgment letters by sponsorship year"
```

---

## Task 13: Navigation and final verification

**Files:**
- Modify: `components/layout/sidebar.tsx`
- Modify: `components/layout/dashboard-shell.tsx` (or wherever `seasonsEnabled` is passed down — follow the prop)
- Modify: `docs/whatsleft.md`

**Interfaces:**
- Consumes: everything
- Produces: nothing

- [ ] **Step 1: Add the sponsors nav item**

In `components/layout/sidebar.tsx`, add `Handshake` to the lucide import and:

```tsx
const sponsorNavItems = [
  { label: "Sponsors", href: "/sponsors", icon: Handshake, exact: false },
];
```

Add `sponsorsEnabled: boolean` to `SidebarProps` and `SidebarContent`'s props, then compose:

```tsx
  const allItems = [
    ...navItems,
    ...(seasonsEnabled ? seasonNavItems : []),
    ...(sponsorsEnabled ? sponsorNavItems : []),
  ];
```

Levels and Letters are reached from the sponsors index rather than adding two more sidebar entries.

- [ ] **Step 2: Fix the Letters gating**

`seasonNavItems` currently carries the Letters entry, so an org with sponsors but not seasons cannot reach its own template library. Pull Letters out of `seasonNavItems` into its own entry included when either flag is on:

```tsx
const seasonNavItems = [
  { label: "Seasons", href: "/seasons", icon: Calendar, exact: false },
  { label: "Students", href: "/students", icon: Users, exact: false },
];

const letterNavItem = { label: "Letters", href: "/letter-templates", icon: Mail, exact: false };
```

and append `letterNavItem` when `seasonsEnabled || sponsorsEnabled`.

- [ ] **Step 3: Thread the flag through the shell**

Find where `seasonsEnabled` is read from the organization and passed to `Sidebar` (the dashboard layout / shell), and pass `sponsorsEnabled` alongside it from the same query. Add `sponsors_enabled` to that `select()`.

- [ ] **Step 4: Verify the whole feature**

```bash
npm run lint 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
npm test 2>&1 | tail -20
npm run build 2>&1 | tail -20
```

Expected: no failures beyond the Task 1 baseline; the build succeeds. Compare against `/tmp/baseline-*.txt` rather than expecting zero output.

- [ ] **Step 5: Walk the full flow in the browser**

```bash
npm run dev
```

1. Turn sponsor tracking on; confirm "Sponsors" and "Letters" appear in the sidebar.
2. Turn it off; confirm both disappear, and that visiting `/organizations/<id>/sponsors` directly returns a 404 rather than rendering.
3. Turn it back on. Add levels, sponsors, and payments by cash, check, and PayPal.
4. Deposit the cash and check payments into the checking account as one transaction; confirm the split lines.
5. Try to add the PayPal payment to that same deposit; confirm the UI blocks it with the same wording the server returns.
6. Deposit the PayPal payment into the PayPal account with the fee box checked; confirm the companion fee expense appears.
7. Renew a sponsor at a different level; confirm the term advances a year and the level change sticks.
8. Generate acknowledgment letters for the term.
9. Delete the first deposit; confirm both payments return to the queue.

- [ ] **Step 6: Update the stale feature doc**

`docs/whatsleft.md` predates budgets, seasons, students, letters, and reconciliation and now claims there are six tables and zero tests. Add a short "Sponsors" line under what's implemented and correct the two claims that this work makes visibly wrong. Do not rewrite the document — that is a separate job.

- [ ] **Step 7: Commit and open the PR**

```bash
git add components/layout docs/whatsleft.md
git commit -m "feat(sponsors): surface sponsors in the sidebar and fix letters gating"
git push -u origin feat/sponsors-and-deposit-queue
gh pr create --title "Sponsors, sponsorship levels, and the deposit queue" --body "$(cat <<'BODY'
Implements `docs/superpowers/specs/2026-09-06-sponsors-and-deposit-queue-design.md`.

- Sponsors, configurable sponsorship levels, and sponsorship records that double as the payment that created them
- A queue of undeposited payments, and a deposit builder that turns a selection into one split income transaction
- Renewal into the next sponsorship year with an editable level
- 501(c)(3) acknowledgment letters, batched per sponsorship year
- Extracts the processing-fee companion so the transaction form and the deposit builder share one implementation

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

---

## Notes for the Implementer

**The three things most likely to go wrong:**

1. **Deposit amounts.** They come from the `sponsorships` rows, never the form. If you find yourself reading an amount out of `FormData` in Task 8, stop.
2. **The claim step.** The `UPDATE ... .is("transaction_id", null)` with a row count is what makes concurrent deposits safe. A plain update by id would let two windows deposit the same check twice.
3. **The season letters regression.** Task 11 changes a renderer that already ships. Its existing tests must pass with their assertions untouched; if you are editing assertions, you have changed behavior.

**Deliberately not built** (from the spec's out-of-scope list — do not add them opportunistically): pledges recorded before payment, installments against one sponsorship, emailing letters, benefit fulfilment tracking, sponsor dimensions in the financial reports, and a generic non-sponsor deposit queue.
