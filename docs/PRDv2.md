# Treasurer App - Product Requirements Document (Version 2)

> **Version:** 2.0
> **Status:** Draft
> **Last Updated:** February 1, 2026
> **Predecessor:** PRD v1.4 (January 31, 2026)

---

## 1. Executive Summary

Version 2 of the Treasurer App builds on the feature-complete v1 foundation to address the most common workflow pain points reported by nonprofit treasurers. This release focuses on six areas: automating repetitive data entry through recurring transaction templates, supporting audit documentation with receipt attachments, aligning reports to organizational fiscal years, simplifying category housekeeping with merge operations, formalizing the monthly bank reconciliation workflow, and producing board-ready PDF reports.

---

## 2. Goals and Objectives

### 2.1 V2 Goals

- Reduce repetitive data entry for predictable monthly transactions
- Provide document management for audit readiness
- Align reporting periods with organizational fiscal calendars
- Eliminate manual workarounds for category cleanup
- Formalize bank reconciliation as a first-class workflow
- Produce presentation-ready reports for board distribution

### 2.2 Success Metrics

| Metric | Target |
|--------|--------|
| Recurring template adoption | 60% of active users create at least one template within 30 days |
| Monthly reconciliation completion rate | Users complete reconciliation in under 15 minutes for 50 or fewer transactions |
| PDF export usage | 30% of report exports use PDF format |
| Receipt attachment rate | 20% of new transactions include at least one attachment |
| Category merge errors | Zero data loss incidents from merge operations |

---

## 3. Scope

### 3.1 In Scope

| # | Feature | PRD v1 Reference |
|---|---------|------------------|
| 1 | Recurring Transaction Templates | TXN-011 (Could Have) |
| 2 | Receipt/Document Attachments | TXN-012 (Could Have) |
| 3 | Fiscal Year Reporting | RPT-007 (Could Have), uses existing `fiscal_year_start_month` |
| 4 | Category Merge | CAT-005 (Should Have, partially specified) |
| 5 | Bank Reconciliation Workflow | RPT-006 (Should Have, new dedicated workflow) |
| 6 | PDF Report Export | New requirement |

### 3.2 Out of Scope (Future Versions)

- Bank account integration (Plaid)
- Multi-user support with roles
- Budget planning and tracking
- Mobile native applications
- Donor management integration
- IRS Form 990 report generation
- Audit trail / activity log
- Dashboard analytics and charts
- CSV/OFX data import
- Receipt OCR (automatic data extraction)

---

## 4. Feature 1: Recurring Transaction Templates

### 4.1 Overview

Treasurers frequently enter the same transactions each month (rent, utilities, insurance premiums, recurring donations). Templates allow defining a transaction once and generating new instances on a schedule or on demand.

### 4.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REC-001 | Treasurer shall be able to create a recurring transaction template from scratch or from an existing transaction | Must Have |
| REC-002 | Each template shall define: account, type, amount, description, vendor, check number (optional), and line items with categories | Must Have |
| REC-003 | Each template shall have a recurrence rule: weekly, bi-weekly, monthly, quarterly, or annually | Must Have |
| REC-004 | Each template shall have a start date and an optional end date | Must Have |
| REC-005 | Treasurer shall be able to manually generate the next occurrence from a template at any time | Must Have |
| REC-006 | System shall display upcoming scheduled transactions on the dashboard and in a dedicated templates list | Must Have |
| REC-007 | Generated transactions shall be created with status "Uncleared" and linked back to the source template | Must Have |
| REC-008 | Treasurer shall be able to edit, pause, or delete a template without affecting previously generated transactions | Must Have |
| REC-009 | Treasurer shall be able to edit a generated transaction independently of the template | Must Have |
| REC-010 | System shall automatically generate transactions on their scheduled dates via a server-side process | Should Have |
| REC-011 | System shall display a notification or badge when templates have pending (un-generated) occurrences | Should Have |
| REC-012 | Template amounts shall support a "variable" flag where the amount is left blank and must be entered at generation time | Could Have |

