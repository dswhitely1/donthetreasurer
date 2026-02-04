-- Add feature toggle to existing organizations table
ALTER TABLE public.organizations
  ADD COLUMN seasons_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  guardian_name TEXT,
  guardian_email TEXT,
  guardian_phone TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seasons table
CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (fee_amount >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (start_date < end_date)
);

-- Season Enrollments table
CREATE TABLE public.season_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  fee_amount DECIMAL(12,2) NOT NULL CHECK (fee_amount >= 0),
  fee_override_reason TEXT,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'withdrawn')),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (season_id, student_id)
);

-- Season Payments table
CREATE TABLE public.season_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES public.season_enrollments(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_students_organization ON public.students(organization_id);
CREATE INDEX idx_students_name ON public.students(organization_id, last_name, first_name);
CREATE INDEX idx_seasons_organization ON public.seasons(organization_id);
CREATE INDEX idx_seasons_status ON public.seasons(organization_id, status);
CREATE INDEX idx_season_enrollments_season ON public.season_enrollments(season_id);
CREATE INDEX idx_season_enrollments_student ON public.season_enrollments(student_id);
CREATE INDEX idx_season_payments_enrollment ON public.season_payments(enrollment_id);
CREATE INDEX idx_season_payments_date ON public.season_payments(payment_date);

-- Row Level Security
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access students in their organizations" ON public.students
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access seasons in their organizations" ON public.seasons
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access enrollments in their seasons" ON public.season_enrollments
  FOR ALL USING (
    season_id IN (
      SELECT s.id FROM public.seasons s
      JOIN public.organizations o ON s.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );

CREATE POLICY "Users can access payments in their enrollments" ON public.season_payments
  FOR ALL USING (
    enrollment_id IN (
      SELECT se.id FROM public.season_enrollments se
      JOIN public.seasons s ON se.season_id = s.id
      JOIN public.organizations o ON s.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );

-- Updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.season_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.season_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
