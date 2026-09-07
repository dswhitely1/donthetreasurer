-- Sponsors, configurable sponsorship levels, and the undeposited-payment queue.
ALTER TABLE public.organizations
  ADD COLUMN sponsors_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE public.sponsor_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (default_amount >= 0),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE TABLE public.sponsors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row is one sponsorship AND the single payment that created it.
-- The queue is exactly `transaction_id IS NULL`; there is deliberately no
-- status column and no deposited_at, because ON DELETE SET NULL can return a
-- row to the queue but cannot clear a companion timestamp beside it.
CREATE TABLE public.sponsorships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE RESTRICT,
  level_id UUID NOT NULL REFERENCES public.sponsor_levels(id) ON DELETE RESTRICT,
  term_start_date DATE NOT NULL,
  term_end_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'check', 'paypal', 'other')),
  check_number TEXT,
  received_date DATE NOT NULL,
  notes TEXT,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (term_start_date < term_end_date)
);

CREATE INDEX idx_sponsor_levels_organization ON public.sponsor_levels(organization_id);
CREATE INDEX idx_sponsors_organization ON public.sponsors(organization_id);
CREATE INDEX idx_sponsors_name ON public.sponsors(organization_id, name);
CREATE INDEX idx_sponsorships_sponsor ON public.sponsorships(sponsor_id);
CREATE INDEX idx_sponsorships_transaction ON public.sponsorships(transaction_id);
CREATE INDEX idx_sponsorships_queue ON public.sponsorships(sponsor_id) WHERE transaction_id IS NULL;
CREATE INDEX idx_sponsorships_term ON public.sponsorships(term_start_date, term_end_date);

ALTER TABLE public.sponsor_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access sponsor levels in their organizations" ON public.sponsor_levels
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access sponsors in their organizations" ON public.sponsors
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access sponsorships for their sponsors" ON public.sponsorships
  FOR ALL USING (
    sponsor_id IN (
      SELECT s.id FROM public.sponsors s
      JOIN public.organizations o ON s.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sponsor_levels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sponsors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sponsorships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