### 4.3 Data Model

#### RecurringTemplate

```
- id: UUID (primary key)
- account_id: UUID (foreign key -> Account)
- organization_id: UUID (foreign key -> Organization)
- transaction_type: Enum ['income', 'expense']
- amount: Decimal (nullable when is_variable_amount = true)
- description: Text (required)
- vendor: Text (optional)
- check_number: Text (optional)
- recurrence_rule: Enum ['weekly', 'bi-weekly', 'monthly', 'quarterly', 'annually']
- start_date: Date (required)
- end_date: Date (nullable)
- next_occurrence_date: Date (computed, nullable when paused or ended)
- is_active: Boolean (default: true)
- is_variable_amount: Boolean (default: false)
- created_at: Timestamp
- updated_at: Timestamp
```

#### RecurringTemplateLineItem

```
- id: UUID (primary key)
- template_id: UUID (foreign key -> RecurringTemplate)
- category_id: UUID (foreign key -> Category)
- amount: Decimal (nullable when parent template is_variable_amount = true)
- memo: Text (optional)
- created_at: Timestamp
- updated_at: Timestamp
```

#### Transaction Table Changes

```
- template_id: UUID (foreign key -> RecurringTemplate, nullable) — added to existing transactions table
```

### 4.4 User Interface

#### Template List Page

Route: `/organizations/[orgId]/templates`

- Table listing all templates with columns: Description, Account, Amount, Frequency, Next Occurrence, Status (Active/Paused/Ended)
- Filter by active/paused/all
- "New Template" button
- Row actions: Generate Now, Edit, Pause/Resume, Delete

#### Template Form

Route: `/organizations/[orgId]/templates/new` and `/organizations/[orgId]/templates/[templateId]`

Fields mirror the transaction form with additions:
- Recurrence Rule dropdown (Weekly, Bi-weekly, Monthly, Quarterly, Annually)
- Start Date picker
- End Date picker (optional)
- Variable Amount toggle
- "Create from Existing Transaction" option on new template page

#### Dashboard Integration

- "Upcoming Transactions" section showing the next 5 scheduled template occurrences
- Badge count on sidebar "Templates" link when occurrences are overdue

### 4.5 Server Actions

```
POST   createTemplate(formData)           - Create template with line items
PUT    updateTemplate(templateId, formData) - Update template
DELETE deleteTemplate(templateId)          - Delete template (preserves generated txns)
POST   pauseTemplate(templateId)          - Set is_active = false
POST   resumeTemplate(templateId)         - Set is_active = true, recalculate next_occurrence_date
POST   generateFromTemplate(templateId)   - Create transaction from template
POST   generateDueTemplates(orgId)        - Generate all overdue occurrences (for server-side automation)
```

### 4.6 Validation Rules

- Line item amounts must sum to template amount (unless is_variable_amount)
- Start date required; end date must be after start date if provided
- At least one line item required
- Category types must match transaction type
- Cannot delete a template's linked category if template is active

### 4.7 RLS Policies

- Templates inherit organization-based RLS: treasurer can only access templates in their organizations
- Same ownership chain pattern: Treasurer -> Organization -> RecurringTemplate

---

## 5. Feature 2: Receipt/Document Attachments

### 5.1 Overview

Nonprofit treasurers must maintain supporting documentation for audits and board oversight. Attachments allow uploading receipt images, invoices, and other documents directly to transactions.

### 5.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| ATT-001 | Treasurer shall be able to attach one or more files to a transaction | Must Have |
| ATT-002 | Supported file types: JPEG, PNG, GIF, WebP, PDF | Must Have |
| ATT-003 | Maximum file size: 10 MB per file | Must Have |
| ATT-004 | Maximum attachments per transaction: 5 | Must Have |
| ATT-005 | Treasurer shall be able to view, download, and delete individual attachments | Must Have |
| ATT-006 | Attachments shall display as thumbnails (images) or file icons (PDFs) on the transaction detail view | Must Have |
| ATT-007 | Attachments on reconciled transactions shall be viewable and downloadable but not deletable | Must Have |
| ATT-008 | System shall store files in Supabase Storage with RLS-compatible access policies | Must Have |
| ATT-009 | Attachments shall be included as a count indicator in the transaction list view | Should Have |
| ATT-010 | Treasurer shall be able to attach files during transaction creation (before save) | Should Have |
| ATT-011 | System shall generate image thumbnails for preview display | Could Have |

