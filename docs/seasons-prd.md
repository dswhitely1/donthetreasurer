# Season & Student Tracking - Product Requirements Document

> **Version:** 1.1
> **Status:** Draft
> **Last Updated:** February 3, 2026
> **Parent Document:** [PRD.md](./PRD.md) v1.4

---

## 1. Executive Summary

Add season-based student tracking to Treasurer, allowing treasurers to create seasons (e.g., "Spring Soccer 2026", "Fall Band 2026"), enroll students, and record fee payments. This feature is an operational tracking tool — it lives outside the core financial ledger and does not create transactions, affect account balances, or appear in financial reports. A dedicated Season Report provides a standalone view of enrollment, payments collected, and outstanding balances.

The entire feature is gated behind an organization-level toggle (`seasons_enabled`). When disabled (the default), no Seasons or Students navigation items appear and the related routes are inaccessible. Treasurers enable the feature from their organization settings page.

---

## 2. Problem Statement

Many 501(c)(3) nonprofits run seasonal programs (sports leagues, music programs, youth camps) that charge participation fees. Treasurers need to track which students are enrolled, what fees are owed, and what payments have been received — often managing this in separate spreadsheets. While the actual income eventually appears in the organization's financial accounts, the per-student payment tracking is a distinct operational concern that doesn't fit the existing transaction model.

---

## 3. Goals and Objectives

### 3.1 Primary Goals

- Allow treasurers to define seasons with a name, date range, and standard fee amount
- Enroll students in seasons and track their individual payment status
- Record partial and full payments against a student's season fee
- Provide a standalone Season Report showing enrollment and payment status (not tied to financial reports)

### 3.2 Success Metrics

- Treasurer can create a season and enroll students in under 5 minutes
- Payment recording takes under 15 seconds per payment
- Season Report generates in under 5 seconds
- All payment tracking is self-contained — no impact on financial ledger

---

## 4. User Stories

| ID | Story | Priority |
|----|-------|----------|
| SEA-US-01 | As a treasurer, I want to create a season with a name, date range, and fee amount so I can define the program period and cost. | Must Have |
| SEA-US-02 | As a treasurer, I want to add students to my organization so I can enroll them in seasons. | Must Have |
| SEA-US-03 | As a treasurer, I want to enroll students in a season so I can track who is participating. | Must Have |
| SEA-US-04 | As a treasurer, I want to record payments a student makes toward their season fee so I can track who has paid. | Must Have |
| SEA-US-05 | As a treasurer, I want to see a report showing all students in a season with their fee, payments, and balance due so I can identify who still owes money. | Must Have |
| SEA-US-06 | As a treasurer, I want to override a student's fee for a specific season (e.g., scholarship, sibling discount) so I can handle exceptions. | Should Have |
| SEA-US-07 | As a treasurer, I want to export the Season Report to Excel so I can share it with board members or coaches. | Should Have |
| SEA-US-08 | As a treasurer, I want to export the Season Report to PDF so I can print or email it. | Should Have |
| SEA-US-09 | As a treasurer, I want to see a student's history across all seasons so I can review their participation and payment record. | Could Have |
| SEA-US-10 | As a treasurer, I want to archive a season once it's complete so it doesn't clutter my active view. | Should Have |

---

## 5. Functional Requirements

### 5.0 Feature Toggle

| ID | Requirement | Priority |
|----|-------------|----------|
| TOG-001 | The organizations table shall include a `seasons_enabled` boolean column (default: `false`) | Must Have |
| TOG-002 | Treasurer shall be able to enable or disable the Seasons feature from the organization settings page | Must Have |
| TOG-003 | When `seasons_enabled` is `false`, the "Seasons" and "Students" sidebar navigation items shall be hidden | Must Have |
| TOG-004 | When `seasons_enabled` is `false`, all `/seasons` and `/students` routes under that organization shall return a redirect to the organization overview page | Must Have |
| TOG-005 | When `seasons_enabled` is `false`, season-related API export routes shall return 404 | Must Have |
| TOG-006 | Enabling the feature shall not create any default data — the treasurer starts with an empty season/student list | Must Have |
| TOG-007 | Disabling the feature shall not delete existing season/student data — it only hides access. Re-enabling restores visibility of all previously created data. | Must Have |

### 5.1 Student Management

