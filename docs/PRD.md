# Treasurer App - Product Requirements Document

> **Version:** 1.2  
> **Status:** Draft  
> **Last Updated:** January 30, 2025

---

## 1. Executive Summary

The Treasurer App is a specialized financial management application designed for treasurers of 501(c)(3) nonprofit organizations. The application enables treasurers to efficiently manage bookkeeping responsibilities across multiple organizations, track transactions across various accounts, implement custom categorization systems, and generate comprehensive financial reports in Excel format.

---

## 2. Problem Statement

Treasurers of nonprofit organizations often struggle with managing financial records across multiple entities and accounts. Existing solutions are either too complex for small nonprofits or lack the specific features needed for 501(c)(3) compliance and reporting. There is a need for a streamlined, purpose-built solution that allows treasurers to manage multiple organizations with customizable categorization and straightforward reporting capabilities.

---

## 3. Goals and Objectives

### 3.1 Primary Goals

- Simplify bookkeeping for 501(c)(3) treasurers
- Enable management of multiple organizations from a single interface
- Provide flexible, user-defined categorization for transactions
- Generate exportable reports for board meetings and audits

### 3.2 Success Metrics

- Treasurer can set up a new organization in under 5 minutes
- Transaction entry takes less than 30 seconds per transaction
- Report generation completes in under 10 seconds
- User satisfaction rating of 4.5/5 or higher

---

## 4. User Personas

### 4.1 Primary User: The Treasurer

| Attribute | Description |
|-----------|-------------|
| **Role** | Volunteer or appointed treasurer for one or more 501(c)(3) organizations |
| **Technical Skill** | Moderate; comfortable with basic spreadsheets and web applications |
| **Primary Need** | Track income and expenses, categorize transactions, and produce reports for board review |
| **Pain Points** | Managing multiple organizations separately, inconsistent categorization, time-consuming report creation |

---

## 5. Functional Requirements

### 5.1 Organization Management

| ID | Requirement | Priority |
|----|-------------|----------|
| ORG-001 | Treasurer shall be able to create and manage multiple 501(c)(3) organizations | Must Have |
| ORG-002 | Each organization shall have a unique name and identifying information (EIN optional) | Must Have |
| ORG-003 | Treasurer shall be able to switch between organizations easily | Must Have |
| ORG-004 | Treasurer shall be able to archive or delete organizations | Should Have |
| ORG-005 | System shall maintain separation of data between organizations | Must Have |

### 5.2 Account Management

| ID | Requirement | Priority |
|----|-------------|----------|
| ACC-001 | Each organization shall support multiple financial accounts (checking, savings, PayPal, etc.) | Must Have |
| ACC-002 | Each account shall have a name, type, and optional description | Must Have |
| ACC-003 | Treasurer shall be able to set an opening balance for each account | Must Have |
| ACC-004 | System shall display current balance for each account | Must Have |
| ACC-005 | Treasurer shall be able to deactivate accounts while preserving historical data | Should Have |

### 5.3 Transaction Management

| ID | Requirement | Priority |
|----|-------------|----------|
| TXN-001 | Treasurer shall be able to enter income and expense transactions | Must Have |
| TXN-002 | Each transaction shall include: date, total amount, description, and status | Must Have |
| TXN-003 | Transactions shall be assigned to a specific account | Must Have |
| TXN-004 | Transactions shall support three statuses: Uncleared, Cleared, and Reconciled | Must Have |
| TXN-005 | System shall track the date when a transaction was created | Must Have |
| TXN-006 | System shall track the date when a transaction was cleared | Must Have |
| TXN-007 | Transactions shall support multiple category line items (split transactions) | Must Have |
| TXN-008 | The sum of all line item amounts must equal the transaction total | Must Have |
| TXN-009 | Treasurer shall be able to edit or delete existing transactions | Must Have |
| TXN-010 | System shall support check number field for check transactions | Must Have |
| TXN-011 | System shall support recurring transaction templates | Could Have |
| TXN-012 | Treasurer shall be able to attach receipt images or documents to transactions | Could Have |