### 5.3 Data Model

#### TransactionAttachment

```
- id: UUID (primary key)
- transaction_id: UUID (foreign key -> Transaction)
- file_name: Text (required) — original filename
- file_path: Text (required) — Supabase Storage path
- file_type: Text (required) — MIME type
- file_size: Integer (required) — bytes
- created_at: Timestamp
```

### 5.4 Supabase Storage Configuration

```
Bucket: transaction-attachments
Path pattern: {treasurer_id}/{organization_id}/{transaction_id}/{uuid}.{ext}
Access: Private bucket with RLS-based signed URLs
Max file size: 10 MB
Allowed MIME types: image/jpeg, image/png, image/gif, image/webp, application/pdf
```

### 5.5 Storage RLS Policies

```sql
-- Only the owning treasurer can upload, read, and delete attachments
-- Policy checks the path prefix matches the authenticated user's treasurer ID
CREATE POLICY "Treasurer can manage own attachments"
ON storage.objects FOR ALL
USING (
  bucket_id = 'transaction-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### 5.6 User Interface

#### Transaction Form Integration

- "Attachments" section below line items
- Drag-and-drop zone or file picker button
- Preview of selected files before save
- Upload progress indicator per file
- Remove button on each attachment (disabled for reconciled transactions)

#### Transaction Detail View

- Attachment gallery below transaction details
- Image attachments display as clickable thumbnails that open in a lightbox/modal
- PDF attachments display with a document icon and filename; click opens in new tab
- Download button on each attachment
- Delete button on each attachment (hidden for reconciled transactions)

#### Transaction List Integration

- Paperclip icon with count badge in the transaction row when attachments exist
- Example: `[clip icon] 3` indicates 3 attachments

### 5.7 Server Actions

```
POST   uploadAttachment(transactionId, file)     - Upload and link attachment
DELETE deleteAttachment(attachmentId)             - Delete attachment and storage object
GET    getAttachmentUrl(attachmentId)             - Generate signed URL for download/view
```

---

## 6. Feature 3: Fiscal Year Reporting

### 6.1 Overview

Many nonprofits operate on fiscal years that do not align with the calendar year (e.g., July 1 - June 30). The existing `fiscal_year_start_month` field on organizations is stored but not used in reports. This feature makes the report date pickers and presets fiscal-year-aware.

### 6.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FYR-001 | Report date range presets shall respect the organization's fiscal year start month | Must Have |
| FYR-002 | System shall provide the following date presets: Current Fiscal Year, Previous Fiscal Year, Current Fiscal Quarter, Previous Fiscal Quarter, Year-to-Date (fiscal), Calendar Year, Custom Range | Must Have |
| FYR-003 | Fiscal year label shall display correctly (e.g., "FY 2025-2026" for a July-June fiscal year) | Must Have |
| FYR-004 | Excel export header shall display the fiscal year label when a fiscal year preset is used | Should Have |
| FYR-005 | PDF export header shall display the fiscal year label when a fiscal year preset is used | Should Have |
| FYR-006 | Dashboard summary cards shall show fiscal year-to-date totals | Should Have |
| FYR-007 | Report filter UI shall display the computed date range when a preset is selected | Must Have |

### 6.3 Fiscal Year Computation Logic

```
Given: fiscal_year_start_month = M (1-12), current date = today

Current Fiscal Year:
  If today.month >= M:
    start = M/1/{today.year}
    end = (M-1)/last_day/{today.year + 1}  (or 12/31 if M=1)
  Else:
    start = M/1/{today.year - 1}
    end = (M-1)/last_day/{today.year}