| ID | Requirement | Priority |
|----|-------------|----------|
| STU-001 | Treasurer shall be able to create students within an organization | Must Have |
| STU-002 | Each student shall have a first name, last name, and optional fields: email, phone, parent/guardian name, parent/guardian email, parent/guardian phone, and notes | Must Have |
| STU-003 | Students are scoped to an organization and reusable across seasons | Must Have |
| STU-004 | Treasurer shall be able to edit student information | Must Have |
| STU-005 | Treasurer shall be able to deactivate a student (soft delete via `is_active` flag) | Should Have |
| STU-006 | Students with enrollment history cannot be hard-deleted | Must Have |
| STU-007 | Student list shall be searchable by name | Should Have |

### 5.2 Season Management

| ID | Requirement | Priority |
|----|-------------|----------|
| SEA-001 | Treasurer shall be able to create a season with a name, start date, end date, and fee amount | Must Have |
| SEA-002 | Season date ranges shall be validated: start date must be before end date | Must Have |
| SEA-003 | Fee amount shall be a positive decimal value (or zero for free seasons) | Must Have |
| SEA-004 | Each season shall have a status: `active` or `archived` | Should Have |
| SEA-005 | Treasurer shall be able to edit a season's name, dates, fee, and status | Must Have |
| SEA-006 | Treasurer shall be able to delete a season only if it has no enrollments | Must Have |
| SEA-007 | Seasons with enrollments can be archived but not deleted | Must Have |
| SEA-008 | Season list shall display enrollment count and total payments collected | Should Have |
| SEA-009 | Each season shall have an optional description/notes field | Should Have |

### 5.3 Enrollment Management

| ID | Requirement | Priority |
|----|-------------|----------|
| ENR-001 | Treasurer shall be able to enroll one or more students in a season | Must Have |
| ENR-002 | Each enrollment shall default to the season's fee amount but allow a per-student override | Should Have |
| ENR-003 | Enrollment fee override shall include an optional reason field (e.g., "Sibling discount", "Scholarship") | Should Have |
| ENR-004 | A student may be enrolled in multiple seasons simultaneously | Must Have |
| ENR-005 | A student cannot be enrolled in the same season more than once | Must Have |
| ENR-006 | Treasurer shall be able to remove an enrollment only if no payments have been recorded against it | Must Have |
| ENR-007 | Enrollments with payments can be marked as withdrawn but not deleted | Should Have |
| ENR-008 | Each enrollment shall track a computed payment status: `unpaid`, `partial`, `paid`, `overpaid` | Must Have |

#### 5.3.1 Payment Status Definitions

| Status | Definition |
|--------|------------|
| **Unpaid** | No payments have been recorded; full fee is outstanding |
| **Partial** | Some payment has been received but total payments are less than the fee |
| **Paid** | Total payments equal the fee amount |
| **Overpaid** | Total payments exceed the fee amount (e.g., accidental overpayment) |

### 5.4 Payment Recording

| ID | Requirement | Priority |
|----|-------------|----------|
| PAY-001 | Treasurer shall be able to record a payment against a student's enrollment | Must Have |
| PAY-002 | Each payment shall have a date, amount, and optional payment method and notes | Must Have |
| PAY-003 | Payment amount shall be a positive decimal value | Must Have |
| PAY-004 | Multiple payments may be recorded per enrollment (supporting payment plans) | Must Have |
| PAY-005 | Treasurer shall be able to edit a payment's date, amount, method, and notes | Must Have |
| PAY-006 | Treasurer shall be able to delete a payment (with confirmation) | Must Have |
| PAY-007 | Payment method shall be a free-text field (e.g., "Cash", "Check #1234", "Venmo", "PayPal") | Must Have |
| PAY-008 | After recording a payment, the enrollment's payment status shall automatically update | Must Have |

### 5.5 Season Report

| ID | Requirement | Priority |
|----|-------------|----------|
| SRP-001 | System shall provide a Season Report view for each season | Must Have |
| SRP-002 | Season Report is a standalone report, separate from the financial transaction reports | Must Have |
| SRP-003 | Season Report shall display: student name, fee amount, total paid, balance due, payment status, and payment history | Must Have |
| SRP-004 | Season Report shall show summary totals: total enrolled, total fees expected, total collected, total outstanding | Must Have |
| SRP-005 | Season Report shall be sortable by student name, payment status, or balance due | Should Have |
| SRP-006 | Season Report shall be filterable by payment status (unpaid, partial, paid, overpaid) | Should Have |
| SRP-007 | Season Report shall be exportable to Excel (.xlsx) | Should Have |
| SRP-008 | Season Report shall be exportable to PDF | Should Have |

