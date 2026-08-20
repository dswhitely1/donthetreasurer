# Student Balance Letters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a treasurer maintain reusable letter templates and generate a printable PDF containing one letter per student who still owes fees for a season.

**Architecture:** Two migrations add director fields to `organizations` and a `letter_templates` table. Placeholder substitution lives in pure, dependency-free functions under `lib/letters/`. A jsPDF generator under `lib/pdf/` renders one letter per page. Org-scoped CRUD pages manage templates; a season-scoped page selects recipients and POSTs to an API route that returns the PDF. Balance math is never reimplemented — the existing `fetchSeasonReport` pipeline is the only source of what a student owes.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 strict · Supabase (PostgreSQL + RLS) · Zod 4 · jsPDF 4 + jspdf-autotable 5 · Tailwind CSS 4 · shadcn/ui · Vitest 4

**Spec:** `docs/superpowers/specs/2026-08-20-student-balance-letters-design.md`

## Global Constraints

- **Branch:** all work happens on `feat/student-balance-letters`. Never commit to `main`.
- **Forms use `useActionState` + `FormData`.** This codebase does **not** use react-hook-form or `zodResolver`, despite CLAUDE.md listing it. Follow the actual code in `app/(dashboard)/organizations/[orgId]/budgets/budget-form.tsx`.
- **Server Action signature:** `(_prevState: { error: string } | null, formData: FormData)`, returning `{ error: string }` or calling `revalidatePath()` then `redirect()`.
- **Zod style:** match the existing files — `z.string().uuid("msg")`, `z.string().email("msg")`, `.optional().or(z.literal(""))` for optional text. Do not migrate to Zod 4's `z.uuid()` / `z.email()` top-level forms; the codebase uses the method style throughout.
- **Optional text columns:** store `null`, never `""`. Actions convert with `value || null`.
- **Props:** always wrapped in `Readonly<>`.
- **Imports, in order:** React/Next → external packages → `@/lib`, `@/components`, `@/hooks` → relative → `import type`.
- **Feature gating:** every letters route and the sidebar entry are gated on `organizations.seasons_enabled`, matching Seasons and Students.
- **Money in the UI** uses `formatCurrency()` from `@/lib/utils` and the `tabular-nums` class.
- **Test command:** `npx vitest run <path>` for one file; `npm test` for all.
- **Every commit message ends with these two trailers** (shown in full in Task 1, abbreviated as `<trailers>` afterwards):
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0138VP7cPEaRj2CuAKSSAi7a
  ```
- **Migrations are not auto-applied.** After Task 2, `types/database.ts` must be regenerated; every later task depends on those types existing.

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `supabase/migrations/20260820000001_organization_director.sql` | Four director columns on `organizations` |
| `supabase/migrations/20260820000002_letter_templates.sql` | `letter_templates` table, indexes, RLS, trigger |
| `lib/letters/placeholders.ts` | Placeholder vocabulary; unknown-token detection |
| `lib/letters/types.ts` | `LetterRecipient`, `LetterBatchData`, `TokenValues` |
| `lib/letters/render-template.ts` | `buildTokenValues()`, `renderTemplate()` — pure |
| `lib/letters/sample-context.ts` | Sample token values powering the form's live preview |
| `lib/validations/letter-template.ts` | Zod schemas incl. unknown-placeholder refinement |
| `lib/pdf/generate-letters.ts` | jsPDF batch renderer, one letter per page |
| `app/(dashboard)/organizations/[orgId]/letter-templates/actions.ts` | Template CRUD Server Actions |
| `app/(dashboard)/organizations/[orgId]/letter-templates/page.tsx` | Template list |
| `app/(dashboard)/organizations/[orgId]/letter-templates/new/page.tsx` | Create page |
| `app/(dashboard)/organizations/[orgId]/letter-templates/[templateId]/edit/page.tsx` | Edit page |
| `app/(dashboard)/organizations/[orgId]/letter-templates/letter-template-form.tsx` | Shared form + placeholder palette + live preview |
| `app/(dashboard)/organizations/[orgId]/letter-templates/template-actions.tsx` | Delete / set-default buttons |
| `app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/letters/page.tsx` | Recipient selection page |
| `app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/letters/generate-letters-form.tsx` | Template picker, checkbox list, download |
| `app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.ts` | POST → PDF |

**Modified**

| File | Change |
|---|---|
| `lib/validations/organization.ts` | Four director fields on the org schema |
| `app/(dashboard)/organizations/actions.ts` | `updateOrganization` reads/writes director fields |
| `app/(dashboard)/organizations/[orgId]/organization-actions.tsx` | Director inputs in the edit form |
| `lib/seasons/types.ts` | `studentFirstName` / `studentLastName` on `SeasonReportEnrollment` |
| `lib/seasons/fetch-season-report.ts` | Populate those two fields |
| `components/layout/sidebar.tsx` | "Letters" entry in `seasonNavItems` |
| `app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/page.tsx` | "Generate Letters" button |

**Test files created**

`lib/letters/placeholders.test.ts` · `lib/letters/render-template.test.ts` · `lib/validations/letter-template.test.ts` · `lib/pdf/generate-letters.test.ts` · `app/(dashboard)/organizations/[orgId]/letter-templates/actions.test.ts` · `app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.test.ts`

---

### Task 1: Director fields on the organization

**Files:**
- Create: `supabase/migrations/20260820000001_organization_director.sql`
- Modify: `lib/validations/organization.ts`
- Modify: `app/(dashboard)/organizations/actions.ts:55-97` (`updateOrganization`)
- Modify: `app/(dashboard)/organizations/[orgId]/organization-actions.tsx` (after the fiscal-month field, before the `seasons_enabled` hidden input)
- Test: `lib/validations/organization.test.ts` (existing — add cases)

**Interfaces:**
- Consumes: nothing.
- Produces: `organizations.director_name | director_title | director_email | director_phone` (all `TEXT NULL`); `createOrganizationSchema` and `updateOrganizationSchema` accept those four keys as optional strings.

- [ ] **Step 1: Write the failing validation tests**

Append to `lib/validations/organization.test.ts` (inside the existing top-level `describe`):

```ts
describe("director fields", () => {
  const base = {
    name: "Acme Band Boosters",
    ein: "",
    fiscal_year_start_month: "7",
    seasons_enabled: "false",
  };

  it("accepts a complete director block", () => {
    const result = createOrganizationSchema.safeParse({
      ...base,
      director_name: "Jane Doe",
      director_title: "Band Director",
      director_email: "jane@band.org",
      director_phone: "555-0100",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty strings for every director field", () => {
    const result = createOrganizationSchema.safeParse({
      ...base,
      director_name: "",
      director_title: "",
      director_email: "",
      director_phone: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an organization with no director keys at all", () => {
    const result = createOrganizationSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejects a malformed director email", () => {
    const result = createOrganizationSchema.safeParse({
      ...base,
      director_email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});
```

If `createOrganizationSchema` is not already imported in that file, add it to the existing import from `./organization`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/validations/organization.test.ts`
Expected: FAIL — "rejects a malformed director email" fails because unknown keys are stripped, so no error is raised.

- [ ] **Step 3: Add the fields to the schema**

In `lib/validations/organization.ts`, add these four keys to `createOrganizationSchema` after `fiscal_year_start_month`:

```ts
  director_name: z
    .string()
    .max(100, "Director name must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  director_title: z
    .string()
    .max(100, "Director title must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  director_email: z
    .string()
    .email("Director email must be a valid email address.")
    .max(255, "Director email must be 255 characters or fewer.")
    .optional()
    .or(z.literal("")),
  director_phone: z
    .string()
    .max(30, "Director phone must be 30 characters or fewer.")
    .optional()
    .or(z.literal("")),
```

`updateOrganizationSchema` extends `createOrganizationSchema`, so it inherits them with no change.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/validations/organization.test.ts`
Expected: PASS

- [ ] **Step 5: Write the migration**

Create `supabase/migrations/20260820000001_organization_director.sql`:

```sql
-- Contact details for the person letters are signed by (e.g. the band director).
-- Stored on the organization so replacing the director is a single edit that
-- every letter template picks up automatically.
ALTER TABLE public.organizations
  ADD COLUMN director_name TEXT,
  ADD COLUMN director_title TEXT,
  ADD COLUMN director_email TEXT,
  ADD COLUMN director_phone TEXT;
```

- [ ] **Step 6: Read the director fields in the update action**

In `app/(dashboard)/organizations/actions.ts`, inside `updateOrganization`, extend `raw`:

```ts
  const raw = {
    id: formData.get("id") as string,
    name: formData.get("name") as string,
    ein: formData.get("ein") as string,
    fiscal_year_start_month: formData.get("fiscal_year_start_month") as string,
    seasons_enabled: formData.get("seasons_enabled") as string,
    director_name: (formData.get("director_name") as string) ?? "",
    director_title: (formData.get("director_title") as string) ?? "",
    director_email: (formData.get("director_email") as string) ?? "",
    director_phone: (formData.get("director_phone") as string) ?? "",
  };
```

and extend the `.update({...})` call:

```ts
    .update({
      name: parsed.data.name,
      ein: parsed.data.ein || null,
      fiscal_year_start_month: parsed.data.fiscal_year_start_month,
      seasons_enabled: parsed.data.seasons_enabled,
      director_name: parsed.data.director_name || null,
      director_title: parsed.data.director_title || null,
      director_email: parsed.data.director_email || null,
      director_phone: parsed.data.director_phone || null,
    })
```

Leave `createOrganization` alone — a new org has no director yet, and the fields are nullable.

- [ ] **Step 7: Add the inputs to the organization edit form**

In `app/(dashboard)/organizations/[orgId]/organization-actions.tsx`, insert this block immediately after the closing `</div>` of the fiscal-year-month field and before the `seasons_enabled` hidden input:

```tsx
          <div className="flex flex-col gap-1.5 border-t border-border pt-4">
            <p className="text-sm font-medium">Letter Signature</p>
            <p className="text-sm text-muted-foreground">
              Printed at the bottom of every letter you generate.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-director-name">Director Name</Label>
              <Input
                id="edit-director-name"
                name="director_name"
                maxLength={100}
                defaultValue={organization.director_name ?? ""}
                placeholder="Jane Doe"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-director-title">Director Title</Label>
              <Input
                id="edit-director-title"
                name="director_title"
                maxLength={100}
                defaultValue={organization.director_title ?? ""}
                placeholder="Band Director"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-director-email">Director Email</Label>
              <Input
                id="edit-director-email"
                name="director_email"
                type="email"
                maxLength={255}
                defaultValue={organization.director_email ?? ""}
                placeholder="jane@example.org"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-director-phone">Director Phone</Label>
              <Input
                id="edit-director-phone"
                name="director_phone"
                maxLength={30}
                defaultValue={organization.director_phone ?? ""}
                placeholder="555-0100"
              />
            </div>
          </div>
```

These read from `Tables<"organizations">`, so they will not typecheck until Task 2 regenerates `types/database.ts`. That is expected — do not add casts to work around it.

- [ ] **Step 8: Run lint and the full test suite**

Run: `npm run lint && npm test`
Expected: lint clean; all tests pass. `npm run build` will still fail on the not-yet-regenerated database types — that is resolved in Task 2.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260820000001_organization_director.sql \
        lib/validations/organization.ts \
        lib/validations/organization.test.ts \
        "app/(dashboard)/organizations/actions.ts" \
        "app/(dashboard)/organizations/[orgId]/organization-actions.tsx"
git commit -m "feat: add director contact fields to organizations

Letters are signed by the band director, whose details change over time.
Storing them on the organization means replacing the director is one edit
rather than a rewrite of every letter template.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138VP7cPEaRj2CuAKSSAi7a"
```

---

### Task 2: `letter_templates` table and regenerated types

**Files:**
- Create: `supabase/migrations/20260820000002_letter_templates.sql`
- Modify: `types/database.ts` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: `organizations` (FK target), the existing `update_updated_at()` trigger function from `supabase/migrations/20260131000003_updated_at_triggers.sql`.
- Produces: `Tables<"letter_templates">` with fields `id`, `organization_id`, `name`, `heading`, `body`, `closing`, `is_default`, `created_at`, `updated_at`. Also `director_*` on `Tables<"organizations">` from Task 1.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260820000002_letter_templates.sql`:

```sql
-- Reusable letter templates for notifying families of outstanding season fees.
CREATE TABLE public.letter_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  heading TEXT,
  body TEXT NOT NULL,
  closing TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX idx_letter_templates_organization
  ON public.letter_templates(organization_id);

-- At most one default template per organization.
CREATE UNIQUE INDEX idx_letter_templates_one_default
  ON public.letter_templates(organization_id)
  WHERE is_default;

ALTER TABLE public.letter_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access letter templates in their organizations"
  ON public.letter_templates
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.letter_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

`ON DELETE CASCADE` is deliberate and differs from categories: deleting a template destroys no financial record.

- [ ] **Step 2: Apply both migrations**

Apply `20260820000001` and `20260820000002` to the Supabase project (via the Supabase SQL editor or `npx supabase db push`, whichever this project uses).
Expected: both succeed; `letter_templates` exists and `organizations` has four new columns.

- [ ] **Step 3: Regenerate the database types**

Run: `npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" > types/database.ts`

The project ref is the subdomain of `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` (`https://<project-ref>.supabase.co`). If the project is linked locally, `npx supabase gen types typescript --linked > types/database.ts` works instead.
Expected: `types/database.ts` now contains a `letter_templates` entry and four `director_*` fields on `organizations`.

- [ ] **Step 4: Verify the build typechecks**

Run: `npm run build`
Expected: PASS — Task 1's form now typechecks against the regenerated types.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260820000002_letter_templates.sql types/database.ts
git commit -m "feat: add letter_templates table

Org-scoped letter templates with RLS matching the seasons ownership chain
and a partial unique index enforcing at most one default per organization.

<trailers>"
```

---

### Task 3: Placeholder vocabulary and template validation

**Files:**
- Create: `lib/letters/placeholders.ts`
- Create: `lib/letters/placeholders.test.ts`
- Create: `lib/validations/letter-template.ts`
- Create: `lib/validations/letter-template.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `LETTER_PLACEHOLDERS: readonly { token: string; label: string; description: string }[]`
  - `type PlaceholderToken` — union of the 16 token strings
  - `createPlaceholderPattern(): RegExp`
  - `findUnknownPlaceholders(text: string): string[]`
  - `createLetterTemplateSchema`, `updateLetterTemplateSchema`, `letterTemplateIdSchema`
  - `type CreateLetterTemplateInput`, `type UpdateLetterTemplateInput`

- [ ] **Step 1: Write the failing placeholder tests**

Create `lib/letters/placeholders.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import {
  LETTER_PLACEHOLDERS,
  createPlaceholderPattern,
  findUnknownPlaceholders,
} from "./placeholders";

describe("LETTER_PLACEHOLDERS", () => {
  it("has no duplicate tokens", () => {
    const tokens = LETTER_PLACEHOLDERS.map((p) => p.token);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("gives every placeholder a label and description", () => {
    for (const placeholder of LETTER_PLACEHOLDERS) {
      expect(placeholder.label.length).toBeGreaterThan(0);
      expect(placeholder.description.length).toBeGreaterThan(0);
    }
  });
});

describe("createPlaceholderPattern", () => {
  it("returns a fresh regex each call so lastIndex is never shared", () => {
    const first = createPlaceholderPattern();
    const second = createPlaceholderPattern();
    expect(first).not.toBe(second);
    expect(second.lastIndex).toBe(0);
  });

  it("matches tokens with and without inner whitespace", () => {
    const text = "{{balance_due}} and {{ balance_due }}";
    const matches = [...text.matchAll(createPlaceholderPattern())];
    expect(matches).toHaveLength(2);
    expect(matches[0][1]).toBe("balance_due");
    expect(matches[1][1]).toBe("balance_due");
  });
});

describe("findUnknownPlaceholders", () => {
  it("returns an empty array when every token is known", () => {
    expect(
      findUnknownPlaceholders("Dear {{guardian_name}}, you owe {{balance_due}}.")
    ).toEqual([]);
  });

  it("reports a misspelled token", () => {
    expect(findUnknownPlaceholders("You owe {{ballance_due}}.")).toEqual([
      "ballance_due",
    ]);
  });

  it("reports each unknown token only once", () => {
    expect(
      findUnknownPlaceholders("{{nope}} then {{nope}} then {{other}}")
    ).toEqual(["nope", "other"]);
  });

  it("ignores text with no placeholders", () => {
    expect(findUnknownPlaceholders("Plain text, no tokens.")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/letters/placeholders.test.ts`
Expected: FAIL — "Failed to resolve import ./placeholders".

- [ ] **Step 3: Implement the placeholder vocabulary**

Create `lib/letters/placeholders.ts`:

```ts
/**
 * The complete vocabulary of placeholders a letter template may use.
 * Single source of truth: consumed by the click-to-insert palette in the
 * template form, by save-time validation, and by the renderer.
 */
export const LETTER_PLACEHOLDERS = [
  {
    token: "organization_name",
    label: "Organization Name",
    description: "The organization's name",
  },
  {
    token: "season_name",
    label: "Season Name",
    description: "Name of the season the letter is generated for",
  },
  {
    token: "season_start_date",
    label: "Season Start",
    description: "Season start date, MM/DD/YYYY",
  },
  {
    token: "season_end_date",
    label: "Season End",
    description: "Season end date, MM/DD/YYYY",
  },
  {
    token: "student_first_name",
    label: "Student First Name",
    description: "The student's first name",
  },
  {
    token: "student_last_name",
    label: "Student Last Name",
    description: "The student's last name",
  },
  {
    token: "student_full_name",
    label: "Student Full Name",
    description: "The student's first and last name",
  },
  {
    token: "guardian_name",
    label: "Guardian Name",
    description:
      "The guardian's name, falling back to the student's full name when no guardian is recorded",
  },
  {
    token: "fee_amount",
    label: "Season Fee",
    description: "The student's season fee, formatted as currency",
  },
  {
    token: "total_paid",
    label: "Total Paid",
    description: "Everything paid so far, formatted as currency",
  },
  {
    token: "balance_due",
    label: "Balance Due",
    description: "The amount still owed, formatted as currency",
  },
  {
    token: "today",
    label: "Today's Date",
    description: "The date the letter is generated, MM/DD/YYYY",
  },
  {
    token: "director_name",
    label: "Director Name",
    description: "Director name from organization settings",
  },
  {
    token: "director_title",
    label: "Director Title",
    description: "Director title from organization settings",
  },
  {
    token: "director_email",
    label: "Director Email",
    description: "Director email from organization settings",
  },
  {
    token: "director_phone",
    label: "Director Phone",
    description: "Director phone from organization settings",
  },
] as const;

export type PlaceholderToken = (typeof LETTER_PLACEHOLDERS)[number]["token"];

const KNOWN_TOKENS: ReadonlySet<string> = new Set(
  LETTER_PLACEHOLDERS.map((placeholder) => placeholder.token)
);

/**
 * Returns a NEW global regex on every call. A shared module-level `/g` regex
 * carries mutable `lastIndex` state between callers, which silently skips
 * matches; handing out a fresh instance makes that impossible.
 */
export function createPlaceholderPattern(): RegExp {
  return /\{\{\s*(\w+)\s*\}\}/g;
}

/** Tokens present in `text` that are not part of the vocabulary, de-duplicated. */
export function findUnknownPlaceholders(text: string): string[] {
  const unknown: string[] = [];
  for (const match of text.matchAll(createPlaceholderPattern())) {
    const token = match[1];
    if (!KNOWN_TOKENS.has(token) && !unknown.includes(token)) {
      unknown.push(token);
    }
  }
  return unknown;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/letters/placeholders.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing validation tests**

Create `lib/validations/letter-template.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import {
  createLetterTemplateSchema,
  updateLetterTemplateSchema,
  letterTemplateIdSchema,
} from "./letter-template";

const orgId = "660e8400-e29b-41d4-a716-446655440000";
const templateId = "770e8400-e29b-41d4-a716-446655440000";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: orgId,
    name: "First Notice",
    heading: "Outstanding Balance Notice",
    body: "Dear {{guardian_name}}, you owe {{balance_due}}.",
    closing: "Sincerely,",
    is_default: "false",
    ...overrides,
  };
}

describe("createLetterTemplateSchema", () => {
  it("accepts a valid template", () => {
    expect(createLetterTemplateSchema.safeParse(validInput()).success).toBe(true);
  });

  it("accepts empty heading and closing", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ heading: "", closing: "" })
    );
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createLetterTemplateSchema.safeParse(validInput({ name: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty body", () => {
    const result = createLetterTemplateSchema.safeParse(validInput({ body: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a body longer than 5000 characters", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ body: "x".repeat(5001) })
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unknown placeholder in the body", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ body: "You owe {{ballance_due}}." })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("{{ballance_due}}");
      expect(result.error.issues[0].path).toEqual(["body"]);
    }
  });

  it("rejects an unknown placeholder in the heading", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ heading: "Notice for {{stdent_name}}" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["heading"]);
    }
  });

  it("rejects an unknown placeholder in the closing", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ closing: "Regards, {{signer}}" })
    );
    expect(result.success).toBe(false);
  });

  it("lists every unknown token in one message", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ body: "{{alpha}} and {{beta}}" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("{{alpha}}");
      expect(result.error.issues[0].message).toContain("{{beta}}");
    }
  });

  it("coerces the is_default checkbox string to a boolean", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ is_default: "true" })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_default).toBe(true);
    }
  });
});