#### 5.3.1 Transaction Status Definitions

| Status | Definition |
|--------|------------|
| **Uncleared** | Transaction has been entered but not yet verified against bank statement |
| **Cleared** | Transaction has been verified as appearing on a bank statement |
| **Reconciled** | Transaction has been formally reconciled during a reconciliation process and is locked from editing |

#### 5.3.2 Split Transaction Example

A single $500 check for office supplies could be split across categories:
```
Transaction Total: $500.00
  - Operations → Office Supplies:    $350.00
  - Operations → Computer Equipment: $150.00
  ----------------------------------------
  Line Items Sum:                    $500.00 ✓
```

### 5.4 Category Management

| ID | Requirement | Priority |
|----|-------------|----------|
| CAT-001 | Treasurer shall be able to create custom categories for each organization | Must Have |
| CAT-002 | Categories shall support a two-level hierarchy (parent category → subcategory) | Must Have |
| CAT-003 | Example: "Fundraiser" (parent) → "Light Up Corydon" (subcategory) | Must Have |
| CAT-004 | Categories shall be designated as Income or Expense type | Must Have |
| CAT-005 | Treasurer shall be able to rename or merge categories | Should Have |
| CAT-006 | System shall prevent deletion of categories with associated transactions | Must Have |

### 5.5 Reporting and Export

| ID | Requirement | Priority |
|----|-------------|----------|
| RPT-001 | Treasurer shall be able to generate transaction reports filtered by date range | Must Have |
| RPT-002 | Reports shall be exportable to Excel (.xlsx) format | Must Have |
| RPT-003 | Reports shall include transactions with status indicator (Uncleared, Cleared, Reconciled) | Must Have |
| RPT-004 | Reports shall be filterable by account, category, or transaction status | Should Have |
| RPT-005 | Excel export shall include summary totals by category | Should Have |
| RPT-006 | System shall generate balance reconciliation reports | Should Have |
| RPT-007 | Reports shall support year-to-date and fiscal year views | Could Have |

---

## 6. Data Model

### 6.1 Entity Relationships

```
Treasurer (1) ──── manages ────> (Many) Organizations
Organization (1) ── contains ──> (Many) Accounts
Organization (1) ── defines ───> (Many) Categories
Account (1) ─────── holds ─────> (Many) Transactions
Transaction (1) ─── contains ──> (Many) Line Items
Line Item (Many) ── references ─> (1) Category
```

### 6.2 Entity Definitions

#### Treasurer
```
- id: UUID (primary key)
- name: String (required)
- email: String (required, unique)
- password_hash: String (required)
- created_at: Timestamp
- updated_at: Timestamp
```

#### Organization
```
- id: UUID (primary key)
- treasurer_id: UUID (foreign key → Treasurer)
- name: String (required)
- ein: String (optional, format: XX-XXXXXXX)
- fiscal_year_start_month: Integer (1-12, default: 1)
- is_active: Boolean (default: true)
- created_at: Timestamp
- updated_at: Timestamp
```

#### Account
```
- id: UUID (primary key)
- organization_id: UUID (foreign key → Organization)
- name: String (required)
- account_type: Enum ['checking', 'savings', 'paypal', 'cash', 'other']
- description: String (optional)
- opening_balance: Decimal (default: 0.00)
- is_active: Boolean (default: true)
- created_at: Timestamp
- updated_at: Timestamp
```

#### Category
```
- id: UUID (primary key)
- organization_id: UUID (foreign key → Organization)
- parent_id: UUID (foreign key → Category, nullable)
- name: String (required)
- category_type: Enum ['income', 'expense']
- is_active: Boolean (default: true)
- created_at: Timestamp
- updated_at: Timestamp
```

#### Transaction
```
- id: UUID (primary key)
- account_id: UUID (foreign key → Account)
- transaction_date: Date (required) - the date of the transaction
- amount: Decimal (required, positive value) - total transaction amount
- transaction_type: Enum ['income', 'expense']
- description: String (required)
- check_number: String (optional)
- status: Enum ['uncleared', 'cleared', 'reconciled'] (default: 'uncleared')
- created_at: Timestamp - when the transaction was entered into the system
- cleared_at: Timestamp (nullable) - when the transaction was marked as cleared
- updated_at: Timestamp
```