---

## 6. Data Model

### 6.1 Entity Relationships

```
Organization (1) ── defines ──> (Many) Students
Organization (1) ── defines ──> (Many) Seasons
Season (1) ─────── contains ──> (Many) Season Enrollments
Student (1) ────── has ────────> (Many) Season Enrollments
Season Enrollment (1) ── has ──> (Many) Season Payments
```

**Schema change to existing entity:**

```
Organization (existing table)
  + seasons_enabled: Boolean (default: false) — gates visibility of the entire Seasons feature
```

Integrated into the full domain model:

```
Treasurer (1) → (Many) Organizations → (Many) Students
                                     → (Many) Seasons → (Many) Season Enrollments → (Many) Season Payments
                                     → (Many) Categories ← (existing)
                                     → (Many) Accounts   ← (existing)
                                     → (Many) Budgets     ← (existing)
```

### 6.2 Entity Definitions

#### Student

```
- id: UUID (primary key, default uuid_generate_v4())
- organization_id: UUID (foreign key → Organization, NOT NULL)
- first_name: String (required, max 100 characters)
- last_name: String (required, max 100 characters)
- email: String (optional, max 255 characters)
- phone: String (optional, max 30 characters)
- guardian_name: String (optional, max 200 characters)
- guardian_email: String (optional, max 255 characters)
- guardian_phone: String (optional, max 30 characters)
- notes: Text (optional)
- is_active: Boolean (default: true)
- created_at: Timestamp (default NOW())
- updated_at: Timestamp (default NOW())
```

#### Season

```
- id: UUID (primary key, default uuid_generate_v4())
- organization_id: UUID (foreign key → Organization, NOT NULL)
- name: String (required, max 150 characters)
- description: Text (optional)
- start_date: Date (required)
- end_date: Date (required)
- fee_amount: Decimal(12,2) (required, >= 0)
- status: Enum ['active', 'archived'] (default: 'active')
- created_at: Timestamp (default NOW())
- updated_at: Timestamp (default NOW())

CONSTRAINTS:
- start_date < end_date (CHECK constraint)
```

#### Season Enrollment

```
- id: UUID (primary key, default uuid_generate_v4())
- season_id: UUID (foreign key → Season, NOT NULL)
- student_id: UUID (foreign key → Student, NOT NULL)
- fee_amount: Decimal(12,2) (required, >= 0) — defaults to season fee, can be overridden
- fee_override_reason: String (optional, max 255 characters)
- status: Enum ['enrolled', 'withdrawn'] (default: 'enrolled')
- enrolled_at: Timestamp (default NOW())
- created_at: Timestamp (default NOW())
- updated_at: Timestamp (default NOW())

CONSTRAINTS:
- season_id + student_id must be unique (no duplicate enrollments)
```

#### Season Payment

```
- id: UUID (primary key, default uuid_generate_v4())
- enrollment_id: UUID (foreign key → Season Enrollment, NOT NULL, ON DELETE CASCADE)
- payment_date: Date (required)
- amount: Decimal(12,2) (required, > 0)
- payment_method: String (optional, max 100 characters)
- notes: Text (optional)
- created_at: Timestamp (default NOW())
- updated_at: Timestamp (default NOW())
```

### 6.3 Database Schema

