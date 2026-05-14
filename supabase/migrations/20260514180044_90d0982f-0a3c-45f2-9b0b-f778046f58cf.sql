
-- ============== ENUMS ==============
CREATE TYPE public.app_role AS ENUM (
  'super_admin','director_editorial','editor_media','editor_tech',
  'redactor','revisor','multimedia','analista','readonly'
);

CREATE TYPE public.vertical_slug AS ENUM ('news','media','tech');
CREATE TYPE public.article_status AS ENUM ('draft','review','scheduled','published','archived');
CREATE TYPE public.source_type AS ENUM ('original','external','sponsored');
CREATE TYPE public.live_status AS ENUM ('scheduled','active','paused','finished');
CREATE TYPE public.live_platform AS ENUM ('youtube','facebook','instagram','other');

-- ============== UTIL: updated_at ==============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  bio TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== USER ROLES ==============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============== SECURITY-DEFINER HELPERS ==============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id
    AND role IN ('super_admin','director_editorial','editor_media','editor_tech','redactor','revisor','multimedia','analista','readonly'))
$$;

CREATE OR REPLACE FUNCTION public.can_edit_vertical(_user_id UUID, _vertical public.vertical_slug)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND (
      role IN ('super_admin','director_editorial','redactor','revisor','multimedia')
      OR (role='editor_media' AND _vertical='media')
      OR (role='editor_tech' AND _vertical='tech')
    )
  )
$$;

-- ============== VERTICALS ==============
CREATE TABLE public.verticals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug public.vertical_slug NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  mission TEXT,
  vision TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0a0a0a',
  accent_color TEXT NOT NULL DEFAULT '#c9a84c',
  logo_url TEXT,
  seo_title TEXT,
  seo_description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.verticals ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_verticals_updated BEFORE UPDATE ON public.verticals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== SECTIONS ==============
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES public.verticals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  show_in_menu BOOLEAN NOT NULL DEFAULT true,
  show_in_home BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vertical_id, slug)
);
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sections_vertical ON public.sections(vertical_id);
CREATE TRIGGER trg_sections_updated BEFORE UPDATE ON public.sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== AUTHORS ==============
CREATE TABLE public.authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  email TEXT,
  twitter TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_authors_updated BEFORE UPDATE ON public.authors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== TAGS ==============
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- ============== MEDIA ==============
CREATE TABLE public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID REFERENCES public.verticals(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path TEXT,
  url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  width INT,
  height INT,
  alt_text TEXT,
  caption TEXT,
  kind TEXT NOT NULL DEFAULT 'image',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- ============== ARTICLES ==============
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES public.verticals(id) ON DELETE RESTRICT,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  author_id UUID REFERENCES public.authors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subtitle TEXT,
  summary TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_html TEXT,
  cover_image_url TEXT,
  cover_image_alt TEXT,
  gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_url TEXT,
  status public.article_status NOT NULL DEFAULT 'draft',
  source_type public.source_type NOT NULL DEFAULT 'original',
  external_url TEXT,
  external_source_name TEXT,
  is_breaking BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_week_main BOOLEAN NOT NULL DEFAULT false,
  is_sponsored BOOLEAN NOT NULL DEFAULT false,
  reading_time INT,
  views_count INT NOT NULL DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_articles_status ON public.articles(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_articles_vertical_pub ON public.articles(vertical_id, published_at DESC) WHERE status='published' AND deleted_at IS NULL;
CREATE INDEX idx_articles_section ON public.articles(section_id);
CREATE INDEX idx_articles_breaking ON public.articles(is_breaking, published_at DESC) WHERE is_breaking=true AND status='published';
CREATE INDEX idx_articles_search ON public.articles USING GIN(to_tsvector('spanish', coalesce(title,'')||' '||coalesce(subtitle,'')||' '||coalesce(summary,'')));
CREATE TRIGGER trg_articles_updated BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.article_tags (
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY(article_id, tag_id)
);
ALTER TABLE public.article_tags ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.article_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.article_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_article_versions ON public.article_versions(article_id, created_at DESC);

-- ============== LIVE STREAMS ==============
CREATE TABLE public.live_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID REFERENCES public.verticals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  platform public.live_platform NOT NULL DEFAULT 'youtube',
  stream_url TEXT NOT NULL,
  embed_url TEXT,
  cover_image_url TEXT,
  status public.live_status NOT NULL DEFAULT 'scheduled',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_live_status ON public.live_streams(status);
CREATE TRIGGER trg_live_updated BEFORE UPDATE ON public.live_streams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== SITE SETTINGS, ADS, AUDIT, SECURITY ==============
CREATE TABLE public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID REFERENCES public.verticals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  placement TEXT NOT NULL,
  image_url TEXT,
  link_url TEXT,
  html TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);

CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- ============== EXTERNAL SOURCES ==============
CREATE TABLE public.external_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.external_sources ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.external_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.external_sources(id) ON DELETE SET NULL,
  external_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  promoted_article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.external_imports ENABLE ROW LEVEL SECURITY;

-- ============== PROFILE AUTO-CREATE + FIRST ADMIN ==============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _user_count INT;
BEGIN
  INSERT INTO public.profiles(id, email, full_name, must_change_password)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, false)
  );
  SELECT count(*) INTO _user_count FROM auth.users;
  IF _user_count = 1 OR NEW.email = 'admin@zennews.cr' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'super_admin')
      ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET must_change_password = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============== RLS POLICIES ==============