#### TransactionLineItem
```
- id: UUID (primary key)
- transaction_id: UUID (foreign key → Transaction)
- category_id: UUID (foreign key → Category)
- amount: Decimal (required, positive value)
- memo: String (optional) - line-item specific note
- created_at: Timestamp
- updated_at: Timestamp

CONSTRAINT: SUM(line_items.amount) for a transaction MUST equal transaction.amount
```

### 6.3 Database Indexes

```sql
-- Performance indexes
CREATE INDEX idx_transactions_account_date ON transactions(account_id, transaction_date);
CREATE INDEX idx_transactions_status ON transactions(account_id, status);
CREATE INDEX idx_transactions_created ON transactions(account_id, created_at);
CREATE INDEX idx_line_items_transaction ON transaction_line_items(transaction_id);
CREATE INDEX idx_line_items_category ON transaction_line_items(category_id);
CREATE INDEX idx_categories_organization ON categories(organization_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_accounts_organization ON accounts(organization_id);
CREATE INDEX idx_organizations_treasurer ON organizations(treasurer_id);
```

---

## 7. User Interface Requirements

### 7.1 Dashboard

- Organization selector dropdown (persistent in header)
- Summary cards showing:
    - Total balance across all accounts
    - Uncleared balance
    - Cleared balance
    - Reconciled balance
- Recent transactions list (last 10)
- Quick-action buttons: Add Transaction, View Reports, Manage Categories

### 7.2 Transaction Entry Form

**Transaction Header Fields:**

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| Transaction Date | Date picker | Yes | Today | The date of the transaction |
| Account | Dropdown | Yes | - | Lists active accounts only |
| Type | Toggle | Yes | Expense | Income / Expense |
| Total Amount | Currency input | Yes | - | Positive values only |
| Description | Text input | Yes | - | Max 255 characters |
| Check # | Text input | No | - | Shown for checking accounts |
| Status | Dropdown | No | Uncleared | Uncleared / Cleared / Reconciled |

**Line Items Section (Split Categories):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Category | Hierarchical dropdown | Yes | Shows "Parent → Child" format |
| Amount | Currency input | Yes | Must be positive |
| Memo | Text input | No | Optional line-item note |

**Line Items Behavior:**
- Minimum of 1 line item required
- "Add Line Item" button to add additional splits
- Running total displayed showing sum of line items
- Validation error if line items don't sum to transaction total
- "Remove" button on each line item (disabled if only 1 remaining)

**Note:** The `created_at` timestamp is automatically set when the transaction is saved. The `cleared_at` timestamp is automatically set when status changes from Uncleared to Cleared or Reconciled.

### 7.3 Transaction List View

**Columns:**
- Transaction Date
- Created Date
- Account
- Check #
- Description
- Categories (displayed as "Parent → Subcategory"; shows "Multiple" with tooltip for splits)
- Amount (color-coded: green for income, red for expense)
- Status (Uncleared / Cleared / Reconciled with visual indicator)
- Cleared Date
- Running Balance

**Features:**
- Sortable columns (click header to sort)
- Filter panel with: date range, account, category, transaction status
- Expandable rows to show line item details for split transactions
- Inline editing (click to edit) - disabled for Reconciled transactions
- Bulk actions: Mark as Cleared, Mark as Reconciled, Delete Selected
- Export to Excel button
- Split indicator icon for transactions with multiple line items

**Status Visual Indicators:**
- Uncleared: Open circle (○) or yellow indicator
- Cleared: Checkmark (✓) or green indicator
- Reconciled: Lock icon (🔒) or blue indicator

### 7.4 Reports Screen

**Report Parameters:**
- Start Date (required)
- End Date (required)
- Account Filter: All / Specific account
- Status Filter: All / Uncleared Only / Cleared Only / Reconciled Only / Uncleared + Cleared
- Category Filter: All / Specific category