Previous Fiscal Year:
  Shift current fiscal year back by one year

Fiscal Quarter:
  Divide the fiscal year into four 3-month periods starting from M

Year-to-Date (fiscal):
  start = current fiscal year start
  end = today
```

### 6.4 User Interface Changes

#### Report Filters

- Add "Date Preset" dropdown above the Start Date / End Date pickers
- Options: Current Fiscal Year, Previous Fiscal Year, Current Fiscal Quarter, Previous Fiscal Quarter, Fiscal Year-to-Date, Calendar Year (current), Custom Range
- Selecting a preset auto-fills Start Date and End Date
- Selecting "Custom Range" enables manual date entry (current behavior)
- Display computed range label: e.g., "FY 2025-2026 (Jul 1, 2025 - Jun 30, 2026)"

#### Organization Settings

- Ensure `fiscal_year_start_month` is editable on the organization edit form (already stored, verify UI exists)
- Display the fiscal year label on the organization detail page

### 6.5 Implementation Notes

- Create a `lib/fiscal-year.ts` utility module with pure functions for all date computations
- Unit tests should cover all 12 possible start months and edge cases (leap years, month boundaries)
- Presets are computed client-side based on the organization's `fiscal_year_start_month`
- The underlying report fetching and export logic does not change; only the date range inputs change

---

## 7. Feature 4: Category Merge

### 7.1 Overview

Over time, treasurers create duplicate or poorly named categories. Merging allows combining two categories: all line items referencing the source category are reassigned to the target category, and the source is deleted.

### 7.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| CMG-001 | Treasurer shall be able to merge one category into another category of the same type (income or expense) | Must Have |
| CMG-002 | Merging shall reassign all transaction line items from the source category to the target category | Must Have |
| CMG-003 | The source category shall be deleted after a successful merge | Must Have |
| CMG-004 | System shall display a confirmation dialog showing the number of affected transactions before executing a merge | Must Have |
| CMG-005 | Merging shall be an atomic operation: either all line items are reassigned and the source deleted, or nothing changes | Must Have |
| CMG-006 | Only categories of the same type (both income or both expense) can be merged | Must Have |
| CMG-007 | A parent category with subcategories cannot be used as a merge source unless all subcategories are also merged or reassigned first | Must Have |
| CMG-008 | Merge shall work across hierarchy levels (parent into parent, child into child, child into different parent's child) | Should Have |
| CMG-009 | System shall log the merge action with source and target details for audit purposes | Could Have |

### 7.3 User Interface

#### Category List Page Changes

- Add "Merge" option to category row actions (dropdown menu)
- Clicking "Merge" opens a dialog:
  - Header: "Merge Category"
  - Source: Display the selected category name (read-only)
  - Target: Dropdown of eligible categories (same type, excluding source and its children)
  - Info text: "X transactions with Y line items will be moved from [Source] to [Target]"
  - Warning: "This action cannot be undone. The source category will be permanently deleted."
  - Buttons: "Cancel" and "Merge Categories"

### 7.4 Server Action

```
POST mergeCategories(sourceCategoryId, targetCategoryId)
```

**Implementation Steps (atomic):**
1. Validate source and target are same type
2. Validate source has no subcategories (or handle recursively)
3. Count affected line items
4. Begin transaction:
   a. UPDATE transaction_line_items SET category_id = target WHERE category_id = source
   b. UPDATE recurring_template_line_items SET category_id = target WHERE category_id = source
   c. DELETE category WHERE id = source
5. Commit transaction
6. Revalidate category and transaction paths

### 7.5 Validation Rules

- Source and target must belong to the same organization
- Source and target must have the same `category_type`
- Source must not be the same as target
- Source must not have active subcategories
- Both categories must exist and be accessible by the current treasurer

---

## 8. Feature 5: Bank Reconciliation Workflow

### 8.1 Overview

Bank reconciliation is the formal process of matching the treasurer's records against a bank statement. Currently, treasurers manually mark transactions as cleared/reconciled using bulk actions. A dedicated reconciliation workflow provides a structured process: enter the statement ending balance, check off matching transactions, and verify the calculated balance matches the statement.

### 8.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| BRC-001 | Treasurer shall be able to start a reconciliation session for a specific account | Must Have |
| BRC-002 | Reconciliation session shall require: statement date, statement ending balance | Must Have |
| BRC-003 | System shall display the account's last reconciled balance as the starting point | Must Have |
| BRC-004 | System shall display all uncleared and cleared transactions for the account up to the statement date | Must Have |
| BRC-005 | Treasurer shall be able to check/uncheck individual transactions to mark them as matched | Must Have |
| BRC-006 | System shall display a running "difference" that updates as transactions are checked: (starting balance + checked income - checked expenses) vs. statement ending balance | Must Have |
| BRC-007 | When the difference reaches $0.00, the "Finish Reconciliation" button becomes enabled | Must Have |
| BRC-008 | Finishing reconciliation shall mark all checked transactions as "Reconciled" and set their `cleared_at` if not already set | Must Have |
| BRC-009 | Treasurer shall be able to cancel/abandon a reconciliation session without making changes | Must Have |
| BRC-010 | System shall save reconciliation session history: date, account, starting balance, ending balance, transaction count | Should Have |
| BRC-011 | Treasurer shall be able to add a new transaction during reconciliation (for bank fees, interest, etc. discovered on the statement) | Should Have |
| BRC-012 | System shall warn if any transactions in the reconciliation window have been modified since the session started | Could Have |

### 8.3 Data Model

#### ReconciliationSession

```
- id: UUID (primary key)
- account_id: UUID (foreign key -> Account)
- statement_date: Date (required)
- statement_ending_balance: Decimal (required)
- starting_balance: Decimal (required) — last reconciled balance at session start
- status: Enum ['in_progress', 'completed', 'cancelled']
- completed_at: Timestamp (nullable)
- transaction_count: Integer (nullable) — set on completion
- created_at: Timestamp
- updated_at: Timestamp
```

### 8.4 User Interface

#### Reconciliation Entry Point

- "Reconcile" button on the account detail page
- Also accessible from a new sidebar item: "Reconciliation" under the account section

#### Step 1: Session Setup

Route: `/organizations/[orgId]/accounts/[accountId]/reconcile`

- Display: Account name, last reconciled balance (computed from reconciled transactions + opening balance)
- Input: Statement Date (date picker), Statement Ending Balance (currency input)
- Button: "Start Reconciliation"

#### Step 2: Transaction Matching

Route: `/organizations/[orgId]/accounts/[accountId]/reconcile/[sessionId]`

**Layout:**

```
┌─────────────────────────────────────────────┐
│ Reconciling: Main Checking                  │
│ Statement Date: January 31, 2026            │
├─────────────────────┬───────────────────────┤
│ Starting Balance    │          $12,450.00    │
│ Checked Income      │        +  $3,200.00    │
│ Checked Expenses    │        -  $1,875.50    │
│ Calculated Balance  │          $13,774.50    │
│ Statement Balance   │          $13,774.50    │
│ ─────────────────── │ ───────────────────── │
│ Difference          │              $0.00  ✓  │
├─────────────────────┴───────────────────────┤
│ ☐ 01/05  Check #1234  Office Rent   -$800   │
│ ☑ 01/07  Donation from Smith Corp   +$500   │
│ ☑ 01/10  Check #1235  Utilities     -$125   │
│ ☐ 01/15  PayPal Transfer           +$1200   │
│ ...                                          │
├──────────────────────────────────────────────┤
│ [Cancel]    [Add Transaction]    [Finish ✓]  │
└──────────────────────────────────────────────┘
```

**Transaction List:**
- Checkbox column for selecting/deselecting
- Columns: Date, Check #, Description, Amount (income positive, expense negative)
- Transactions sorted by date ascending
- Already-cleared transactions appear pre-checked (they were previously verified)
- Uncleared transactions appear unchecked
- Color coding: green for income, red for expenses
- Search/filter within the reconciliation list

**Balance Summary Panel (sticky at top):**
- Starting Balance: last reconciled balance
- Checked Income: sum of checked income transactions
- Checked Expenses: sum of checked expense transactions
- Calculated Balance: starting + income - expenses
- Statement Balance: entered in step 1
- Difference: calculated - statement (highlighted green when $0.00, red otherwise)

**Actions:**
- "Cancel" — abandon session, no changes saved
- "Add Transaction" — opens quick transaction entry modal (for bank fees, interest, etc.)
- "Finish Reconciliation" — disabled until difference = $0.00; marks all checked as Reconciled

### 8.5 Server Actions

```
POST   startReconciliation(accountId, statementDate, statementEndingBalance)
GET    getReconciliationTransactions(sessionId)
POST   finishReconciliation(sessionId, checkedTransactionIds[])
POST   cancelReconciliation(sessionId)
```

### 8.6 Reconciliation Balance Computation

```
Starting Balance = Account Opening Balance
  + SUM(reconciled income transaction amounts)
  - SUM(reconciled expense transaction amounts)

