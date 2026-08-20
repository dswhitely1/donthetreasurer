-- Contact details for the person letters are signed by (e.g. the band director).
-- Stored on the organization so replacing the director is a single edit that
-- every letter template picks up automatically.
ALTER TABLE public.organizations
  ADD COLUMN director_name TEXT,
  ADD COLUMN director_title TEXT,
  ADD COLUMN director_email TEXT,
  ADD COLUMN director_phone TEXT;