-- PROFILES: usuario ve su propio perfil; super_admin ve todos
CREATE POLICY "own profile read" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admin insert profile" ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- USER_ROLES: solo super_admin gestiona; usuario ve sus propios roles
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "super admin manages roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- VERTICALS: público lee activas; super_admin/director gestionan
CREATE POLICY "public reads active verticals" ON public.verticals FOR SELECT
  USING (active = true OR public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial']::public.app_role[]));
CREATE POLICY "admins manage verticals" ON public.verticals FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial']::public.app_role[]));

-- SECTIONS
CREATE POLICY "public reads active sections" ON public.sections FOR SELECT
  USING (active = true OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage sections" ON public.sections FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial','editor_media','editor_tech']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial','editor_media','editor_tech']::public.app_role[]));

-- AUTHORS
CREATE POLICY "public reads active authors" ON public.authors FOR SELECT
  USING (active = true OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage authors" ON public.authors FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial','editor_media','editor_tech']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial','editor_media','editor_tech']::public.app_role[]));

-- TAGS
CREATE POLICY "public reads tags" ON public.tags FOR SELECT USING (true);
CREATE POLICY "admins manage tags" ON public.tags FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- MEDIA
CREATE POLICY "public reads media" ON public.media_assets FOR SELECT USING (true);
CREATE POLICY "admins manage media" ON public.media_assets FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ARTICLES
CREATE POLICY "public reads published articles" ON public.articles FOR SELECT
  USING ((status='published' AND deleted_at IS NULL AND (published_at IS NULL OR published_at <= now()))
    OR public.is_admin(auth.uid()));
CREATE POLICY "editors insert articles in their vertical" ON public.articles FOR INSERT
  WITH CHECK (
    public.can_edit_vertical(auth.uid(),
      (SELECT slug FROM public.verticals WHERE id = vertical_id))
  );
CREATE POLICY "editors update articles in their vertical" ON public.articles FOR UPDATE
  USING (
    public.can_edit_vertical(auth.uid(),
      (SELECT slug FROM public.verticals WHERE id = vertical_id))
  );
CREATE POLICY "super admin deletes articles" ON public.articles FOR DELETE
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial']::public.app_role[]));

-- ARTICLE TAGS / VERSIONS
CREATE POLICY "public reads article_tags" ON public.article_tags FOR SELECT USING (true);
CREATE POLICY "admins manage article_tags" ON public.article_tags FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins read versions" ON public.article_versions FOR SELECT
  USING (public.is_admin(auth.uid()));
CREATE POLICY "admins write versions" ON public.article_versions FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- LIVE
CREATE POLICY "public reads active live" ON public.live_streams FOR SELECT
  USING (status IN ('active','scheduled') OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage live" ON public.live_streams FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial','editor_media','editor_tech','multimedia']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial','editor_media','editor_tech','multimedia']::public.app_role[]));

-- SETTINGS / ADS
CREATE POLICY "public reads settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "super admin writes settings" ON public.site_settings FOR ALL
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "public reads ads" ON public.ads FOR SELECT USING (active=true OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage ads" ON public.ads FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- AUDIT / SECURITY: solo super_admin / director leen, insert por sistema (security definer)
CREATE POLICY "admins read audit" ON public.audit_logs FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial']::public.app_role[]));
CREATE POLICY "any auth inserts audit" ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admins read security" ON public.security_events FOR SELECT
  USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "any auth inserts security" ON public.security_events FOR INSERT
  WITH CHECK (true);

-- EXTERNAL
CREATE POLICY "admins manage sources" ON public.external_sources FOR ALL
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admins read sources" ON public.external_sources FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins manage imports" ON public.external_imports FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============== STORAGE BUCKET ==============
INSERT INTO storage.buckets (id, name, public) VALUES ('media','media', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public reads media bucket" ON storage.objects FOR SELECT
  USING (bucket_id = 'media');
CREATE POLICY "auth uploads media" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND auth.uid() IS NOT NULL);
CREATE POLICY "owners update media" ON storage.objects FOR UPDATE
  USING (bucket_id = 'media' AND auth.uid() = owner);
CREATE POLICY "owners delete media" ON storage.objects FOR DELETE
  USING (bucket_id = 'media' AND (auth.uid() = owner OR public.has_role(auth.uid(),'super_admin')));
