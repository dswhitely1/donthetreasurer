# Database Migrations

SQL queries to run in the Supabase SQL Editor to set up the Treasurer database schema.

Run these migrations in order. Each section is a separate migration step.

---

## Migration 1: Enable Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## Migration 2: Create Tables

```sql
-- Treasurers table (extends Supabase auth.users)
CREATE TABLE public.treasurers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  treasurer_id UUID NOT NULL REFERENCES public.treasurers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ein TEXT,
  fiscal_year_start_month INTEGER DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'paypal', 'cash', 'other')),
  description TEXT,
  opening_balance DECIMAL(12,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category_type TEXT NOT NULL CHECK (category_type IN ('income', 'expense')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  description TEXT NOT NULL,
  check_number TEXT,
  status TEXT NOT NULL DEFAULT 'uncleared' CHECK (status IN ('uncleared', 'cleared', 'reconciled')),
  cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction Line Items table
CREATE TABLE public.transaction_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Migration 3: Create Indexes

```sql
CREATE INDEX idx_organizations_treasurer ON public.organizations(treasurer_id);
CREATE INDEX idx_accounts_organization ON public.accounts(organization_id);
CREATE INDEX idx_categories_organization ON public.categories(organization_id);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);
CREATE INDEX idx_transactions_account_date ON public.transactions(account_id, transaction_date);
CREATE INDEX idx_transactions_status ON public.transactions(account_id, status);
CREATE INDEX idx_line_items_transaction ON public.transaction_line_items(transaction_id);
CREATE INDEX idx_line_items_category ON public.transaction_line_items(category_id);
```

---

## Migration 4: Enable Row Level Security

```sql
ALTER TABLE public.treasurers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_line_items ENABLE ROW LEVEL SECURITY;
```

---

## Migration 5: Create RLS Policies

```sql
CREATE POLICY "Users can view own treasurer profile" ON public.treasurers
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can access own organizations" ON public.organizations
  FOR ALL USING (treasurer_id = auth.uid());

CREATE POLICY "Users can access accounts in their organizations" ON public.accounts
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access categories in their organizations" ON public.categories
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access transactions in their accounts" ON public.transactions
  FOR ALL USING (
    account_id IN (
      SELECT a.id FROM public.accounts a
      JOIN public.organizations o ON a.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access line items in their transactions" ON public.transaction_line_items
  FOR ALL USING (
    transaction_id IN (
      SELECT t.id FROM public.transactions t
      JOIN public.accounts a ON t.account_id = a.id
      JOIN public.organizations o ON a.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );
```

---

## Migration 6: Create Functions and Triggers

```sql
-- Note: Line item sum validation (SUM(line_items.amount) = transaction.amount)
-- is enforced at the application level via Zod schema validation during
-- transaction creation and updates, not via database trigger.

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.treasurers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transaction_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Notes

- Run each migration in order in the **Supabase SQL Editor** (Dashboard > SQL Editor > New query).
- The `uuid-ossp` extension may already be enabled in your Supabase project. The `CREATE EXTENSION IF NOT EXISTS` statement is safe to run regardless.
- Line item sum validation (`SUM(line_items.amount) = transaction.amount`) is enforced at the application level via Zod schema validation, not via database trigger.
- RLS policies use `FOR ALL` which covers SELECT, INSERT, UPDATE, and DELETE operations. The `USING` clause applies to all operations, and Supabase Auth provides `auth.uid()` automatically from the JWT.
- The `treasurers` table references `auth.users`, so a row must exist in `auth.users` (via Supabase Auth signup) before inserting into `treasurers`.
