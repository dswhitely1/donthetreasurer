-- Migration: Reconciliation Sessions
-- Supports the bank reconciliation workflow: enter statement balance,
-- match transactions, verify difference = $0, then mark as reconciled.

CREATE TABLE public.reconciliation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  statement_date DATE NOT NULL,
  statement_ending_balance DECIMAL(12,2) NOT NULL,
  starting_balance DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  transaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reconciliation_sessions_account
  ON public.reconciliation_sessions(account_id);
CREATE INDEX idx_reconciliation_sessions_account_status
  ON public.reconciliation_sessions(account_id, status);

-- Reuse existing updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.reconciliation_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE public.reconciliation_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policy: access scoped through accounts -> organizations ownership chain
CREATE POLICY "Users can access reconciliation sessions in their accounts"
  ON public.reconciliation_sessions
  FOR ALL USING (
    account_id IN (
      SELECT a.id FROM public.accounts a
      JOIN public.organizations o ON a.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );
