-- Letter templates now serve two audiences: families who owe season fees, and
-- sponsors who need a 501(c)(3) acknowledgment. Existing rows are all the
-- former, which the default backfills.
ALTER TABLE public.letter_templates
  ADD COLUMN template_type TEXT NOT NULL DEFAULT 'season_balance'
    CHECK (template_type IN ('season_balance', 'sponsor_acknowledgment'));

-- One default per TYPE, so an org can hold a default season letter and a
-- default sponsor letter at the same time.
DROP INDEX IF EXISTS public.idx_letter_templates_one_default;

CREATE UNIQUE INDEX idx_letter_templates_one_default
  ON public.letter_templates(organization_id, template_type)
  WHERE is_default;

CREATE INDEX idx_letter_templates_type
  ON public.letter_templates(organization_id, template_type);
