-- Migration: Recurring Templates
-- Supports recurring transaction templates with configurable recurrence rules.

-- Recurring Templates table
CREATE TABLE public.recurring_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  vendor TEXT,
  check_number TEXT,
  recurrence_rule TEXT NOT NULL CHECK (recurrence_rule IN ('weekly', 'bi-weekly', 'monthly', 'quarterly', 'annually')),
  start_date DATE NOT NULL,
  end_date DATE,
  next_occurrence_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recurring Template Line Items table
CREATE TABLE public.recurring_template_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.recurring_templates(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recurring_templates_account ON public.recurring_templates(account_id);
CREATE INDEX idx_recurring_templates_organization ON public.recurring_templates(organization_id);
CREATE INDEX idx_recurring_templates_next_occurrence
  ON public.recurring_templates(next_occurrence_date)
  WHERE is_active = TRUE;
CREATE INDEX idx_recurring_template_line_items_template
  ON public.recurring_template_line_items(template_id);

-- Reuse existing updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.recurring_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.recurring_template_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE public.recurring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_template_line_items ENABLE ROW LEVEL SECURITY;

-- RLS policy: templates scoped through organizations ownership chain
CREATE POLICY "Users can access recurring templates in their organizations"
  ON public.recurring_templates
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

-- RLS policy: template line items scoped through templates -> organizations chain
CREATE POLICY "Users can access recurring template line items in their templates"
  ON public.recurring_template_line_items
  FOR ALL USING (
    template_id IN (
      SELECT rt.id FROM public.recurring_templates rt
      WHERE rt.organization_id IN (
        SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
      )
    )
  );
