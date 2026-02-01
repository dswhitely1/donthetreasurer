-- Migration: Row Level Security Policies
-- Enables RLS on all tables and creates policies enforcing the ownership chain:
-- Treasurer -> Organizations -> Accounts -> Transactions -> Line Items

-- Enable RLS
ALTER TABLE public.treasurers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_line_items ENABLE ROW LEVEL SECURITY;

-- Treasurers: users can only access their own profile
CREATE POLICY "Users can view own treasurer profile" ON public.treasurers
  FOR ALL USING (auth.uid() = id);

-- Organizations: treasurers can only access their own organizations
CREATE POLICY "Users can access own organizations" ON public.organizations
  FOR ALL USING (treasurer_id = auth.uid());

-- Accounts: access scoped to user's organizations
CREATE POLICY "Users can access accounts in their organizations" ON public.accounts
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

-- Categories: access scoped to user's organizations
CREATE POLICY "Users can access categories in their organizations" ON public.categories
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

-- Transactions: access scoped through accounts -> organizations ownership chain
CREATE POLICY "Users can access transactions in their accounts" ON public.transactions
  FOR ALL USING (
    account_id IN (
      SELECT a.id FROM public.accounts a
      JOIN public.organizations o ON a.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );

-- Line Items: access scoped through transactions -> accounts -> organizations chain
CREATE POLICY "Users can access line items in their transactions" ON public.transaction_line_items
  FOR ALL USING (
    transaction_id IN (
      SELECT t.id FROM public.transactions t
      JOIN public.accounts a ON t.account_id = a.id
      JOIN public.organizations o ON a.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );
