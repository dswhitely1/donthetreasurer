-- Migration: Budget Planning and Tracking
-- Supports budget creation with line items per category, budget vs. actuals comparison.

-- Budgets table
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT budgets_date_range CHECK (start_date < end_date),
  CONSTRAINT budgets_name_unique UNIQUE (organization_id, name)
);

-- Budget Line Items table
CREATE TABLE public.budget_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT budget_line_items_unique_category UNIQUE (budget_id, category_id)
);

-- Indexes
CREATE INDEX idx_budgets_organization ON public.budgets(organization_id);
CREATE INDEX idx_budgets_dates ON public.budgets(start_date, end_date);
CREATE INDEX idx_budget_line_items_budget ON public.budget_line_items(budget_id);
CREATE INDEX idx_budget_line_items_category ON public.budget_line_items(category_id);

-- Reuse existing updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.budget_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_line_items ENABLE ROW LEVEL SECURITY;

-- RLS policy: budgets scoped through organizations ownership chain
CREATE POLICY "Users can access budgets in their organizations"
  ON public.budgets
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

-- RLS policy: budget line items scoped through budgets -> organizations chain
CREATE POLICY "Users can access budget line items in their budgets"
  ON public.budget_line_items
  FOR ALL USING (
    budget_id IN (
      SELECT b.id FROM public.budgets b
      WHERE b.organization_id IN (
        SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
      )
    )
  );