Calculated Balance = Starting Balance
  + SUM(checked income amounts in current session)
  - SUM(checked expense amounts in current session)

Difference = Calculated Balance - Statement Ending Balance
```

### 8.7 Validation Rules

- Statement date must not be in the future
- Statement ending balance can be any value (including negative for overdrawn accounts)
- Only one active (in_progress) reconciliation session per account at a time
- Cannot start reconciliation if account has no transactions
- Finish requires difference = $0.00 (exact match)
- Cannot modify reconciled transactions during reconciliation

---

## 9. Feature 6: PDF Report Export

### 9.1 Overview

Board members and auditors often prefer receiving formatted PDF reports rather than Excel spreadsheets. PDF export produces a presentation-ready document with the same data as the Excel export but formatted for printing and screen reading.

### 9.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| PDF-001 | Treasurer shall be able to export reports as PDF in addition to Excel | Must Have |
| PDF-002 | PDF report shall contain the same data as the Excel export: transactions and summary | Must Have |
| PDF-003 | PDF shall include a cover page with organization name, report title, date range, and generation timestamp | Must Have |
| PDF-004 | Transaction pages shall display transactions grouped by account, then by status | Must Have |
| PDF-005 | Summary page shall include category breakdowns, account balances, and totals | Must Have |
| PDF-006 | PDF shall use professional formatting suitable for board meeting distribution | Must Have |
| PDF-007 | Currency values shall be right-aligned with consistent formatting ($#,##0.00) | Must Have |
| PDF-008 | PDF shall support page headers (org name) and footers (page numbers) | Must Have |
| PDF-009 | Long reports shall handle page breaks cleanly: no orphaned headers, no split transaction groups mid-page | Should Have |
| PDF-010 | Income amounts shall be styled in green, expense amounts in red | Should Have |
| PDF-011 | PDF file naming shall follow the same convention as Excel: `{OrgName}_Report_{Start}_to_{End}.pdf` | Must Have |
| PDF-012 | PDF generation shall complete within 15 seconds for reports with up to 10,000 transactions | Must Have |

### 9.3 PDF Structure

#### Page 1: Cover Page

```
┌──────────────────────────────────┐
│                                  │
│    {Organization Name}           │
│                                  │
│    Financial Transaction Report  │
│                                  │
│    {Start Date} to {End Date}    │
│    {Fiscal Year Label if preset} │
│                                  │
│    Generated: {Date/Time}        │
│                                  │
│    Filters Applied:              │
│    Account: {name or "All"}      │
│    Status: {filter or "All"}     │
│    Category: {name or "All"}     │
│                                  │
└──────────────────────────────────┘
```

#### Pages 2+: Transaction Detail

**Table Columns:**

| Column | Width % | Alignment |
|--------|---------|-----------|
| Date | 10 | Left |
| Check # | 7 | Left |
| Vendor | 12 | Left |
| Description | 18 | Left |
| Category | 15 | Left |
| Memo | 13 | Left |
| Income | 10 | Right |
| Expense | 10 | Right |
| Balance | 10 | Right |

- Grouped by account with account header row (account name, starting balance)
- Within each account, grouped by status (Uncleared, Cleared, Reconciled)
- Status subtotal rows
- Account ending balance row
- Grand total row at the end

#### Final Pages: Summary

- Overall Summary (Total Income, Total Expenses, Net Change)
- Balance by Status
- Account Balances (Starting, Ending, Net Change per account)
- Income by Category (hierarchical)
- Expenses by Category (hierarchical)

### 9.4 Technical Approach

**Library:** Use a server-side PDF generation library. Recommended options:

| Library | Pros | Cons |
|---------|------|------|
| `@react-pdf/renderer` | React component model, familiar syntax | Heavier bundle, slower for large docs |
| `pdfkit` | Fast, mature, streaming support | Imperative API, manual layout |
| `jspdf` + `jspdf-autotable` | Good table support, lightweight | Less control over complex layouts |

**Recommendation:** `pdfkit` for its streaming capability and performance with large transaction sets. It handles the imperative table layout well and supports page headers/footers natively.

### 9.5 API Route

```
GET /api/organizations/[orgId]/reports/export/pdf
```

**Query Parameters:** Same as the existing Excel export route:
```
?start_date=YYYY-MM-DD
&end_date=YYYY-MM-DD
&account_id=UUID          (optional)
&category_id=UUID         (optional)
&status=uncleared,cleared (optional)
```

**Response:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="{OrgName}_Report_{Start}_to_{End}.pdf"
```