describe("updateLetterTemplateSchema", () => {
  it("requires a template id", () => {
    expect(updateLetterTemplateSchema.safeParse(validInput()).success).toBe(false);
  });

  it("accepts a valid update", () => {
    const result = updateLetterTemplateSchema.safeParse(
      validInput({ id: templateId })
    );
    expect(result.success).toBe(true);
  });

  it("still rejects unknown placeholders", () => {
    const result = updateLetterTemplateSchema.safeParse(
      validInput({ id: templateId, body: "{{nope}}" })
    );
    expect(result.success).toBe(false);
  });
});

describe("letterTemplateIdSchema", () => {
  it("accepts a valid id pair", () => {
    const result = letterTemplateIdSchema.safeParse({
      id: templateId,
      organization_id: orgId,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    const result = letterTemplateIdSchema.safeParse({
      id: "not-a-uuid",
      organization_id: orgId,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run lib/validations/letter-template.test.ts`
Expected: FAIL — "Failed to resolve import ./letter-template".

- [ ] **Step 7: Implement the validation schemas**

Create `lib/validations/letter-template.ts`:

```ts
import { z } from "zod";

import { findUnknownPlaceholders } from "@/lib/letters/placeholders";

const PLACEHOLDER_FIELDS = ["heading", "body", "closing"] as const;

const baseLetterTemplateSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  name: z
    .string()
    .min(1, "Name is required.")
    .max(100, "Name must be 100 characters or fewer."),
  heading: z
    .string()
    .max(150, "Heading must be 150 characters or fewer.")
    .optional()
    .or(z.literal("")),
  body: z
    .string()
    .min(1, "Letter body is required.")
    .max(5000, "Letter body must be 5000 characters or fewer."),
  closing: z
    .string()
    .max(300, "Closing must be 300 characters or fewer.")
    .optional()
    .or(z.literal("")),
  is_default: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .default(false),
});

type PlaceholderCarrier = {
  heading?: string;
  body: string;
  closing?: string;
};

/**
 * Rejects placeholders outside the known vocabulary at save time, so a typo
 * surfaces in the form instead of printing literally on every letter.
 */
function checkPlaceholders(
  data: PlaceholderCarrier,
  ctx: z.RefinementCtx
): void {
  for (const field of PLACEHOLDER_FIELDS) {
    const value = data[field];
    if (!value) continue;

    const unknown = findUnknownPlaceholders(value);
    if (unknown.length === 0) continue;

    const rendered = unknown.map((token) => `{{${token}}}`).join(", ");
    ctx.addIssue({
      code: "custom",
      path: [field],
      message: `Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${rendered}`,
    });
  }
}

export const createLetterTemplateSchema =
  baseLetterTemplateSchema.superRefine(checkPlaceholders);

export const updateLetterTemplateSchema = baseLetterTemplateSchema
  .extend({
    id: z.string().uuid("Invalid template ID."),
  })
  .superRefine(checkPlaceholders);

export const letterTemplateIdSchema = z.object({
  id: z.string().uuid("Invalid template ID."),
  organization_id: z.string().uuid("Invalid organization ID."),
});

export type CreateLetterTemplateInput = z.infer<typeof createLetterTemplateSchema>;
export type UpdateLetterTemplateInput = z.infer<typeof updateLetterTemplateSchema>;
export type LetterTemplateIdInput = z.infer<typeof letterTemplateIdSchema>;
```

- [ ] **Step 8: Run both test files to verify they pass**

Run: `npx vitest run lib/letters/placeholders.test.ts lib/validations/letter-template.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add lib/letters/placeholders.ts lib/letters/placeholders.test.ts \
        lib/validations/letter-template.ts lib/validations/letter-template.test.ts
git commit -m "feat: add letter placeholder vocabulary and template validation

One source of truth for the placeholder set, consumed by the insert palette,
save-time validation, and the renderer. Unknown tokens fail validation so a
typo surfaces in the form rather than on forty printed letters.

<trailers>"
```

---

### Task 4: Letter types, render engine, and sample context

**Files:**
- Create: `lib/letters/types.ts`
- Create: `lib/letters/render-template.ts`
- Create: `lib/letters/render-template.test.ts`
- Create: `lib/letters/sample-context.ts`

**Interfaces:**
- Consumes: `PlaceholderToken`, `createPlaceholderPattern` from `lib/letters/placeholders.ts` (Task 3); `formatCurrency`, `formatDate` from `@/lib/utils`.
- Produces:
  - `interface LetterDirector { name, title, email, phone: string | null }`
  - `interface LetterPayment { payment_date: string; amount: number; payment_method: string | null }`
  - `interface LetterRecipient { enrollmentId, studentFirstName, studentLastName: string; guardianName: string | null; feeAmount, totalPaid, balanceDue: number; payments: LetterPayment[] }`
  - `interface LetterTemplateContent { heading: string | null; body: string; closing: string | null }`
  - `interface LetterBatchData { organizationName: string; director: LetterDirector; seasonName, seasonStartDate, seasonEndDate, generatedOn: string; template: LetterTemplateContent; recipients: LetterRecipient[] }`
  - `type TokenValues = Record<PlaceholderToken, string>`
  - `buildTokenValues(batch: LetterBatchData, recipient: LetterRecipient): TokenValues`
  - `renderTemplate(text: string, values: TokenValues): string`
  - `SAMPLE_TOKEN_VALUES: TokenValues`

- [ ] **Step 1: Write the failing render tests**

Create `lib/letters/render-template.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { buildTokenValues, renderTemplate } from "./render-template";

import type { LetterBatchData, LetterRecipient } from "./types";

function makeRecipient(
  overrides: Partial<LetterRecipient> = {}
): LetterRecipient {
  return {
    enrollmentId: "880e8400-e29b-41d4-a716-446655440000",
    studentFirstName: "Alex",
    studentLastName: "Rivera",
    guardianName: "Maria Rivera",
    feeAmount: 450,
    totalPaid: 200,
    balanceDue: 250,
    payments: [],
    ...overrides,
  };
}

function makeBatch(overrides: Partial<LetterBatchData> = {}): LetterBatchData {
  return {
    organizationName: "Acme Band Boosters",
    director: {
      name: "Jane Doe",
      title: "Band Director",
      email: "jane@band.org",
      phone: "555-0100",
    },
    seasonName: "Fall 2026",
    seasonStartDate: "2026-08-01",
    seasonEndDate: "2026-12-15",
    generatedOn: "2026-08-20",
    template: { heading: null, body: "", closing: null },
    recipients: [],
    ...overrides,
  };
}

describe("buildTokenValues", () => {
  it("formats currency tokens", () => {
    const values = buildTokenValues(makeBatch(), makeRecipient());
    expect(values.fee_amount).toBe("$450.00");
    expect(values.total_paid).toBe("$200.00");
    expect(values.balance_due).toBe("$250.00");
  });

  it("formats date tokens as MM/DD/YYYY", () => {
    const values = buildTokenValues(makeBatch(), makeRecipient());
    expect(values.season_start_date).toBe("08/01/2026");
    expect(values.season_end_date).toBe("12/15/2026");
    expect(values.today).toBe("08/20/2026");
  });

  it("builds the student's full name", () => {
    const values = buildTokenValues(makeBatch(), makeRecipient());
    expect(values.student_full_name).toBe("Alex Rivera");
  });

  it("uses the guardian name when present", () => {
    const values = buildTokenValues(makeBatch(), makeRecipient());
    expect(values.guardian_name).toBe("Maria Rivera");
  });

  it("falls back to the student's full name when guardian is null", () => {
    const values = buildTokenValues(
      makeBatch(),
      makeRecipient({ guardianName: null })
    );
    expect(values.guardian_name).toBe("Alex Rivera");
  });

  it("falls back to the student's full name when guardian is whitespace", () => {
    const values = buildTokenValues(
      makeBatch(),
      makeRecipient({ guardianName: "   " })
    );
    expect(values.guardian_name).toBe("Alex Rivera");
  });

  it("coerces null director fields to empty strings", () => {
    const batch = makeBatch({
      director: { name: null, title: null, email: null, phone: null },
    });
    const values = buildTokenValues(batch, makeRecipient());
    expect(values.director_name).toBe("");
    expect(values.director_title).toBe("");
    expect(values.director_email).toBe("");
    expect(values.director_phone).toBe("");
  });
});

describe("renderTemplate", () => {
  const values = buildTokenValues(makeBatch(), makeRecipient());

  it("substitutes a single token", () => {
    expect(renderTemplate("You owe {{balance_due}}.", values)).toBe(
      "You owe $250.00."
    );
  });

  it("substitutes every occurrence of a repeated token", () => {
    expect(renderTemplate("{{student_first_name}}/{{student_first_name}}", values)).toBe(
      "Alex/Alex"
    );
  });

  it("tolerates whitespace inside the braces", () => {
    expect(renderTemplate("Hi {{ guardian_name }},", values)).toBe(
      "Hi Maria Rivera,"
    );
  });

  it("renders unknown tokens as empty strings", () => {
    expect(renderTemplate("A{{not_a_token}}B", values)).toBe("AB");
  });

  it("leaves text with no tokens untouched", () => {
    expect(renderTemplate("Nothing to replace.", values)).toBe(
      "Nothing to replace."
    );
  });

  it("preserves paragraph breaks", () => {
    expect(renderTemplate("One\n\nTwo", values)).toBe("One\n\nTwo");
  });

  it("does not re-expand a token that appears inside a substituted value", () => {
    const sneaky = buildTokenValues(
      makeBatch(),
      makeRecipient({ studentFirstName: "{{balance_due}}" })
    );
    expect(renderTemplate("{{student_first_name}}", sneaky)).toBe(
      "{{balance_due}}"
    );
  });

  it("treats $& in a substituted value as a literal, not a regex reference", () => {
    const sneaky = buildTokenValues(
      makeBatch(),
      makeRecipient({ studentLastName: "$&" })
    );
    expect(renderTemplate("{{student_last_name}}", sneaky)).toBe("$&");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/letters/render-template.test.ts`
Expected: FAIL — "Failed to resolve import ./render-template".

- [ ] **Step 3: Define the letter types**

Create `lib/letters/types.ts`:

```ts
import type { PlaceholderToken } from "./placeholders";

export interface LetterDirector {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
}

export interface LetterPayment {
  payment_date: string;
  amount: number;
  payment_method: string | null;
}

export interface LetterRecipient {
  enrollmentId: string;
  studentFirstName: string;
  studentLastName: string;
  guardianName: string | null;
  feeAmount: number;
  totalPaid: number;
  balanceDue: number;
  payments: LetterPayment[];
}

export interface LetterTemplateContent {
  heading: string | null;
  body: string;
  closing: string | null;
}

export interface LetterBatchData {
  organizationName: string;
  director: LetterDirector;
  seasonName: string;
  seasonStartDate: string;
  seasonEndDate: string;
  /** Date the batch is generated, as YYYY-MM-DD. */
  generatedOn: string;
  template: LetterTemplateContent;
  recipients: LetterRecipient[];
}

export type TokenValues = Record<PlaceholderToken, string>;
```

- [ ] **Step 4: Implement the render engine**

Create `lib/letters/render-template.ts`:

```ts
import { formatCurrency, formatDate } from "@/lib/utils";

import { createPlaceholderPattern } from "./placeholders";

import type { LetterBatchData, LetterRecipient, TokenValues } from "./types";

export function buildTokenValues(
  batch: LetterBatchData,
  recipient: LetterRecipient
): TokenValues {
  const fullName =
    `${recipient.studentFirstName} ${recipient.studentLastName}`.trim();
  const guardian = recipient.guardianName?.trim();

  return {
    organization_name: batch.organizationName,
    season_name: batch.seasonName,
    season_start_date: formatDate(batch.seasonStartDate),
    season_end_date: formatDate(batch.seasonEndDate),
    student_first_name: recipient.studentFirstName,
    student_last_name: recipient.studentLastName,
    student_full_name: fullName,
    // A letter addressed to nobody is worse than one addressed to the student.
    guardian_name: guardian ? guardian : fullName,
    fee_amount: formatCurrency(recipient.feeAmount),
    total_paid: formatCurrency(recipient.totalPaid),
    balance_due: formatCurrency(recipient.balanceDue),
    today: formatDate(batch.generatedOn),
    director_name: batch.director.name ?? "",
    director_title: batch.director.title ?? "",
    director_email: batch.director.email ?? "",
    director_phone: batch.director.phone ?? "",
  };
}

/**
 * Substitutes placeholders in a single pass.
 *
 * The replacement is a FUNCTION rather than a string on purpose: it makes the
 * pass non-recursive (a value containing `{{token}}` is never re-expanded) and
 * stops `$&` / `$1` inside a student's name from being read as a regex
 * back-reference. Unknown tokens render empty — save-time validation is the
 * real guard against typos.
 */
export function renderTemplate(text: string, values: TokenValues): string {
  return text.replace(createPlaceholderPattern(), (_match, token: string) =>
    Object.prototype.hasOwnProperty.call(values, token)
      ? values[token as keyof TokenValues]
      : ""
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/letters/render-template.test.ts`
Expected: PASS

- [ ] **Step 6: Add the sample context for the form preview**

Create `lib/letters/sample-context.ts`:

```ts
import { buildTokenValues } from "./render-template";

import type { LetterBatchData, LetterRecipient, TokenValues } from "./types";

const SAMPLE_RECIPIENT: LetterRecipient = {
  enrollmentId: "00000000-0000-0000-0000-000000000000",
  studentFirstName: "Alex",
  studentLastName: "Rivera",
  guardianName: "Maria Rivera",
  feeAmount: 450,
  totalPaid: 200,
  balanceDue: 250,
  payments: [],
};

const SAMPLE_BATCH: LetterBatchData = {
  organizationName: "Your Organization",
  director: {
    name: "Jane Doe",
    title: "Band Director",
    email: "director@example.org",
    phone: "555-0100",
  },
  seasonName: "Fall 2026",
  seasonStartDate: "2026-08-01",
  seasonEndDate: "2026-12-15",
  generatedOn: "2026-08-20",
  template: { heading: null, body: "", closing: null },
  recipients: [SAMPLE_RECIPIENT],
};

/**
 * Fixed values powering the template form's live preview. Deliberately static
 * (including the date) so the preview never changes under the treasurer while
 * they type.
 */
export const SAMPLE_TOKEN_VALUES: TokenValues = buildTokenValues(
  SAMPLE_BATCH,
  SAMPLE_RECIPIENT
);
```

- [ ] **Step 7: Run lint and the letters tests**

Run: `npm run lint && npx vitest run lib/letters`
Expected: lint clean; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add lib/letters/types.ts lib/letters/render-template.ts \
        lib/letters/render-template.test.ts lib/letters/sample-context.ts
git commit -m "feat: add letter token values and template renderer

Pure, single-pass placeholder substitution. Using a replacer function rather
than a replacement string keeps the pass non-recursive and stops \$& inside a
student's name from acting as a regex back-reference.

<trailers>"
```

---

### Task 5: Expose student first and last name on the season report

**Files:**
- Modify: `lib/seasons/types.ts` (`SeasonReportEnrollment`)
- Modify: `lib/seasons/fetch-season-report.ts`
- Test: `lib/seasons/fetch-season-report.test.ts` (create)

**Interfaces:**
- Consumes: existing `fetchSeasonReport(supabase, seasonId)`.
- Produces: `SeasonReportEnrollment.studentFirstName: string` and `.studentLastName: string`, alongside the existing `studentName` (`"Last, First"`).

This is purely additive. `lib/excel/generate-season-report.ts` and `lib/pdf/generate-season-report.ts` keep using `studentName` and must not be touched.

- [ ] **Step 1: Write the failing test**

Create `lib/seasons/fetch-season-report.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";
import { fetchSeasonReport } from "./fetch-season-report";

import type { MockSupabaseClient } from "@/test/mocks/supabase";

const seasonId = "990e8400-e29b-41d4-a716-446655440000";

const seasonRow = {
  id: seasonId,
  name: "Fall 2026",
  description: null,
  start_date: "2026-08-01",
  end_date: "2026-12-15",
  fee_amount: 450,
  status: "active",
  organizations: { name: "Acme Band Boosters" },
};

const enrollmentRows = [
  {
    id: "880e8400-e29b-41d4-a716-446655440000",
    fee_amount: 450,
    status: "enrolled",
    student: {
      first_name: "Alex",
      last_name: "Rivera",
      guardian_name: "Maria Rivera",
      email: null,
      phone: null,
      guardian_email: "maria@example.org",
      guardian_phone: null,
    },
    season_payments: [
      {
        id: "aa0e8400-e29b-41d4-a716-446655440000",
        payment_date: "2026-09-01",
        amount: 200,
        payment_method: "Check",
        notes: null,
      },
    ],
  },
];

describe("fetchSeasonReport", () => {
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockSupabase.mockChain().sequence([
      { data: seasonRow, error: null },
      { data: enrollmentRows, error: null },
    ]);
  });

  it("exposes the student's first and last name separately", async () => {
    const report = await fetchSeasonReport(mockSupabase as never, seasonId);

    expect(report).not.toBeNull();
    expect(report?.enrollments[0].studentFirstName).toBe("Alex");
    expect(report?.enrollments[0].studentLastName).toBe("Rivera");
  });

  it("still exposes the combined display name", async () => {
    const report = await fetchSeasonReport(mockSupabase as never, seasonId);
    expect(report?.enrollments[0].studentName).toBe("Rivera, Alex");
  });

  it("still computes the balance due", async () => {
    const report = await fetchSeasonReport(mockSupabase as never, seasonId);
    expect(report?.enrollments[0].totalPaid).toBe(200);
    expect(report?.enrollments[0].balanceDue).toBe(250);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/seasons/fetch-season-report.test.ts`
Expected: FAIL — `studentFirstName` is `undefined` (and TypeScript reports the property does not exist).

- [ ] **Step 3: Add the fields to the interface**

In `lib/seasons/types.ts`, add two properties to `SeasonReportEnrollment` immediately after `studentName`:

```ts
  studentFirstName: string;
  studentLastName: string;
```

- [ ] **Step 4: Populate them in the fetcher**

In `lib/seasons/fetch-season-report.ts`, inside the object returned from the `.map()`, add these two lines directly after `studentName`:

```ts
        studentFirstName: student.first_name,
        studentLastName: student.last_name,
```

The `select()` string already requests `first_name` and `last_name`, so no query change is needed.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/seasons/fetch-season-report.test.ts`
Expected: PASS

- [ ] **Step 6: Verify nothing else regressed**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds — the existing season Excel and PDF exports are unaffected.

- [ ] **Step 7: Commit**

```bash
git add lib/seasons/types.ts lib/seasons/fetch-season-report.ts \
        lib/seasons/fetch-season-report.test.ts
git commit -m "feat: expose student first and last name on season report

Letter placeholders need the name parts separately. Adding them at the source
is additive; splitting the joined 'Last, First' string at render time would be
the wrong fix.

<trailers>"
```

---

### Task 6: PDF letter batch generator

**Files:**
- Create: `lib/pdf/generate-letters.ts`
- Create: `lib/pdf/generate-letters.test.ts`

**Interfaces:**
- Consumes: `LetterBatchData`, `LetterRecipient`, `LetterDirector` from `lib/letters/types.ts`; `buildTokenValues`, `renderTemplate` from `lib/letters/render-template.ts`; `formatCurrency`, `formatDate` from `@/lib/utils`.
- Produces:
  - `buildSignatureLines(director: LetterDirector): string[]`
  - `splitParagraphs(text: string): string[]`
  - `buildLettersDocument(data: LetterBatchData): jsPDF`
  - `generateLettersPdf(data: LetterBatchData): Buffer`

`buildLettersDocument` is exported separately from `generateLettersPdf` so tests can assert page counts without parsing a binary.

- [ ] **Step 1: Write the failing tests**

Create `lib/pdf/generate-letters.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import {
  buildLettersDocument,
  buildSignatureLines,
  generateLettersPdf,
  splitParagraphs,
} from "./generate-letters";

import type { LetterBatchData, LetterRecipient } from "@/lib/letters/types";

function makeRecipient(
  overrides: Partial<LetterRecipient> = {}
): LetterRecipient {
  return {
    enrollmentId: "880e8400-e29b-41d4-a716-446655440000",
    studentFirstName: "Alex",
    studentLastName: "Rivera",
    guardianName: "Maria Rivera",
    feeAmount: 450,
    totalPaid: 200,
    balanceDue: 250,
    payments: [
      {
        payment_date: "2026-09-01",
        amount: 200,
        payment_method: "Check #1043",
      },
    ],
    ...overrides,
  };
}

function makeBatch(overrides: Partial<LetterBatchData> = {}): LetterBatchData {
  return {
    organizationName: "Acme Band Boosters",
    director: {
      name: "Jane Doe",
      title: "Band Director",
      email: "jane@band.org",
      phone: "555-0100",
    },
    seasonName: "Fall 2026",
    seasonStartDate: "2026-08-01",
    seasonEndDate: "2026-12-15",
    generatedOn: "2026-08-20",
    template: {
      heading: "Outstanding Balance Notice",
      body: "Dear {{guardian_name}},\n\n{{student_full_name}} owes {{balance_due}} for {{season_name}}.",
      closing: "Sincerely,",
    },
    recipients: [makeRecipient()],
    ...overrides,
  };
}

describe("splitParagraphs", () => {
  it("splits on blank lines", () => {
    expect(splitParagraphs("One\n\nTwo")).toEqual(["One", "Two"]);
  });

  it("keeps single newlines inside a paragraph", () => {
    expect(splitParagraphs("One\nstill one")).toEqual(["One\nstill one"]);
  });

  it("drops empty paragraphs from repeated blank lines", () => {
    expect(splitParagraphs("One\n\n\n\nTwo")).toEqual(["One", "Two"]);
  });

  it("returns an empty array for whitespace-only text", () => {
    expect(splitParagraphs("   \n\n  ")).toEqual([]);
  });
});

describe("buildSignatureLines", () => {
  it("returns all four lines when every field is set", () => {
    expect(
      buildSignatureLines({
        name: "Jane Doe",
        title: "Band Director",
        email: "jane@band.org",
        phone: "555-0100",
      })
    ).toEqual(["Jane Doe", "Band Director", "jane@band.org", "555-0100"]);
  });

  it("omits null fields instead of printing blank lines", () => {
    expect(
      buildSignatureLines({
        name: "Jane Doe",
        title: "Band Director",
        email: null,
        phone: null,
      })
    ).toEqual(["Jane Doe", "Band Director"]);
  });

  it("omits whitespace-only fields", () => {
    expect(
      buildSignatureLines({
        name: "Jane Doe",
        title: "   ",
        email: null,
        phone: null,
      })
    ).toEqual(["Jane Doe"]);
  });

  it("returns an empty array when no director is recorded", () => {
    expect(
      buildSignatureLines({ name: null, title: null, email: null, phone: null })
    ).toEqual([]);
  });
});

describe("buildLettersDocument", () => {
  it("produces one page per recipient", () => {
    const batch = makeBatch({
      recipients: [
        makeRecipient({ enrollmentId: "a" }),
        makeRecipient({ enrollmentId: "b" }),
        makeRecipient({ enrollmentId: "c" }),
      ],
    });
    expect(buildLettersDocument(batch).getNumberOfPages()).toBe(3);
  });

  it("produces a single page for a single recipient", () => {
    expect(buildLettersDocument(makeBatch()).getNumberOfPages()).toBe(1);
  });

  it("handles a recipient with no payments", () => {
    const batch = makeBatch({ recipients: [makeRecipient({ payments: [] })] });
    expect(buildLettersDocument(batch).getNumberOfPages()).toBe(1);
  });

  it("handles a blank heading", () => {
    const batch = makeBatch({
      template: { heading: null, body: "Short body.", closing: null },
    });
    expect(buildLettersDocument(batch).getNumberOfPages()).toBe(1);
  });

  it("handles a missing director without throwing", () => {
    const batch = makeBatch({
      director: { name: null, title: null, email: null, phone: null },
    });
    expect(() => buildLettersDocument(batch)).not.toThrow();
  });

  it("paginates a body too long for one page", () => {
    const batch = makeBatch({
      template: {
        heading: null,
        body: Array.from({ length: 60 }, (_, i) => `Paragraph ${i}.`).join("\n\n"),
        closing: "Sincerely,",
      },
    });
    expect(buildLettersDocument(batch).getNumberOfPages()).toBeGreaterThan(1);
  });

  it("still starts each recipient on a fresh page after an overflow", () => {
    const longBody = Array.from({ length: 60 }, (_, i) => `Paragraph ${i}.`).join(
      "\n\n"
    );
    const batch = makeBatch({
      template: { heading: null, body: longBody, closing: "Sincerely," },
      recipients: [
        makeRecipient({ enrollmentId: "a" }),
        makeRecipient({ enrollmentId: "b" }),
      ],
    });
    const single = buildLettersDocument({
      ...batch,
      recipients: [makeRecipient({ enrollmentId: "a" })],
    }).getNumberOfPages();
    expect(buildLettersDocument(batch).getNumberOfPages()).toBe(single * 2);
  });
});

describe("generateLettersPdf", () => {
  it("returns a non-empty Buffer", () => {
    const buffer = generateLettersPdf(makeBatch());
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("starts with PDF magic bytes", () => {
    const buffer = generateLettersPdf(makeBatch());
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/pdf/generate-letters.test.ts`
Expected: FAIL — "Failed to resolve import ./generate-letters".

- [ ] **Step 3: Implement the generator**

Create `lib/pdf/generate-letters.ts`:

```ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { buildTokenValues, renderTemplate } from "@/lib/letters/render-template";
import { formatCurrency, formatDate } from "@/lib/utils";

import type {
  LetterBatchData,
  LetterDirector,
  LetterRecipient,
} from "@/lib/letters/types";

const MARGIN = 56;
const BODY_FONT_SIZE = 11;
const LINE_HEIGHT = 15;
const PARAGRAPH_GAP = 9;
const HEADER_BG: [number, number, number] = [226, 232, 240];

function getFinalY(doc: jsPDF): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastTable = (doc as any).lastAutoTable;
  return lastTable?.finalY ?? MARGIN;
}

/** Adds a page when `needed` points would run past the bottom margin. */
function ensureSpace(doc: jsPDF, cursorY: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (cursorY + needed > pageHeight - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return cursorY;
}

/** Blank lines separate paragraphs; single newlines stay inside one. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** Signature lines, skipping fields the organization has not filled in. */
export function buildSignatureLines(director: LetterDirector): string[] {
  return [director.name, director.title, director.email, director.phone]
    .map((line) => line?.trim() ?? "")
    .filter((line) => line.length > 0);
}

function renderLetter(
  doc: jsPDF,
  data: LetterBatchData,
  recipient: LetterRecipient,
  contentWidth: number
): void {
  const values = buildTokenValues(data, recipient);
  let cursorY = MARGIN;

  // Letterhead: organization name left, generation date right.
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.organizationName, MARGIN, cursorY);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(data.generatedOn), MARGIN + contentWidth, cursorY, {
    align: "right",
  });
  cursorY += 28;

  const heading = data.template.heading
    ? renderTemplate(data.template.heading, values).trim()
    : "";
  if (heading) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(heading, MARGIN, cursorY);
    cursorY += 24;
  }

  doc.setFontSize(BODY_FONT_SIZE);
  doc.setFont("helvetica", "normal");
  for (const paragraph of splitParagraphs(
    renderTemplate(data.template.body, values)
  )) {
    const lines = doc.splitTextToSize(paragraph, contentWidth) as string[];
    for (const line of lines) {
      cursorY = ensureSpace(doc, cursorY, LINE_HEIGHT);
      doc.text(line, MARGIN, cursorY);
      cursorY += LINE_HEIGHT;
    }
    cursorY += PARAGRAPH_GAP;
  }

  // Balance summary — always printed, so the numbers are on the page even if
  // the template never used a currency placeholder.
  cursorY = ensureSpace(doc, cursorY, 96);
  autoTable(doc, {
    startY: cursorY,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 110, halign: "right" },
    },
    margin: { left: MARGIN, right: MARGIN },
    body: [
      ["Season Fee", formatCurrency(recipient.feeAmount)],
      ["Total Paid", formatCurrency(recipient.totalPaid)],
      ["Balance Due", formatCurrency(recipient.balanceDue)],
    ],
    didParseCell: (hook) => {
      if (hook.row.index === 2) {
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });
  cursorY = getFinalY(doc) + 28;

  cursorY = ensureSpace(doc, cursorY, 72);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Payments Received", MARGIN, cursorY);
  cursorY += 14;

  if (recipient.payments.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    cursorY += 8;
    doc.text("No payments received to date.", MARGIN, cursorY);
    cursorY += 28;
  } else {
    autoTable(doc, {
      startY: cursorY,
      head: [["Date", "Amount", "Method"]],
      body: recipient.payments.map((payment) => [
        formatDate(payment.payment_date),
        formatCurrency(payment.amount),
        payment.payment_method ?? "",
      ]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: HEADER_BG, textColor: 20, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN },
    });
    cursorY = getFinalY(doc) + 28;
  }

  const closing = data.template.closing
    ? renderTemplate(data.template.closing, values).trim()
    : "";
  const signatureLines = buildSignatureLines(data.director);
  const signatureHeight =
    (closing ? LINE_HEIGHT + 24 : 0) + signatureLines.length * LINE_HEIGHT;

  cursorY = ensureSpace(doc, cursorY, signatureHeight);
  doc.setFontSize(BODY_FONT_SIZE);
  doc.setFont("helvetica", "normal");

  if (closing) {
    doc.text(closing, MARGIN, cursorY);
    // Blank space for a handwritten signature.
    cursorY += LINE_HEIGHT + 24;
  }
  for (const line of signatureLines) {
    doc.text(line, MARGIN, cursorY);
    cursorY += LINE_HEIGHT;
  }
}

/**
 * Builds the batch document. Exported separately from `generateLettersPdf` so
 * tests can assert structure (page counts) without parsing binary output.
 *
 * Deliberately carries NO page numbers, unlike the season report: "Page 3 of
 * 40" on a letter handed to a student discloses the size of the list.
 */
export function buildLettersDocument(data: LetterBatchData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });
  const contentWidth = doc.internal.pageSize.getWidth() - MARGIN * 2;

  data.recipients.forEach((recipient, index) => {
    // Every recipient starts on a fresh page, so no page shows two families.
    if (index > 0) doc.addPage();
    renderLetter(doc, data, recipient, contentWidth);
  });

  return doc;
}

export function generateLettersPdf(data: LetterBatchData): Buffer {
  return Buffer.from(buildLettersDocument(data).output("arraybuffer"));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/pdf/generate-letters.test.ts`
Expected: PASS. If the overflow test does not exceed one page, raise the paragraph count in that test rather than shrinking the margins.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/pdf/generate-letters.ts lib/pdf/generate-letters.test.ts
git commit -m "feat: add PDF generator for balance letters

Portrait, one letter per page, with an always-printed balance block and
payment history. No page numbers by design: a page count on a letter handed
to a student would disclose how many families are behind.

<trailers>"
```

---

### Task 7: Letter template Server Actions

**Files:**
- Create: `app/(dashboard)/organizations/[orgId]/letter-templates/actions.ts`
- Create: `app/(dashboard)/organizations/[orgId]/letter-templates/actions.test.ts`

**Interfaces:**
- Consumes: `createLetterTemplateSchema`, `updateLetterTemplateSchema`, `letterTemplateIdSchema` (Task 3); `Tables<"letter_templates">` (Task 2).
- Produces four Server Actions, each `(_prevState: { error: string } | null, formData: FormData) => Promise<{ error: string } | undefined>`:
  - `createLetterTemplate`, `updateLetterTemplate`, `deleteLetterTemplate`, `setDefaultLetterTemplate`

- [ ] **Step 1: Write the failing tests**

Create `app/(dashboard)/organizations/[orgId]/letter-templates/actions.test.ts`:

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
import {
  createLetterTemplate,
  updateLetterTemplate,
  deleteLetterTemplate,
  setDefaultLetterTemplate,
} from "./actions";

const mockedCreateClient = vi.mocked(createClient);
const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";
const templateId = "770e8400-e29b-41d4-a716-446655440000";

describe("letter template actions", () => {
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
    for (const [key, val] of Object.entries(data)) {
      fd.set(key, val);
    }
    return fd;
  }

  function validCreateData(overrides: Record<string, string> = {}) {
    return makeFormData({
      organization_id: orgId,
      name: "First Notice",
      heading: "Outstanding Balance Notice",
      body: "Dear {{guardian_name}}, you owe {{balance_due}}.",
      closing: "Sincerely,",
      is_default: "false",
      ...overrides,
    });
  }

  describe("createLetterTemplate", () => {
    it("returns a validation error for an empty name", async () => {
      const result = await createLetterTemplate(null, validCreateData({ name: "" }));
      expect(result?.error).toBeDefined();
    });

    it("returns a validation error for an unknown placeholder", async () => {
      const result = await createLetterTemplate(
        null,
        validCreateData({ body: "You owe {{ballance_due}}." })
      );
      expect(result?.error).toContain("{{ballance_due}}");
    });

    it("returns an error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const result = await createLetterTemplate(null, validCreateData());
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("returns an error when the organization is not found", async () => {
      mockSupabase.mockResult({ data: null, error: null });
      const result = await createLetterTemplate(null, validCreateData());
      expect(result).toEqual({ error: "Organization not found." });
    });

    it("redirects to the template list on success", async () => {
      mockSupabase.mockResult({ data: { id: orgId }, error: null });

      try {
        await createLetterTemplate(null, validCreateData());
        expect.unreachable("expected a redirect");
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }

      expect(mockRedirect).toHaveBeenCalledWith(
        `/organizations/${orgId}/letter-templates`
      );
    });

    it("reports a duplicate name clearly", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null },
        { data: null, error: { message: "duplicate key", code: "23505" } },
      ]);

      const result = await createLetterTemplate(null, validCreateData());
      expect(result?.error).toContain("already exists");
    });
  });

  describe("updateLetterTemplate", () => {
    it("requires a template id", async () => {
      const result = await updateLetterTemplate(null, validCreateData());
      expect(result?.error).toBeDefined();
    });

    it("redirects to the template list on success", async () => {
      mockSupabase.mockResult({ data: { id: orgId }, error: null });

      try {
        await updateLetterTemplate(null, validCreateData({ id: templateId }));
        expect.unreachable("expected a redirect");
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }

      expect(mockRedirect).toHaveBeenCalledWith(
        `/organizations/${orgId}/letter-templates`
      );
    });
  });

  describe("deleteLetterTemplate", () => {
    it("returns an error for a malformed id", async () => {
      const fd = makeFormData({ id: "nope", organization_id: orgId });
      const result = await deleteLetterTemplate(null, fd);
      expect(result?.error).toBeDefined();
    });

    it("returns an error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const fd = makeFormData({ id: templateId, organization_id: orgId });
      const result = await deleteLetterTemplate(null, fd);
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("revalidates the list after deleting", async () => {
      mockSupabase.mockResult({ data: null, error: null });
      const fd = makeFormData({ id: templateId, organization_id: orgId });

      try {
        await deleteLetterTemplate(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }

      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/organizations/${orgId}/letter-templates`
      );
    });
  });

  describe("setDefaultLetterTemplate", () => {
    it("returns an error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const fd = makeFormData({ id: templateId, organization_id: orgId });
      const result = await setDefaultLetterTemplate(null, fd);
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("clears the previous default before setting the new one", async () => {
      mockSupabase.mockResult({ data: null, error: null });
      const fd = makeFormData({ id: templateId, organization_id: orgId });

      await setDefaultLetterTemplate(null, fd);

      // Two writes: one clearing the old default, one setting the new one.
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
      expect(mockSupabase.from).toHaveBeenCalledWith("letter_templates");
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(dashboard)/organizations/[orgId]/letter-templates/actions.test.ts"`
Expected: FAIL — "Failed to resolve import ./actions".

- [ ] **Step 3: Implement the actions**

Create `app/(dashboard)/organizations/[orgId]/letter-templates/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createLetterTemplateSchema,
  updateLetterTemplateSchema,
  letterTemplateIdSchema,
} from "@/lib/validations/letter-template";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const DUPLICATE_NAME_CODE = "23505";

function listPath(orgId: string): string {
  return `/organizations/${orgId}/letter-templates`;
}

/**
 * Clears the organization's current default. The partial unique index allows
 * only one default per org, so the old one must be cleared before the new one
 * is written.
 */
async function clearDefault(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  exceptId?: string
): Promise<void> {
  let query = supabase
    .from("letter_templates")
    .update({ is_default: false })
    .eq("organization_id", organizationId)
    .eq("is_default", true);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  await query;
}

export async function createLetterTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    heading: (formData.get("heading") as string) ?? "",
    body: formData.get("body") as string,
    closing: (formData.get("closing") as string) ?? "",
    is_default: formData.get("is_default") as string,
  };

  const parsed = createLetterTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", parsed.data.organization_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  if (parsed.data.is_default) {
    await clearDefault(supabase, parsed.data.organization_id);
  }

  const { error } = await supabase.from("letter_templates").insert({
    organization_id: parsed.data.organization_id,
    name: parsed.data.name,
    heading: parsed.data.heading || null,
    body: parsed.data.body,
    closing: parsed.data.closing || null,
    is_default: parsed.data.is_default,
  });

  if (error) {
    if (error.code === DUPLICATE_NAME_CODE) {
      return { error: "A template with that name already exists." };
    }
    return { error: "Failed to create letter template. Please try again." };
  }

  revalidatePath(listPath(parsed.data.organization_id));
  redirect(listPath(parsed.data.organization_id));
}

export async function updateLetterTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    heading: (formData.get("heading") as string) ?? "",
    body: formData.get("body") as string,
    closing: (formData.get("closing") as string) ?? "",
    is_default: formData.get("is_default") as string,
  };

  const parsed = updateLetterTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (parsed.data.is_default) {
    await clearDefault(supabase, parsed.data.organization_id, parsed.data.id);
  }

  const { error } = await supabase
    .from("letter_templates")
    .update({
      name: parsed.data.name,
      heading: parsed.data.heading || null,
      body: parsed.data.body,
      closing: parsed.data.closing || null,
      is_default: parsed.data.is_default,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    if (error.code === DUPLICATE_NAME_CODE) {
      return { error: "A template with that name already exists." };
    }
    return { error: "Failed to update letter template. Please try again." };
  }

  revalidatePath(listPath(parsed.data.organization_id));
  redirect(listPath(parsed.data.organization_id));
}

export async function deleteLetterTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = letterTemplateIdSchema.safeParse({
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("letter_templates")
    .delete()
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    return { error: "Failed to delete letter template. Please try again." };
  }

  revalidatePath(listPath(parsed.data.organization_id));
  redirect(listPath(parsed.data.organization_id));
}

export async function setDefaultLetterTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = letterTemplateIdSchema.safeParse({
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  await clearDefault(supabase, parsed.data.organization_id, parsed.data.id);

  const { error } = await supabase
    .from("letter_templates")
    .update({ is_default: true })
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    return { error: "Failed to set the default template. Please try again." };
  }

  revalidatePath(listPath(parsed.data.organization_id));
}
```

`setDefaultLetterTemplate` intentionally does not redirect — it is triggered from the list page and only needs a revalidate.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/(dashboard)/organizations/[orgId]/letter-templates/actions.test.ts"`
Expected: PASS

- [ ] **Step 5: Run lint and build**

Run: `npm run lint && npm run build`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/organizations/[orgId]/letter-templates/actions.ts" \
        "app/(dashboard)/organizations/[orgId]/letter-templates/actions.test.ts"
git commit -m "feat: add letter template CRUD server actions

Setting a default clears the previous one in the same action; the partial
unique index would otherwise reject the write.

<trailers>"
```

---

### Task 8: Letter template pages, form, and navigation

**Files:**
- Create: `app/(dashboard)/organizations/[orgId]/letter-templates/letter-template-form.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/letter-templates/template-actions.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/letter-templates/page.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/letter-templates/new/page.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/letter-templates/[templateId]/edit/page.tsx`
- Modify: `components/layout/sidebar.tsx:14-19` (icon import) and `:44-47` (`seasonNavItems`)

**Interfaces:**
- Consumes: the four Server Actions from Task 7; `LETTER_PLACEHOLDERS` (Task 3); `renderTemplate` and `SAMPLE_TOKEN_VALUES` (Task 4); `Tables<"letter_templates">` (Task 2).
- Produces: `LetterTemplateForm` and `TemplateActions` client components; the `/organizations/[orgId]/letter-templates` route.

- [ ] **Step 1: Build the shared form component**

Create `app/(dashboard)/organizations/[orgId]/letter-templates/letter-template-form.tsx`:

```tsx
"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { LETTER_PLACEHOLDERS } from "@/lib/letters/placeholders";
import { renderTemplate } from "@/lib/letters/render-template";
import { SAMPLE_TOKEN_VALUES } from "@/lib/letters/sample-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { createLetterTemplate, updateLetterTemplate } from "./actions";

interface LetterTemplateDefaults {
  id: string;
  name: string;
  heading: string | null;
  body: string;
  closing: string | null;
  is_default: boolean;
}

const DEFAULT_CLOSING = "Sincerely,";

const STARTER_BODY = `Dear {{guardian_name}},

Our records show an outstanding balance of {{balance_due}} for {{student_full_name}} for the {{season_name}} season.

Please contact {{director_name}} at {{director_email}} with any questions.

Thank you for your support.`;

export function LetterTemplateForm({
  mode,
  orgId,
  defaultValues,
}: Readonly<{
  mode: "create" | "edit";
  orgId: string;
  defaultValues?: LetterTemplateDefaults;
}>) {
  const action =
    mode === "create" ? createLetterTemplate : updateLetterTemplate;
  const [state, formAction, pending] = useActionState(action, null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [heading, setHeading] = useState(defaultValues?.heading ?? "");
  const [body, setBody] = useState(
    defaultValues?.body ?? (mode === "create" ? STARTER_BODY : "")
  );
  const [closing, setClosing] = useState(
    defaultValues?.closing ?? (mode === "create" ? DEFAULT_CLOSING : "")
  );
  const [isDefault, setIsDefault] = useState(
    defaultValues?.is_default ?? false
  );

  function insertPlaceholder(token: string): void {
    const snippet = `{{${token}}}`;
    const textarea = bodyRef.current;

    if (!textarea) {
      setBody((current) => current + snippet);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setBody((current) => current.slice(0, start) + snippet + current.slice(end));

    // Restore the caret after React re-renders with the new value.
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + snippet.length;
      textarea.setSelectionRange(caret, caret);
    });
  }

  const previewHeading = renderTemplate(heading, SAMPLE_TOKEN_VALUES).trim();
  const previewBody = renderTemplate(body, SAMPLE_TOKEN_VALUES);
  const previewClosing = renderTemplate(closing, SAMPLE_TOKEN_VALUES).trim();

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="self-start" asChild>
        <Link href={`/organizations/${orgId}/letter-templates`}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to templates
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organization_id" value={orgId} />
          {mode === "edit" && defaultValues && (
            <input type="hidden" name="id" value={defaultValues.id} />
          )}
          <input
            type="hidden"
            name="is_default"
            value={isDefault ? "true" : "false"}
          />

          {state?.error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              name="name"
              required
              maxLength={100}
              defaultValue={defaultValues?.name ?? ""}
              placeholder="First Notice"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-heading">Heading (optional)</Label>
            <Input
              id="template-heading"
              name="heading"
              maxLength={150}
              value={heading}
              onChange={(event) => setHeading(event.target.value)}
              placeholder="Outstanding Balance Notice"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-body">Letter Body</Label>
            <Textarea
              id="template-body"
              name="body"
              ref={bodyRef}
              required
              maxLength={5000}
              rows={14}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground">
              Leave a blank line between paragraphs. Include your greeting here,
              for example &ldquo;Dear &#123;&#123;guardian_name&#125;&#125;,&rdquo;.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Insert a placeholder</Label>
            <div className="flex flex-wrap gap-1.5">
              {LETTER_PLACEHOLDERS.map((placeholder) => (
                <Button
                  key={placeholder.token}
                  type="button"
                  variant="outline"
                  size="sm"
                  title={placeholder.description}
                  onClick={() => insertPlaceholder(placeholder.token)}
                >
                  {placeholder.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-closing">Closing (optional)</Label>
            <Input
              id="template-closing"
              name="closing"
              maxLength={300}
              value={closing}
              onChange={(event) => setClosing(event.target.value)}
              placeholder="Sincerely,"
            />
            <p className="text-sm text-muted-foreground">
              The director&rsquo;s name and title are printed below this
              automatically, from your organization settings.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="template-default"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="template-default">Make this the default</Label>
              <p className="text-sm text-muted-foreground">
                Pre-selected when you generate letters for a season.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : mode === "create"
                  ? "Create Template"
                  : "Save Changes"}
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/organizations/${orgId}/letter-templates`}>
                Cancel
              </Link>
            </Button>
          </div>
        </form>

        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Rendered with sample data. Real letters use each student&rsquo;s
              own numbers.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <p className="text-base font-semibold">Your Organization</p>

            {previewHeading && (
              <p className="font-semibold">{previewHeading}</p>
            )}

            <div className="whitespace-pre-wrap">{previewBody}</div>

            <div className="rounded-md border border-border p-3">
              <div className="flex justify-between">
                <span>Season Fee</span>
                <span className="tabular-nums">$450.00</span>
              </div>
              <div className="flex justify-between">
                <span>Total Paid</span>
                <span className="tabular-nums">$200.00</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Balance Due</span>
                <span className="tabular-nums">$250.00</span>
              </div>
            </div>

            {previewClosing && <p>{previewClosing}</p>}

            <div className="text-muted-foreground">
              <p>Jane Doe</p>
              <p>Band Director</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build the row actions component**

Create `app/(dashboard)/organizations/[orgId]/letter-templates/template-actions.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";

import { deleteLetterTemplate, setDefaultLetterTemplate } from "./actions";

export function TemplateActions({
  templateId,
  orgId,
  isDefault,
}: Readonly<{
  templateId: string;
  orgId: string;
  isDefault: boolean;
}>) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [defaultState, defaultAction, defaultPending] = useActionState(
    setDefaultLetterTemplate,
    null
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteLetterTemplate,
    null
  );

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!isDefault && (
        <form action={defaultAction}>
          <input type="hidden" name="id" value={templateId} />
          <input type="hidden" name="organization_id" value={orgId} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={defaultPending}
          >
            {defaultPending ? "Setting…" : "Make Default"}
          </Button>
        </form>
      )}

      {isConfirmingDelete ? (
        <>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={templateId} />
            <input type="hidden" name="organization_id" value={orgId} />
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={deletePending}
            >
              {deletePending ? "Deleting…" : "Confirm Delete"}
            </Button>
          </form>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConfirmingDelete(false)}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsConfirmingDelete(true)}
        >
          Delete
        </Button>
      )}

      {(defaultState?.error || deleteState?.error) && (
        <span className="text-sm text-destructive">
          {defaultState?.error ?? deleteState?.error}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build the list page**

Create `app/(dashboard)/organizations/[orgId]/letter-templates/page.tsx`:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Mail } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

import { TemplateActions } from "./template-actions";

export default async function LetterTemplatesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled, director_name")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled) redirect(`/organizations/${orgId}`);

  const { data: templates } = await supabase
    .from("letter_templates")
    .select("*")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  const rows = templates ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Letter Templates"
        description="Reusable letters for families with an outstanding season balance."
      >
        <Button asChild>
          <Link href={`/organizations/${orgId}/letter-templates/new`}>
            New Template
          </Link>
        </Button>
      </PageHeader>

      {!org.director_name && (
        <div className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          No director is recorded for this organization, so letters will be
          unsigned.{" "}
          <Link href={`/organizations/${orgId}`} className="underline">
            Add one in organization settings
          </Link>
          .
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No letter templates yet"
          description='Create a template to generate balance letters for a season.'
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Heading</th>
                <th className="px-4 py-2 text-left font-medium">Updated</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((template) => (
                <tr key={template.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link
                      href={`/organizations/${orgId}/letter-templates/${template.id}/edit`}
                      className="font-medium hover:underline"
                    >
                      {template.name}
                    </Link>
                    {template.is_default && (
                      <Badge variant="default" className="ml-2">
                        Default
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {template.heading ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {template.updated_at
                      ? formatDateTime(template.updated_at)
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <TemplateActions
                      templateId={template.id}
                      orgId={orgId}
                      isDefault={template.is_default}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Build the create and edit pages**

Create `app/(dashboard)/organizations/[orgId]/letter-templates/new/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";

import { LetterTemplateForm } from "../letter-template-form";

export default async function NewLetterTemplatePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled) redirect(`/organizations/${orgId}`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New Letter Template"
        description="Write the letter once, then generate it for every family who owes."
      />
      <LetterTemplateForm mode="create" orgId={orgId} />
    </div>
  );
}
```

Create `app/(dashboard)/organizations/[orgId]/letter-templates/[templateId]/edit/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";

import { LetterTemplateForm } from "../../letter-template-form";

export default async function EditLetterTemplatePage({
  params,
}: {
  params: Promise<{ orgId: string; templateId: string }>;
}) {
  const { orgId, templateId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled) redirect(`/organizations/${orgId}`);

  const { data: template } = await supabase
    .from("letter_templates")
    .select("*")
    .eq("id", templateId)
    .eq("organization_id", orgId)
    .single();

  if (!template) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Edit Letter Template" description={template.name} />
      <LetterTemplateForm
        mode="edit"
        orgId={orgId}
        defaultValues={{
          id: template.id,
          name: template.name,
          heading: template.heading,
          body: template.body,
          closing: template.closing,
          is_default: template.is_default,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Add the sidebar entry**

In `components/layout/sidebar.tsx`, add `Mail` to the existing `lucide-react` import block, then extend `seasonNavItems`:

```tsx
const seasonNavItems = [
  { label: "Seasons", href: "/seasons", icon: Calendar, exact: false },
  { label: "Students", href: "/students", icon: Users, exact: false },
  { label: "Letters", href: "/letter-templates", icon: Mail, exact: false },
];
```

Because `seasonNavItems` is only spread in when `seasonsEnabled` is true, the entry is gated automatically.

- [ ] **Step 6: Verify lint, tests, and build**

Run: `npm run lint && npm test && npm run build`
Expected: all clean.

- [ ] **Step 7: Manually verify the flow**

Run: `npm run dev`, then in the browser:
1. Open an organization with season tracking enabled; confirm "Letters" appears in the sidebar.
2. Create a template; confirm the preview updates as you type and placeholder buttons insert at the caret.
3. Save with a deliberate typo like `{{ballance_due}}`; confirm the form shows "Unknown placeholder: {{ballance_due}}".
4. Mark a second template default; confirm the badge moves and only one row shows it.
5. Delete a template; confirm the confirm-then-delete flow works.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/organizations/[orgId]/letter-templates" components/layout/sidebar.tsx
git commit -m "feat: add letter template management UI

Template list, create, and edit pages with a click-to-insert placeholder
palette and a live preview driven by the real renderer, so wording can be
checked without generating a PDF.

<trailers>"
```

---

### Task 9: Letters PDF API route

**Files:**
- Create: `app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.ts`
- Create: `app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.test.ts`

**Interfaces:**
- Consumes: `fetchSeasonReport` (Task 5 fields), `generateLettersPdf` (Task 6), `LetterBatchData` / `LetterRecipient` (Task 4).
- Produces: `POST(request: Request, { params }: { params: Promise<{ orgId: string; seasonId: string }> })` accepting `{ template_id: string; enrollment_ids: string[] }` and returning `application/pdf`.

- [ ] **Step 1: Write the failing tests**

Create `app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";

import type { MockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/seasons/fetch-season-report", () => ({
  fetchSeasonReport: vi.fn(),
}));
vi.mock("@/lib/pdf/generate-letters", () => ({
  generateLettersPdf: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { fetchSeasonReport } from "@/lib/seasons/fetch-season-report";
import { generateLettersPdf } from "@/lib/pdf/generate-letters";
import { POST } from "./route";

import type { SeasonReportData } from "@/lib/seasons/types";
import type { LetterBatchData } from "@/lib/letters/types";

const mockedCreateClient = vi.mocked(createClient);
const mockedFetchSeasonReport = vi.mocked(fetchSeasonReport);
const mockedGenerateLettersPdf = vi.mocked(generateLettersPdf);

const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";
const seasonId = "990e8400-e29b-41d4-a716-446655440000";
const templateId = "770e8400-e29b-41d4-a716-446655440000";
const owingId = "880e8400-e29b-41d4-a716-446655440001";
const paidId = "880e8400-e29b-41d4-a716-446655440002";
const withdrawnId = "880e8400-e29b-41d4-a716-446655440003";
const foreignId = "880e8400-e29b-41d4-a716-446655440009";

const orgRow = {
  id: orgId,
  name: "Acme Band Boosters",
  seasons_enabled: true,
  director_name: "Jane Doe",
  director_title: "Band Director",
  director_email: "jane@band.org",
  director_phone: "555-0100",
};

const templateRow = {
  id: templateId,
  heading: "Outstanding Balance Notice",
  body: "Dear {{guardian_name}}, you owe {{balance_due}}.",
  closing: "Sincerely,",
};

function makeEnrollment(
  id: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    studentName: "Rivera, Alex",
    studentFirstName: "Alex",
    studentLastName: "Rivera",
    guardianName: "Maria Rivera",
    contactEmail: null,
    contactPhone: null,
    feeAmount: 450,
    totalPaid: 200,
    balanceDue: 250,
    paymentStatus: "partial",
    enrollmentStatus: "enrolled",
    payments: [],
    ...overrides,
  };
}

const reportData = {
  organizationName: "Acme Band Boosters",
  seasonName: "Fall 2026",
  seasonDescription: null,
  startDate: "2026-08-01",
  endDate: "2026-12-15",
  feeAmount: 450,
  status: "active",
  generatedAt: "2026-08-20T10:00:00Z",
  summary: {
    totalEnrolled: 3,
    totalFeesExpected: 1350,
    totalCollected: 1100,
    totalOutstanding: 250,
    collectionRate: 81.5,
  },
  enrollments: [
    makeEnrollment(owingId),
    makeEnrollment(paidId, { totalPaid: 450, balanceDue: 0, paymentStatus: "paid" }),
    makeEnrollment(withdrawnId, { enrollmentStatus: "withdrawn" }),
  ],
} as unknown as SeasonReportData;

function makeRequest(body: unknown): Request {
  return new Request(
    `http://localhost/api/organizations/${orgId}/seasons/${seasonId}/letters`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

const routeParams = { params: Promise.resolve({ orgId, seasonId }) };

describe("POST /api/organizations/[orgId]/seasons/[seasonId]/letters", () => {
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockedCreateClient.mockResolvedValue(mockSupabase as never);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);
    mockedFetchSeasonReport.mockResolvedValue(reportData);
    mockedGenerateLettersPdf.mockReturnValue(Buffer.from("%PDF-1.4 fake"));
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    const response = await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when the organization is not found", async () => {
    mockSupabase.mockResult({ data: null, error: null });

    const response = await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when season tracking is disabled", async () => {
    mockSupabase.mockResult({
      data: { ...orgRow, seasons_enabled: false },
      error: null,
    });

    const response = await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 for a malformed body", async () => {
    mockSupabase.mockChain().sequence([{ data: orgRow, error: null }]);

    const response = await POST(
      makeRequest({ template_id: "not-a-uuid", enrollment_ids: [] }),
      routeParams
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when the template does not belong to the org", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: null, error: null },
    ]);

    const response = await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    expect(response.status).toBe(404);
  });

  it("returns a PDF for a valid request", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    const response = await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain(".pdf");
  });

  it("includes only the requested enrollment", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    const batch = mockedGenerateLettersPdf.mock.calls[0][0] as LetterBatchData;
    expect(batch.recipients).toHaveLength(1);
    expect(batch.recipients[0].enrollmentId).toBe(owingId);
  });

  it("drops ids that are not in this season", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    await POST(
      makeRequest({
        template_id: templateId,
        enrollment_ids: [owingId, foreignId],
      }),
      routeParams
    );

    const batch = mockedGenerateLettersPdf.mock.calls[0][0] as LetterBatchData;
    expect(batch.recipients.map((r) => r.enrollmentId)).toEqual([owingId]);
  });

  it("excludes withdrawn enrollments even when explicitly requested", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    const response = await POST(
      makeRequest({
        template_id: templateId,
        enrollment_ids: [withdrawnId],
      }),
      routeParams
    );

    expect(response.status).toBe(400);
  });

  it("excludes paid-up enrollments even when explicitly requested", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    const response = await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [paidId] }),
      routeParams
    );

    expect(response.status).toBe(400);
  });

  it("passes the organization's director onto the batch", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    const batch = mockedGenerateLettersPdf.mock.calls[0][0] as LetterBatchData;
    expect(batch.director.name).toBe("Jane Doe");
    expect(batch.director.title).toBe("Band Director");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.test.ts"`
Expected: FAIL — "Failed to resolve import ./route".

- [ ] **Step 3: Implement the route**

Create `app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { fetchSeasonReport } from "@/lib/seasons/fetch-season-report";
import { generateLettersPdf } from "@/lib/pdf/generate-letters";

import type { LetterBatchData, LetterRecipient } from "@/lib/letters/types";

const requestSchema = z.object({
  template_id: z.string().uuid(),
  enrollment_ids: z.array(z.string().uuid()).min(1),
});

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string; seasonId: string }> }
) {
  const { orgId, seasonId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "id, name, seasons_enabled, director_name, director_title, director_email, director_phone"
    )
    .eq("id", orgId)
    .single();

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  if (!org.seasons_enabled) {
    return NextResponse.json(
      { error: "Season tracking is not enabled" },
      { status: 404 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { data: template } = await supabase
    .from("letter_templates")
    .select("id, heading, body, closing")
    .eq("id", parsed.data.template_id)
    .eq("organization_id", orgId)
    .single();

  if (!template) {
    return NextResponse.json(
      { error: "Letter template not found" },
      { status: 404 }
    );
  }

  try {
    const report = await fetchSeasonReport(supabase, seasonId);
    if (!report) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    // The client can only narrow this set, never widen it: an id from another
    // season simply fails to match anything the season report returned.
    const requested = new Set(parsed.data.enrollment_ids);
    const recipients: LetterRecipient[] = report.enrollments
      .filter(
        (enrollment) =>
          requested.has(enrollment.id) &&
          enrollment.enrollmentStatus === "enrolled" &&
          enrollment.balanceDue > 0
      )
      .map((enrollment) => ({
        enrollmentId: enrollment.id,
        studentFirstName: enrollment.studentFirstName,
        studentLastName: enrollment.studentLastName,
        guardianName: enrollment.guardianName,
        feeAmount: enrollment.feeAmount,
        totalPaid: enrollment.totalPaid,
        balanceDue: enrollment.balanceDue,
        payments: enrollment.payments.map((payment) => ({
          payment_date: payment.payment_date,
          amount: payment.amount,
          payment_method: payment.payment_method,
        })),
      }));

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No eligible recipients selected" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    const batch: LetterBatchData = {
      organizationName: org.name,
      director: {
        name: org.director_name,
        title: org.director_title,
        email: org.director_email,
        phone: org.director_phone,
      },
      seasonName: report.seasonName,
      seasonStartDate: report.startDate,
      seasonEndDate: report.endDate,
      generatedOn: today,
      template: {
        heading: template.heading,
        body: template.body,
        closing: template.closing,
      },
      recipients,
    };

    const buffer = generateLettersPdf(batch);
    const filename = `${safeName(org.name)}_Letters_${safeName(report.seasonName)}_${today}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Season letters export error:", error);
    return NextResponse.json(
      { error: "Failed to generate letters" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/api/organizations/[orgId]/seasons/[seasonId]/letters/route.test.ts"`
Expected: PASS

- [ ] **Step 5: Run lint and build**

Run: `npm run lint && npm run build`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add "app/api/organizations/[orgId]/seasons/[seasonId]/letters"
git commit -m "feat: add letters PDF API route

POST rather than GET because a batch carries dozens of enrollment UUIDs.
Recipients are derived by filtering the season report, so client input can
only narrow the set — withdrawn and paid-up students are excluded server-side
regardless of what was submitted.

<trailers>"
```

---

### Task 10: Recipient selection page and season entry point

**Files:**
- Create: `app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/letters/page.tsx`
- Create: `app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/letters/generate-letters-form.tsx`
- Modify: `app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/page.tsx:250-262` (export button group)

**Interfaces:**
- Consumes: the API route from Task 9; `fetchSeasonReport` (Task 5); `Tables<"letter_templates">` (Task 2).
- Produces: the `/organizations/[orgId]/seasons/[seasonId]/letters` route. Terminal task — nothing consumes it.

- [ ] **Step 1: Build the selection form**

Create `app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/letters/generate-letters-form.tsx`:

```tsx
"use client";

import { useState } from "react";

import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LetterCandidate {
  enrollmentId: string;
  studentName: string;
  feeAmount: number;
  totalPaid: number;
  balanceDue: number;
}

interface TemplateOption {
  id: string;
  name: string;
}

function filenameFromResponse(response: Response): string | null {
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  return match ? match[1] : null;
}

export function GenerateLettersForm({
  orgId,
  seasonId,
  candidates,
  templates,
  defaultTemplateId,
}: Readonly<{
  orgId: string;
  seasonId: string;
  candidates: LetterCandidate[];
  templates: TemplateOption[];
  defaultTemplateId: string;
}>) {
  const [templateId, setTemplateId] = useState(defaultTemplateId);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.map((candidate) => candidate.enrollmentId))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = selected.size === candidates.length;

  function toggleOne(enrollmentId: string, checked: boolean): void {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(enrollmentId);
      } else {
        next.delete(enrollmentId);
      }
      return next;
    });
  }

  function toggleAll(checked: boolean): void {
    setSelected(
      checked
        ? new Set(candidates.map((candidate) => candidate.enrollmentId))
        : new Set()
    );
  }

  async function handleGenerate(): Promise<void> {
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch(
        `/api/organizations/${orgId}/seasons/${seasonId}/letters`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: templateId,
            enrollment_ids: Array.from(selected),
          }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "Failed to generate letters.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filenameFromResponse(response) ?? "letters.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to generate letters.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5 sm:max-w-sm">
        <Label htmlFor="letter-template">Letter Template</Label>
        <Select value={templateId} onValueChange={setTemplateId}>
          <SelectTrigger id="letter-template">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left">
                <Checkbox
                  aria-label="Select all recipients"
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                />
              </th>
              <th className="px-4 py-2 text-left font-medium">Student</th>
              <th className="px-4 py-2 text-right font-medium">Fee</th>
              <th className="px-4 py-2 text-right font-medium">Paid</th>
              <th className="px-4 py-2 text-right font-medium">Balance Due</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.enrollmentId} className="border-t border-border">
                <td className="px-4 py-2">
                  <Checkbox
                    aria-label={`Include ${candidate.studentName}`}
                    checked={selected.has(candidate.enrollmentId)}
                    onCheckedChange={(checked) =>
                      toggleOne(candidate.enrollmentId, checked === true)
                    }
                  />
                </td>
                <td className="px-4 py-2">{candidate.studentName}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatCurrency(candidate.feeAmount)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatCurrency(candidate.totalPaid)}
                </td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">
                  {formatCurrency(candidate.balanceDue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || selected.size === 0}
        >
          {isGenerating
            ? "Generating…"
            : `Generate ${selected.size} Letter${selected.size === 1 ? "" : "s"}`}
        </Button>
        <span className="text-sm text-muted-foreground">
          {selected.size} of {candidates.length} selected
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build the selection page**

Create `app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/letters/page.tsx`:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Mail } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { fetchSeasonReport } from "@/lib/seasons/fetch-season-report";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

import { GenerateLettersForm } from "./generate-letters-form";

export default async function GenerateLettersPage({
  params,
}: {
  params: Promise<{ orgId: string; seasonId: string }>;
}) {
  const { orgId, seasonId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled, director_name")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled) redirect(`/organizations/${orgId}`);

  const report = await fetchSeasonReport(supabase, seasonId);
  if (!report) notFound();

  const { data: templates } = await supabase
    .from("letter_templates")
    .select("id, name, is_default, updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false });

  const templateRows = templates ?? [];

  // Withdrawn students never receive a letter, even when they still owe.
  const candidates = report.enrollments
    .filter(
      (enrollment) =>
        enrollment.enrollmentStatus === "enrolled" && enrollment.balanceDue > 0
    )
    .map((enrollment) => ({
      enrollmentId: enrollment.id,
      studentName: enrollment.studentName,
      feeAmount: enrollment.feeAmount,
      totalPaid: enrollment.totalPaid,
      balanceDue: enrollment.balanceDue,
    }));

  // Prefer the marked default; otherwise the most recently updated template,
  // so the common case is still a single click.
  const defaultTemplateId =
    templateRows.find((template) => template.is_default)?.id ??
    templateRows[0]?.id ??
    "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Generate Letters"
        description={`${report.seasonName} — families with an outstanding balance`}
      />

      {!org.director_name && (
        <div className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          No director is recorded, so these letters will be unsigned.{" "}
          <Link href={`/organizations/${orgId}`} className="underline">
            Add one in organization settings
          </Link>
          .
        </div>
      )}

      {templateRows.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No letter templates yet"
          description="Create a template before generating letters for this season."
          action={{
            label: "New Template",
            href: `/organizations/${orgId}/letter-templates/new`,
          }}
        />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Everyone is paid up for this season"
          description="No enrolled student has an outstanding balance."
        />
      ) : (
        <GenerateLettersForm
          orgId={orgId}
          seasonId={seasonId}
          candidates={candidates}
          templates={templateRows.map((template) => ({
            id: template.id,
            name: template.name,
          }))}
          defaultTemplateId={defaultTemplateId}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the entry point to the season detail page**

In `app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/page.tsx`, add a third button inside the existing `<div className="flex gap-1">` export group, after the "Export PDF" button:

```tsx
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/organizations/${orgId}/seasons/${seasonId}/letters`}
                  >
                    Generate Letters
                  </Link>
                </Button>
```

`Link` is already imported in that file.

- [ ] **Step 4: Verify lint, tests, and build**

Run: `npm run lint && npm test && npm run build`
Expected: all clean.

- [ ] **Step 5: Manually verify the whole flow**

Run: `npm run dev`, then:
1. Open a season with at least one partially-paid student and one fully-paid student.
2. Click "Generate Letters"; confirm only students with a balance appear, all pre-checked, and that any withdrawn student is absent.
3. Uncheck one student; confirm the button count updates.
4. Click Generate; confirm a PDF downloads with one page per checked student, correct names and balances, the payment history table, and the director's signature block.
5. Uncheck everyone; confirm the button is disabled.
6. Clear the director fields in org settings and reload; confirm the amber warning appears and generation still works, with the signature block absent.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/letters" \
        "app/(dashboard)/organizations/[orgId]/seasons/[seasonId]/page.tsx"
git commit -m "feat: add letter generation flow to season detail

Recipient list is pre-checked with everyone who owes and excludes withdrawn
students; the treasurer can uncheck anyone already spoken with before
generating the batch PDF.

<trailers>"
```

---

## Final Verification

- [ ] **Run the full suite**

Run: `npm run lint && npm test && npm run build`
Expected: lint clean, all tests pass, build succeeds.

- [ ] **Confirm coverage of the new modules**

Run: `npm run test:coverage`
Expected: `lib/letters/`, `lib/pdf/generate-letters.ts`, `lib/validations/letter-template.ts`, the letter-template actions, and the letters route all appear with meaningful coverage.

- [ ] **Confirm the spec's decisions all hold**

Walk `docs/superpowers/specs/2026-08-20-student-balance-letters-design.md` and verify against the running app: no email sending, no mailing addresses, no letter history table, plain-text templates only, withdrawn students excluded, one default per org, no page numbers on letters.

- [ ] **Open a pull request**

```bash
git push -u origin feat/student-balance-letters
gh pr create --title "feat: generate balance letters for students who owe" \
  --body "Implements docs/superpowers/specs/2026-08-20-student-balance-letters-design.md

Adds an org-scoped letter template library and a season-scoped flow that
generates a printable PDF with one letter per student who still owes fees.

- Director contact fields on organizations, printed as the signature block
- letter_templates table with RLS and one-default-per-org enforcement
- Validated placeholder vocabulary; unknown tokens fail at save time
- Portrait PDF, one letter per page, with balance summary and payment history
- Withdrawn and paid-up students are excluded server-side

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_0138VP7cPEaRj2CuAKSSAi7a"
```