```sql
-- Add feature toggle to existing organizations table
ALTER TABLE public.organizations
  ADD COLUMN seasons_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  guardian_name TEXT,
  guardian_email TEXT,
  guardian_phone TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seasons table
CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (fee_amount >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (start_date < end_date)
);

-- Season Enrollments table
CREATE TABLE public.season_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  fee_amount DECIMAL(12,2) NOT NULL CHECK (fee_amount >= 0),
  fee_override_reason TEXT,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'withdrawn')),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (season_id, student_id)
);

-- Season Payments table
CREATE TABLE public.season_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES public.season_enrollments(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_students_organization ON public.students(organization_id);
CREATE INDEX idx_students_name ON public.students(organization_id, last_name, first_name);
CREATE INDEX idx_seasons_organization ON public.seasons(organization_id);
CREATE INDEX idx_seasons_status ON public.seasons(organization_id, status);
CREATE INDEX idx_season_enrollments_season ON public.season_enrollments(season_id);
CREATE INDEX idx_season_enrollments_student ON public.season_enrollments(student_id);
CREATE INDEX idx_season_payments_enrollment ON public.season_payments(enrollment_id);
CREATE INDEX idx_season_payments_date ON public.season_payments(payment_date);

-- Row Level Security
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access students in their organizations" ON public.students
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access seasons in their organizations" ON public.seasons
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access enrollments in their seasons" ON public.season_enrollments
  FOR ALL USING (
    season_id IN (
      SELECT s.id FROM public.seasons s
      JOIN public.organizations o ON s.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access payments in their enrollments" ON public.season_payments
  FOR ALL USING (
    enrollment_id IN (
      SELECT se.id FROM public.season_enrollments se
      JOIN public.seasons s ON se.season_id = s.id
      JOIN public.organizations o ON s.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );

-- Updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.season_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.season_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 7. User Interface Requirements

### 7.1 Navigation

- **"Seasons"** and **"Students"** sidebar items are only rendered when the current organization's `seasons_enabled` is `true`
- Add **"Seasons"** to the sidebar navigation after "Budgets" (or after "Reports" if budgets are not yet implemented)
- Route: `/organizations/[orgId]/seasons`
- Add **"Students"** as a sub-navigation item under Seasons or as a sibling entry
- Route: `/organizations/[orgId]/students`

### 7.1.1 Organization Settings Toggle

On the organization settings/edit page, add a toggle (switch or checkbox):

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| Enable Season Tracking | Toggle / Switch | Off | "Track student enrollment and fee payments for seasonal programs" |

When toggled on, the Seasons and Students navigation items appear immediately. When toggled off, they are hidden (data is preserved).

### 7.2 Student List Page

**Route:** `/organizations/[orgId]/students`

**Layout:**
- Page title: "Students"
- "Add Student" action button
- Search bar for filtering by name
- Table of students

**Columns:**

| Column | Description |
|--------|-------------|
| Name | "Last, First" format (link to edit) |
| Guardian | Parent/guardian name |
| Email | Student or guardian email |
| Phone | Student or guardian phone |
| Seasons | Count of seasons enrolled in |
| Status | Active / Inactive badge |

**Empty state:** "No students yet. Add your first student to start tracking season enrollment."

### 7.3 Student Create / Edit Form

**Route:** `/organizations/[orgId]/students/new` and `/organizations/[orgId]/students/[studentId]/edit`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| First Name | Text input | Yes | Max 100 chars |
| Last Name | Text input | Yes | Max 100 chars |
| Email | Email input | No | Student's email |
| Phone | Text input | No | Student's phone |
| Guardian Name | Text input | No | Parent or guardian |
| Guardian Email | Email input | No | |
| Guardian Phone | Text input | No | |
| Notes | Textarea | No | General notes about the student |

### 7.4 Season List Page

**Route:** `/organizations/[orgId]/seasons`

**Layout:**
- Page title: "Seasons"
- "New Season" action button
- Toggle filter: Active / Archived / All
- List of seasons as cards or table rows

**Each season entry displays:**

| Field | Display |
|-------|---------|
| Name | Season name (link to detail page) |
| Date Range | "Jan 1, 2026 – May 31, 2026" |
| Fee | "$150.00" |
| Enrolled | Count of enrolled students |
| Collected | Total payments collected |
| Outstanding | Total still owed |
| Status | Active (green) / Archived (gray) badge |

**Sorting:** Active seasons first, then by start date descending.

**Empty state:** "No seasons yet. Create your first season to start tracking student enrollment and payments."

### 7.5 Season Create / Edit Form

**Route:** `/organizations/[orgId]/seasons/new` and `/organizations/[orgId]/seasons/[seasonId]/edit`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| Name | Text input | Yes | - | Max 150 chars. E.g., "Spring Soccer 2026" |
| Description | Textarea | No | - | |
| Start Date | Date picker | Yes | - | |
| End Date | Date picker | Yes | - | |
| Fee Amount | Currency input | Yes | 0.00 | Standard fee per student |
| Status | Select | Yes | Active | Active / Archived |

### 7.6 Season Detail Page

**Route:** `/organizations/[orgId]/seasons/[seasonId]`

This is the primary operational view for managing a season.

**Header:**
- Season name, date range, status badge
- Action buttons: Edit, Archive/Unarchive, Delete (if no enrollments)

**Summary Cards:**

| Card | Value |
|------|-------|
| Enrolled Students | Count of enrolled students |
| Total Fees Expected | Sum of all enrollment fee amounts |
| Total Collected | Sum of all payments |
| Total Outstanding | Expected - Collected |

**Enrollment Table:**

| Column | Description |
|--------|-------------|
| Student Name | "Last, First" (link to payment detail) |
| Fee | The student's fee for this season (shows override indicator if different from season fee) |
| Paid | Total payments received |
| Balance | Fee - Paid (negative if overpaid) |
| Status | Unpaid / Partial / Paid / Overpaid badge |
| Actions | Record Payment, View Payments, Remove/Withdraw |

**Actions:**
- "Enroll Students" button — opens a dialog/page to select students to add
- "Record Payment" inline action per student — opens a payment form
- "Export Report" — Excel or PDF export of the season report

**Enroll Students Dialog:**
- Multi-select list of active students not already enrolled in this season
- Option to override the fee for each student being enrolled
- "Enroll Selected" button

### 7.7 Payment Recording

**Inline or dialog-based form** (appears when clicking "Record Payment" on a student's enrollment):

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| Date | Date picker | Yes | Today | |
| Amount | Currency input | Yes | Remaining balance | Pre-filled with balance due |
| Payment Method | Text input | No | - | E.g., "Cash", "Check #1234" |
| Notes | Text input | No | - | |

**Payment History** (expandable per enrollment or on a detail view):

| Column | Description |
|--------|-------------|
| Date | Payment date |
| Amount | Payment amount |
| Method | Payment method |
| Notes | Payment notes |
| Actions | Edit, Delete |

---

## 8. Season Report

### 8.1 Report Content

The Season Report is a standalone report scoped to a single season. It is not connected to the financial transaction reports.

**Report Header:**
- Organization name
- Season name
- Date range
- Generated timestamp

**Summary Section:**
- Total enrolled students
- Total fees expected
- Total collected
- Total outstanding
- Collection rate (collected / expected × 100)

**Detail Section (per student):**

| Column | Description |
|--------|-------------|
| Student Name | "Last, First" |
| Guardian | Parent/guardian name |
| Contact | Email or phone |
| Fee | Enrollment fee amount |
| Total Paid | Sum of payments |
| Balance Due | Fee - Total Paid |
| Status | Unpaid / Partial / Paid / Overpaid |
| Payment Dates | Comma-separated list of payment dates |

### 8.2 Excel Export

**File naming:** `{OrganizationName}_Season_{SeasonName}_{date}.xlsx`

**Sheet 1: Season Summary**

```
Row 1: {Organization Name}
Row 2: Season Report: {Season Name}
Row 3: {Start Date} to {End Date}
Row 4: Generated: {Current Date/Time}
Row 5: [blank]
Row 6: Summary
Row 7: Total Enrolled:      {count}
Row 8: Total Fees Expected: ${amount}
Row 9: Total Collected:     ${amount}
Row 10: Total Outstanding:  ${amount}
Row 11: Collection Rate:    {percent}%
```

**Sheet 2: Enrollment Detail**

| Column | Header | Format | Width |
|--------|--------|--------|-------|
| A | Student Name | Text | 25 |
| B | Guardian | Text | 25 |
| C | Contact | Text | 25 |
| D | Fee | Currency ($#,##0.00) | 12 |
| E | Total Paid | Currency ($#,##0.00) | 12 |
| F | Balance Due | Currency ($#,##0.00) | 12 |
| G | Status | Text | 12 |

**Sheet 3: Payment Detail**

| Column | Header | Format | Width |
|--------|--------|--------|-------|
| A | Student Name | Text | 25 |
| B | Payment Date | Date (MM/DD/YYYY) | 15 |
| C | Amount | Currency ($#,##0.00) | 12 |
| D | Method | Text | 15 |
| E | Notes | Text | 30 |

### 8.3 PDF Export

Landscape PDF following the same pattern as existing PDF reports (jsPDF + jspdf-autotable). Contains the summary header and enrollment detail table. Payment detail is omitted from PDF to keep it concise (available in Excel).

---

## 9. Server Actions & API

### 9.1 Server Actions

Following the existing colocated pattern:

**Student actions:** `app/(dashboard)/organizations/[orgId]/students/actions.ts`

| Action | Input | Behavior |
|--------|-------|----------|
| `createStudent` | Student fields | Validates with Zod, inserts student, revalidates path |
| `updateStudent` | Student ID + fields | Validates, updates student, revalidates path |
| `deleteStudent` | Student ID | Checks for enrollments, deletes if none exist, revalidates path |
| `toggleStudentActive` | Student ID | Toggles `is_active` flag, revalidates path |

**Season actions:** `app/(dashboard)/organizations/[orgId]/seasons/actions.ts`

| Action | Input | Behavior |
|--------|-------|----------|
| `createSeason` | Season fields | Validates with Zod, inserts season, revalidates path, redirects to season detail |
| `updateSeason` | Season ID + fields | Validates, updates season, revalidates path |
| `deleteSeason` | Season ID | Checks for enrollments, deletes if none exist, revalidates path, redirects to season list |
| `archiveSeason` | Season ID | Sets status to `archived`, revalidates path |
| `enrollStudents` | Season ID + array of { student_id, fee_amount?, fee_override_reason? } | Validates, bulk inserts enrollments, revalidates path |
| `removeEnrollment` | Enrollment ID | Checks for payments, deletes if none exist, revalidates path |
| `withdrawEnrollment` | Enrollment ID | Sets enrollment status to `withdrawn`, revalidates path |
| `recordPayment` | Enrollment ID + payment fields | Validates with Zod, inserts payment, revalidates path |
| `updatePayment` | Payment ID + fields | Validates, updates payment, revalidates path |
| `deletePayment` | Payment ID | Deletes payment (with confirmation at UI level), revalidates path |

### 9.2 API Routes (Export Only)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/organizations/[orgId]/seasons/[seasonId]/export` | GET | Excel (.xlsx) export of season report |
| `/api/organizations/[orgId]/seasons/[seasonId]/export/pdf` | GET | PDF export of season report |