### 9.6 Implementation Notes

- The PDF generation module should live in `lib/pdf/generate-report.ts`, mirroring the Excel module structure in `lib/excel/`
- Reuse `lib/reports/fetch-report-data.ts` for data fetching (same data source as Excel)
- Reuse `lib/reports/utils.ts` for category grouping and summary computation
- The report filters UI needs a format selector (Excel / PDF) or two distinct export buttons

---

## 10. Data Model Summary

### 10.1 New Tables

| Table | Feature | Relationships |
|-------|---------|---------------|
| `recurring_templates` | Recurring Transactions | belongs to Account, Organization |
| `recurring_template_line_items` | Recurring Transactions | belongs to RecurringTemplate, references Category |
| `transaction_attachments` | Attachments | belongs to Transaction |
| `reconciliation_sessions` | Bank Reconciliation | belongs to Account |

### 10.2 Modified Tables

| Table | Change | Feature |
|-------|--------|---------|
| `transactions` | Add nullable `template_id` column (FK -> recurring_templates) | Recurring Transactions |

### 10.3 Entity Relationship Diagram (V2 Additions)

```
RecurringTemplate (1) ── contains ──> (Many) RecurringTemplateLineItems
RecurringTemplate (1) ── generates ──> (Many) Transactions (via template_id)
RecurringTemplateLineItem (Many) ── references ──> (1) Category

Transaction (1) ── has ──> (Many) TransactionAttachments
TransactionAttachment ── stored in ──> Supabase Storage

Account (1) ── has ──> (Many) ReconciliationSessions
```

