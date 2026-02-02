-- Migration: Add template_id to transactions
-- Links generated transactions back to their recurring template source.

ALTER TABLE public.transactions
  ADD COLUMN template_id UUID REFERENCES public.recurring_templates(id) ON DELETE SET NULL;

-- Partial index for efficient lookups of template-generated transactions
CREATE INDEX idx_transactions_template
  ON public.transactions(template_id)
  WHERE template_id IS NOT NULL;