**Actions:**
- Preview Report (in-browser)
- Export to Excel (.xlsx)

---

## 8. Excel Export Specification

### 8.1 File Naming Convention

```
{OrganizationName}_Transactions_{StartDate}_to_{EndDate}.xlsx
```

Example: `CorydonCommunityFoundation_Transactions_2024-01-01_to_2024-12-31.xlsx`

### 8.2 Worksheet Structure

#### Sheet 1: Transactions

**Header Section (Rows 1-4):**
```
Row 1: {Organization Name}
Row 2: Transaction Report
Row 3: {Start Date} to {End Date}
Row 4: Generated: {Current Date/Time}
Row 5: [blank]
Row 6: Column Headers
```

**Column Definitions:**

| Column | Header | Format | Width |
|--------|--------|--------|-------|
| A | Transaction Date | Date (MM/DD/YYYY) | 15 |
| B | Created Date | Date (MM/DD/YYYY) | 15 |
| C | Account | Text | 20 |
| D | Check # | Text | 10 |
| E | Description | Text | 40 |
| F | Category | Text | 30 |
| G | Line Memo | Text | 25 |
| H | Income | Currency ($#,##0.00) | 15 |
| I | Expense | Currency ($#,##0.00) | 15 |
| J | Status | Text | 12 |
| K | Cleared Date | Date (MM/DD/YYYY) | 15 |
| L | Running Balance | Currency ($#,##0.00) | 15 |

**Data Rows:**
- One row per line item (split transactions will have multiple rows)
- Sorted by transaction date ascending, then by transaction ID
- For split transactions:
    - First line item row shows all transaction fields
    - Subsequent line item rows show Category, Line Memo, and Amount only (other fields blank or merged)
    - Running Balance only shown on last line item of each transaction
- Category displayed as "Parent → Subcategory"
- Income column populated for income transactions (Expense blank)
- Expense column populated for expense transactions (Income blank)
- Status: "Uncleared", "Cleared", or "Reconciled"
- Cleared Date: Populated when status is Cleared or Reconciled; blank for Uncleared

**Split Transaction Example in Excel:**
```
| Date       | Account  | Check# | Description    | Category                  | Memo          | Income | Expense | Status  |
|------------|----------|--------|----------------|---------------------------|---------------|--------|---------|---------|
| 01/15/2025 | Checking | 1042   | Office Supplies| Operations → Supplies     | Paper & pens  |        | $350.00 | Cleared |
|            |          |        |                | Operations → Equipment    | USB drives    |        | $150.00 |         |
```

#### Sheet 2: Summary

**Summary Sections:**

```
OVERALL SUMMARY
---------------
Total Income:        $X,XXX.XX
Total Expenses:      $X,XXX.XX
Net Change:          $X,XXX.XX

BALANCE BY STATUS
-----------------
Uncleared Balance:   $X,XXX.XX
Cleared Balance:     $X,XXX.XX
Reconciled Balance:  $X,XXX.XX

INCOME BY CATEGORY
------------------
{Parent Category}
  {Subcategory 1}:   $X,XXX.XX
  {Subcategory 2}:   $X,XXX.XX
  Subtotal:          $X,XXX.XX

EXPENSES BY CATEGORY
--------------------
{Parent Category}
  {Subcategory 1}:   $X,XXX.XX
  {Subcategory 2}:   $X,XXX.XX
  Subtotal:          $X,XXX.XX
```

---

## 9. API Endpoints

### 9.1 Authentication

```
POST   /api/auth/register     - Create new treasurer account
POST   /api/auth/login        - Login and receive JWT token
POST   /api/auth/logout       - Invalidate token
POST   /api/auth/refresh      - Refresh JWT token
```

### 9.2 Organizations

```
GET    /api/organizations                - List all organizations for treasurer
POST   /api/organizations                - Create new organization
GET    /api/organizations/:id            - Get organization details
PUT    /api/organizations/:id            - Update organization
DELETE /api/organizations/:id            - Delete/archive organization
```

### 9.3 Accounts

```
GET    /api/organizations/:orgId/accounts          - List accounts
POST   /api/organizations/:orgId/accounts          - Create account
GET    /api/organizations/:orgId/accounts/:id      - Get account details
PUT    /api/organizations/:orgId/accounts/:id      - Update account
DELETE /api/organizations/:orgId/accounts/:id      - Deactivate account
GET    /api/organizations/:orgId/accounts/:id/balance - Get current balance
```

### 9.4 Categories

```
GET    /api/organizations/:orgId/categories        - List categories (hierarchical)
POST   /api/organizations/:orgId/categories        - Create category
GET    /api/organizations/:orgId/categories/:id    - Get category details
PUT    /api/organizations/:orgId/categories/:id    - Update category
DELETE /api/organizations/:orgId/categories/:id    - Delete category (if no transactions)
```

### 9.5 Transactions

```
GET    /api/organizations/:orgId/transactions           - List transactions (with filters)
POST   /api/organizations/:orgId/transactions           - Create transaction with line items
GET    /api/organizations/:orgId/transactions/:id       - Get transaction details with line items
PUT    /api/organizations/:orgId/transactions/:id       - Update transaction (blocked if reconciled)
DELETE /api/organizations/:orgId/transactions/:id       - Delete transaction (blocked if reconciled)
PATCH  /api/organizations/:orgId/transactions/:id/status - Update transaction status
```

**Create/Update Transaction Request Body:**
```json
{
  "transaction_date": "2025-01-15",
  "account_id": "uuid",
  "transaction_type": "expense",
  "amount": 500.00,
  "description": "Office Supplies",
  "check_number": "1042",
  "status": "uncleared",
  "line_items": [
    {
      "category_id": "uuid",
      "amount": 350.00,
      "memo": "Paper & pens"
    },
    {
      "category_id": "uuid",
      "amount": 150.00,
      "memo": "USB drives"
    }
  ]
}
```

**Validation Rules:**
- `line_items` array must have at least 1 item
- Sum of `line_items[].amount` must equal `amount`
- All `category_id` values must belong to the same organization
- All `category_id` types must match `transaction_type` (income categories for income, expense for expense)

**Status Update Rules:**
- Uncleared → Cleared: Sets `cleared_at` timestamp
- Uncleared → Reconciled: Sets `cleared_at` timestamp if not already set
- Cleared → Reconciled: Allowed
- Cleared → Uncleared: Clears `cleared_at` timestamp
- Reconciled → Cleared: Requires confirmation (unlocks transaction)
- Reconciled → Uncleared: Requires confirmation (unlocks transaction), clears `cleared_at`

**Transaction List Query Parameters:**
```
?account_id=UUID                    - Filter by account
?category_id=UUID                   - Filter by category (matches any line item)
?start_date=YYYY-MM-DD              - Filter by transaction date range start
?end_date=YYYY-MM-DD                - Filter by transaction date range end
?status=uncleared|cleared|reconciled - Filter by status (can be comma-separated)
?sort=transaction_date|created_at|amount - Sort field
?order=asc|desc                     - Sort order
?page=number                        - Pagination
?limit=number                       - Items per page (default: 50)
?include_line_items=boolean         - Include line items in response (default: true)
```

### 9.6 Reports

```
GET    /api/organizations/:orgId/reports/transactions - Generate transaction report
GET    /api/organizations/:orgId/reports/export       - Export to Excel (.xlsx)
```

**Report Query Parameters:**
```
?start_date=YYYY-MM-DD              - Required
?end_date=YYYY-MM-DD                - Required
?account_id=UUID                    - Optional filter
?category_id=UUID                   - Optional filter
?status=uncleared|cleared|reconciled - Optional filter (can be comma-separated)
```

---

## 10. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Page load time under 3 seconds; report generation under 10 seconds for up to 10,000 transactions |
| **Security** | Data encryption at rest and in transit; secure authentication with JWT; session management |
| **Availability** | 99.5% uptime; scheduled maintenance windows communicated in advance |
| **Scalability** | Support up to 50 organizations per treasurer; 10 accounts per organization; 100,000 transactions per organization |
| **Compatibility** | Modern browsers (Chrome, Firefox, Safari, Edge); responsive design for tablet use |
| **Data Backup** | Daily automated backups with 30-day retention; user-initiated export capability |

---

## 11. Tech Stack Recommendations

### Frontend
- **Framework:** React or Vue.js
- **State Management:** Redux or Pinia
- **UI Components:** Tailwind CSS + Headless UI or shadcn/ui
- **Date Handling:** date-fns or dayjs
- **Forms:** React Hook Form or VeeValidate

### Backend
- **Runtime:** Node.js or Python
- **Framework:** Express.js, Fastify, or FastAPI
- **Database:** PostgreSQL
- **ORM:** Prisma, Drizzle, or SQLAlchemy
- **Authentication:** JWT with refresh tokens
- **Excel Export:** ExcelJS (Node.js) or openpyxl (Python)

### Infrastructure
- **Hosting:** Vercel, Railway, or AWS
- **Database Hosting:** Supabase, Neon, or AWS RDS
- **File Storage:** S3-compatible (for receipt attachments)

---

## 12. Future Considerations

The following features are out of scope for the initial release but may be considered for future versions:

- Bank account integration (automatic transaction import via Plaid)
- Multi-user support with role-based permissions (Board view, Read-only)
- Budget planning and tracking
- Mobile native applications (iOS/Android)
- Donor management integration
- IRS Form 990 report generation
- Audit trail and compliance logging
- Custom report builder
- Receipt OCR (automatic data extraction from photos)
- Email reminders for recurring transactions

---

## 13. Appendix

### 13.1 Glossary

| Term | Definition |
|------|------------|
| **501(c)(3)** | A tax-exempt nonprofit organization as defined by the U.S. Internal Revenue Code |
| **EIN** | Employer Identification Number - a unique nine-digit number assigned by the IRS |
| **Uncleared Transaction** | A transaction that has been entered into the system but not yet verified against a bank statement |
| **Cleared Transaction** | A transaction that has been verified as appearing on a bank statement |
| **Reconciled Transaction** | A transaction that has been formally reconciled during a reconciliation process; locked from further editing |
| **Split Transaction** | A single transaction divided across multiple categories; the sum of all line items equals the transaction total |
| **Line Item** | An individual category allocation within a transaction; contains a category, amount, and optional memo |
| **Fiscal Year** | A 12-month period used for accounting purposes, which may differ from the calendar year |
| **Transaction Date** | The date the transaction actually occurred (e.g., the date on the check or receipt) |
| **Created Date** | The date and time the transaction was entered into the system |
| **Cleared Date** | The date and time the transaction status was changed from Uncleared to Cleared or Reconciled |

### 13.2 Sample Category Structure

**Income Categories:**
- Donations → Individual Donations
- Donations → Corporate Sponsors
- Fundraiser → Light Up Corydon
- Fundraiser → Annual Gala
- Fundraiser → Bake Sale
- Grants → State Grants
- Grants → Federal Grants
- Grants → Private Foundation
- Interest Income
- Membership Dues

**Expense Categories:**
- Operations → Office Supplies
- Operations → Utilities
- Operations → Rent
- Operations → Insurance
- Programs → Community Events
- Programs → Youth Programs
- Programs → Senior Services
- Fundraiser Expenses → Light Up Corydon
- Fundraiser Expenses → Annual Gala
- Administrative → Bank Fees
- Administrative → Software Subscriptions
- Administrative → Professional Services
- Administrative → Postage & Shipping

---

## 14. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 30, 2025 | - | Initial draft |
| 1.1 | January 30, 2025 | - | Updated transaction status to three states (Uncleared, Cleared, Reconciled); added transaction_date, created_at, and cleared_at date fields |
| 1.2 | January 30, 2025 | - | Added split transaction support with multiple category line items per transaction; updated TXN-008 (check number) to Must Have |

---

*End of Document*