### 9.3 Zod Validation Schemas

**File:** `lib/validations/student.ts`

```
studentSchema:
  - first_name: string, 1-100 chars (required)
  - last_name: string, 1-100 chars (required)
  - email: email string (optional)
  - phone: string, max 30 chars (optional)
  - guardian_name: string, max 200 chars (optional)
  - guardian_email: email string (optional)
  - guardian_phone: string, max 30 chars (optional)
  - notes: string, max 2000 chars (optional)
```

**File:** `lib/validations/season.ts`

```
seasonSchema:
  - name: string, 1-150 chars (required)
  - description: string, max 2000 chars (optional)
  - start_date: YYYY-MM-DD string (required)
  - end_date: YYYY-MM-DD string (required)
  - fee_amount: non-negative number, max 2 decimal places (required)
  - status: enum ['active', 'archived'] (default: 'active')
  - Refinement: start_date < end_date

enrollmentSchema:
  - student_id: UUID (required)
  - fee_amount: non-negative number, max 2 decimal places (required)
  - fee_override_reason: string, max 255 chars (optional)

enrollStudentsSchema:
  - season_id: UUID (required)
  - enrollments: array of enrollmentSchema, min 1 item
  - Refinement: no duplicate student_ids

paymentSchema:
  - enrollment_id: UUID (required)
  - payment_date: YYYY-MM-DD string (required)
  - amount: positive number, max 2 decimal places (required)
  - payment_method: string, max 100 chars (optional)
  - notes: string, max 500 chars (optional)
```

