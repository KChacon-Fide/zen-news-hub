-- Operational admin-user controls and external source hardening.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_sources_name_unique
  ON public.external_sources(name);

ALTER TABLE public.external_sources
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_external_sources_updated ON public.external_sources;
CREATE TRIGGER trg_external_sources_updated BEFORE UPDATE ON public.external_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