### 10.4 Database Indexes (New)

```sql
CREATE INDEX idx_recurring_templates_account ON recurring_templates(account_id);
CREATE INDEX idx_recurring_templates_org ON recurring_templates(organization_id);
CREATE INDEX idx_recurring_templates_next ON recurring_templates(next_occurrence_date) WHERE is_active = true;
CREATE INDEX idx_recurring_template_line_items_template ON recurring_template_line_items(template_id);
CREATE INDEX idx_transaction_attachments_transaction ON transaction_attachments(transaction_id);
CREATE INDEX idx_transactions_template ON transactions(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX idx_reconciliation_sessions_account ON reconciliation_sessions(account_id);
```

### 10.5 RLS Policies (New Tables)

All new tables follow the existing ownership chain pattern:

- `recurring_templates`: Accessible where `organization_id` belongs to the authenticated treasurer
- `recurring_template_line_items`: Accessible where parent template's organization belongs to the treasurer
- `transaction_attachments`: Accessible where parent transaction's account's organization belongs to the treasurer
- `reconciliation_sessions`: Accessible where account's organization belongs to the treasurer

---

## 11. Route Structure (V2 Additions)

```
app/(dashboard)/organizations/[orgId]/
├── templates/
│   ├── page.tsx                    # Template list
│   ├── new/
│   │   └── page.tsx               # Create template
│   └── [templateId]/
│       └── page.tsx               # Edit template
├── accounts/[accountId]/
│   └── reconcile/
│       ├── page.tsx               # Start reconciliation (step 1)
│       └── [sessionId]/
│           └── page.tsx           # Reconciliation session (step 2)
└── reports/
    └── page.tsx                   # Updated with fiscal year presets + PDF button

app/api/organizations/[orgId]/
├── reports/
│   └── export/
│       ├── route.ts               # Existing Excel export
│       └── pdf/
│           └── route.ts           # New PDF export
└── templates/
    └── generate-due/
        └── route.ts               # Cron endpoint for auto-generation (REC-010)
```

