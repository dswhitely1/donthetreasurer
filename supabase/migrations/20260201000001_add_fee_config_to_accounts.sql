-- Add processing fee configuration columns to accounts
ALTER TABLE public.accounts
  ADD COLUMN fee_percentage DECIMAL(5,4) CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
  ADD COLUMN fee_flat_amount DECIMAL(12,2) CHECK (fee_flat_amount >= 0),
  ADD COLUMN fee_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Index for the FK (only on rows that have a fee category set)
CREATE INDEX idx_accounts_fee_category ON public.accounts(fee_category_id) WHERE fee_category_id IS NOT NULL;