---

## 10. TanStack Query Integration

### 10.1 Query Keys

Add to `hooks/query-keys.ts`:

```
students:
  - ['students', orgId] — list all students for an org

seasons:
  - ['seasons', orgId] — list all seasons for an org
  - ['seasons', orgId, seasonId] — single season with enrollments
  - ['seasons', orgId, seasonId, 'enrollments'] — enrollments with payment summaries
  - ['seasons', orgId, seasonId, 'report'] — full season report data
```

### 10.2 Hooks

**File:** `hooks/use-students.ts`

| Hook | Purpose |
|------|---------|
| `useStudents(orgId)` | Fetch all students for an organization |
| `useStudent(orgId, studentId)` | Fetch a single student |

**File:** `hooks/use-seasons.ts`

| Hook | Purpose |
|------|---------|
| `useSeasons(orgId)` | Fetch all seasons for an organization |
| `useSeason(orgId, seasonId)` | Fetch a single season with enrollment summary |
| `useSeasonEnrollments(orgId, seasonId)` | Fetch enrollments with payment totals |
| `useEnrollmentPayments(orgId, seasonId, enrollmentId)` | Fetch payments for a specific enrollment |

---

## 11. Route Structure

```
app/(dashboard)/organizations/[orgId]/students/
├── page.tsx                    # Student list
├── actions.ts                  # Server Actions for student CRUD
├── new/
│   └── page.tsx                # Create student form
└── [studentId]/
    └── edit/
        └── page.tsx            # Edit student form

app/(dashboard)/organizations/[orgId]/seasons/
├── page.tsx                    # Season list
├── actions.ts                  # Server Actions for season/enrollment/payment CRUD
├── new/
│   └── page.tsx                # Create season form
└── [seasonId]/
    ├── page.tsx                # Season detail (enrollments, payments, report view)
    └── edit/
        └── page.tsx            # Edit season form

app/api/organizations/[orgId]/seasons/[seasonId]/
├── export/
│   └── route.ts                # Excel export
└── export/pdf/
    └── route.ts                # PDF export
```