---

## 12. New Dependencies

| Package | Purpose | Feature |
|---------|---------|---------|
| `pdfkit` | Server-side PDF generation | PDF Report Export |
| (none) | Supabase Storage SDK already included via `@supabase/supabase-js` | Attachments |

---

## 13. Migration Plan

### 13.1 Migration Order

Migrations should be applied in this order to respect foreign key dependencies:

1. **Migration 6:** Create `recurring_templates` and `recurring_template_line_items` tables with RLS
2. **Migration 7:** Add `template_id` column to `transactions` table
3. **Migration 8:** Create `transaction_attachments` table with RLS
4. **Migration 9:** Create `reconciliation_sessions` table with RLS
5. **Migration 10:** Create Supabase Storage bucket and policies for attachments

### 13.2 Backwards Compatibility

- All new columns on existing tables are nullable
- No existing data is modified
- All new features are additive; existing functionality is unchanged
- The `template_id` on transactions is nullable and has no impact on existing transaction behavior

---

## 14. Non-Functional Requirements (V2 Additions)

| Category | Requirement |
|----------|-------------|
| **Performance** | PDF generation under 15 seconds for 10,000 transactions |
| **Performance** | Reconciliation page loads in under 3 seconds for 500 transactions |
| **Performance** | Attachment upload completes within 5 seconds per file on broadband |
| **Storage** | Supabase Storage quota monitoring; warn at 80% capacity |
| **Security** | Attachment access via signed URLs with 1-hour expiration |
| **Security** | Validate file MIME types server-side, not just client-side |
| **Reliability** | Category merge is atomic; partial merges must not occur |
| **Reliability** | Reconciliation sessions auto-cancel after 24 hours of inactivity |

---

## 15. Implementation Priority

Features are ordered by dependency and value delivery:

| Phase | Feature | Rationale |
|-------|---------|-----------|
| 1 | Fiscal Year Reporting | Smallest scope, uses existing data, immediate value |
| 2 | Category Merge | Small scope, resolves existing pain point |
| 3 | Bank Reconciliation | Core treasurer workflow, moderate complexity |
| 4 | Recurring Transaction Templates | New tables + scheduling logic, high value |
| 5 | Receipt/Document Attachments | Requires Supabase Storage setup, independent of other features |
| 6 | PDF Report Export | New dependency, benefits from fiscal year labels being in place |

---

## 16. Document History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | February 1, 2026 | Initial V2 PRD: Recurring templates, attachments, fiscal year reporting, category merge, bank reconciliation, PDF export |

---

*End of Document*
