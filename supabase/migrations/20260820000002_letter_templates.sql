-- Reusable letter templates for notifying families of outstanding season fees.
CREATE TABLE public.letter_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  heading TEXT,
  body TEXT NOT NULL,
  closing TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX idx_letter_templates_organization
  ON public.letter_templates(organization_id);

-- At most one default template per organization.
CREATE UNIQUE INDEX idx_letter_templates_one_default
  ON public.letter_templates(organization_id)
  WHERE is_default;

ALTER TABLE public.letter_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access letter templates in their organizations"
  ON public.letter_templates
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE treasurer_id = auth.uid()
    )
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.letter_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