---

## 12. Permissions & Security

- **RLS policies** follow the existing ownership chain: Student/Season → Organization → Treasurer. Only the owning treasurer can access students and seasons for their organizations.
- **ON DELETE RESTRICT** on `season_enrollments.student_id` and `season_enrollments.season_id` prevents deleting a student or season that has enrollments.
- **ON DELETE CASCADE** from enrollments to payments: deleting an enrollment removes all its payments.
- All season data inherits the same `auth.uid()` validation pattern used by all other organization-scoped entities.

---

## 13. Edge Cases & Business Rules

| Scenario | Behavior |
|----------|----------|
| Feature disabled with existing data | Data is preserved. Re-enabling restores full access to all seasons, students, enrollments, and payments. |
| Feature disabled, user navigates to /seasons URL directly | Redirect to organization overview page |
| Feature disabled, API export route called | Returns 404 |
| Season deleted with no enrollments | Allowed — season is removed |
| Season deleted with enrollments | Blocked — treasurer must archive instead |
| Student deleted with enrollments | Blocked — treasurer must deactivate instead |
| Enrollment removed with no payments | Allowed — enrollment is removed |
| Enrollment removed with payments | Blocked — treasurer can mark as "withdrawn" instead |
| Season fee changed after enrollments exist | Only affects future enrollments. Existing enrollment fees are not automatically updated. |
| Payment exceeds remaining balance | Allowed — status changes to "overpaid" |
| Fee amount is zero | Allowed — for free/waived seasons. All enrollments show "paid" immediately. |
| Fee override to zero | Allowed — that student's enrollment shows "paid" with no payments needed |
| Student enrolled in multiple active seasons | Allowed — enrollments are independent per season |
| Season archived with outstanding payments | Allowed — archiving is a display filter, not a financial lock. Payments can still be recorded on archived seasons. |

---

## 14. Separation from Financial System

This feature is intentionally decoupled from the core financial ledger:

- **No transaction creation:** Recording a season payment does not create a transaction in any account. The treasurer records actual financial income through the normal transaction flow.
- **No account impact:** Season payment totals do not affect account balances.
- **No financial report inclusion:** Season data does not appear in the Transactions report, Summary report, or Budget vs. Actuals report.
- **Independent export:** Season reports are generated via their own export endpoints, not the financial report export.

This separation keeps the financial books clean and accurate while giving the treasurer a practical tool for tracking program-level fee collection.

---

## 15. Future Considerations

These are out of scope for the initial implementation but may be considered later:

- **Bulk payment recording:** Record a single payment that covers multiple students or seasons at once
- **Payment reminders:** Email notifications to guardians about outstanding balances
- **Online payment integration:** Link to a payment portal (Stripe, Square) for direct fee collection
- **Season templates:** Save a season configuration to reuse for recurring programs
- **Student import/export:** CSV import of student rosters, export of student data
- **Attendance tracking:** Track student attendance within a season alongside payments
- **Family/household grouping:** Link students who are siblings for sibling discount automation
- **Financial system linking:** Optionally create a financial transaction when a season payment is recorded (bridging the operational and financial systems)

---

## 16. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | February 3, 2026 | Initial draft |
| 1.1 | February 3, 2026 | Added organization-level feature toggle (`seasons_enabled`), TOG-001 through TOG-007, settings UI toggle, route/API guard behavior, related edge cases |

---

*End of Document*
