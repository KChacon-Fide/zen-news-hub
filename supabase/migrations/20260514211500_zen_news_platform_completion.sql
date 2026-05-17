-- ZEN NEWS platform completion: RBAC catalog, missing CMS tables, seed data and RPC helpers.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ============== ARTICLE AND LIVE COMPLEMENTS ==============
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS cover_image_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS video_embed_url TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.live_streams
  ADD COLUMN IF NOT EXISTS allow_live_button BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_label TEXT NOT NULL DEFAULT 'EN VIVO',
  ADD COLUMN IF NOT EXISTS embed_sanitized BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_articles_featured
  ON public.articles(is_featured, published_at DESC)
  WHERE is_featured = true AND status = 'published' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_articles_sponsored
  ON public.articles(is_sponsored, published_at DESC)
  WHERE is_sponsored = true AND status = 'published' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_articles_views
  ON public.articles(views_count DESC, published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

-- ============== RBAC CATALOG ==============
CREATE TABLE IF NOT EXISTS public.admin_roles (
  role public.app_role PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL REFERENCES public.admin_roles(role) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.admin_permissions(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(role, permission_key)
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- ============== NAVIGATION, SETTINGS AND PAGE BLOCKS ==============
CREATE TABLE IF NOT EXISTS public.navigation_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID REFERENCES public.verticals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'header',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vertical_id, slug, location)
);
ALTER TABLE public.navigation_menus ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_navigation_menus_updated ON public.navigation_menus;
CREATE TRIGGER trg_navigation_menus_updated BEFORE UPDATE ON public.navigation_menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.navigation_menus(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  icon TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_menu_items_menu ON public.menu_items(menu_id, sort_order);
DROP TRIGGER IF EXISTS trg_menu_items_updated ON public.menu_items;
CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.page_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID REFERENCES public.verticals(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  block_key TEXT NOT NULL,
  title TEXT,
  body TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vertical_id, page_key, block_key)
);
ALTER TABLE public.page_blocks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_page_blocks_page ON public.page_blocks(page_key, sort_order);
DROP TRIGGER IF EXISTS trg_page_blocks_updated ON public.page_blocks;
CREATE TRIGGER trg_page_blocks_updated BEFORE UPDATE ON public.page_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== INTEGRATIONS AND IMPORT OPERATIONS ==============
CREATE TABLE IF NOT EXISTS public.api_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_env_key TEXT,
  last_checked_at TIMESTAMPTZ,
  last_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_api_integrations_updated ON public.api_integrations;
CREATE TRIGGER trg_api_integrations_updated BEFORE UPDATE ON public.api_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.external_imports
  ADD COLUMN IF NOT EXISTS dedupe_hash TEXT,
  ADD COLUMN IF NOT EXISTS vertical_id UUID REFERENCES public.verticals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_imports_url_unique
  ON public.external_imports(external_url);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_imports_dedupe
  ON public.external_imports(dedupe_hash)
  WHERE dedupe_hash IS NOT NULL;

-- ============== SESSIONS, LOCKS AND NEWSLETTER ==============
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_label TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON public.active_sessions(user_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.editorial_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(article_id)
);
ALTER TABLE public.editorial_locks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_editorial_locks_expires ON public.editorial_locks(expires_at);

CREATE TABLE IF NOT EXISTS public.newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  vertical_slug public.vertical_slug,
  consent BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'subscribed',
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

-- ============== INTERNAL EDITORIAL COMMENTS ==============
CREATE TABLE IF NOT EXISTS public.editorial_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE public.editorial_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_editorial_comments_article ON public.editorial_comments(article_id, created_at DESC);

-- ============== RPC HELPERS ==============
CREATE OR REPLACE FUNCTION public.increment_article_view(_slug TEXT)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.articles
  SET views_count = views_count + 1
  WHERE slug = _slug
    AND status = 'published'
    AND deleted_at IS NULL
    AND (published_at IS NULL OR published_at <= now());
$$;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action TEXT,
  _entity_type TEXT DEFAULT NULL,
  _entity_id UUID DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, _metadata)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- ============== RLS POLICIES FOR NEW TABLES ==============
DROP POLICY IF EXISTS "admins read admin_roles" ON public.admin_roles;
CREATE POLICY "admins read admin_roles" ON public.admin_roles FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "super admin manages admin_roles" ON public.admin_roles;
CREATE POLICY "super admin manages admin_roles" ON public.admin_roles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "admins read admin_permissions" ON public.admin_permissions;
CREATE POLICY "admins read admin_permissions" ON public.admin_permissions FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "super admin manages admin_permissions" ON public.admin_permissions;
CREATE POLICY "super admin manages admin_permissions" ON public.admin_permissions FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "admins read role_permissions" ON public.role_permissions;
CREATE POLICY "admins read role_permissions" ON public.role_permissions FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "super admin manages role_permissions" ON public.role_permissions;
CREATE POLICY "super admin manages role_permissions" ON public.role_permissions FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "public reads active menus" ON public.navigation_menus;
CREATE POLICY "public reads active menus" ON public.navigation_menus FOR SELECT
  USING (active = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins manage menus" ON public.navigation_menus;
CREATE POLICY "admins manage menus" ON public.navigation_menus FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial']::public.app_role[]));

DROP POLICY IF EXISTS "public reads active menu items" ON public.menu_items;
CREATE POLICY "public reads active menu items" ON public.menu_items FOR SELECT
  USING (active = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins manage menu items" ON public.menu_items;
CREATE POLICY "admins manage menu items" ON public.menu_items FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial']::public.app_role[]));

DROP POLICY IF EXISTS "public reads active page blocks" ON public.page_blocks;
CREATE POLICY "public reads active page blocks" ON public.page_blocks FOR SELECT
  USING (active = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins manage page blocks" ON public.page_blocks;
CREATE POLICY "admins manage page blocks" ON public.page_blocks FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','director_editorial']::public.app_role[]));

DROP POLICY IF EXISTS "super admin manages api integrations" ON public.api_integrations;
CREATE POLICY "super admin manages api integrations" ON public.api_integrations FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "admins read api integrations" ON public.api_integrations;
CREATE POLICY "admins read api integrations" ON public.api_integrations FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "own sessions or super admin" ON public.active_sessions;
CREATE POLICY "own sessions or super admin" ON public.active_sessions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "users insert own sessions" ON public.active_sessions;
CREATE POLICY "users insert own sessions" ON public.active_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own sessions" ON public.active_sessions;
CREATE POLICY "users update own sessions" ON public.active_sessions FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "admins manage editorial locks" ON public.editorial_locks;
CREATE POLICY "admins manage editorial locks" ON public.editorial_locks FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "public inserts newsletter" ON public.newsletters;
CREATE POLICY "public inserts newsletter" ON public.newsletters FOR INSERT
  WITH CHECK (consent = true);

DROP POLICY IF EXISTS "admins read newsletters" ON public.newsletters;
CREATE POLICY "admins read newsletters" ON public.newsletters FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins manage newsletters" ON public.newsletters;
CREATE POLICY "admins manage newsletters" ON public.newsletters FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins manage editorial comments" ON public.editorial_comments;
CREATE POLICY "admins manage editorial comments" ON public.editorial_comments FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============== SEED RBAC ==============
INSERT INTO public.admin_roles(role, label, description, sort_order) VALUES
  ('super_admin', 'Super Admin', 'Control total de plataforma, seguridad, usuarios, integraciones y configuracion global.', 1),
  ('director_editorial', 'Director Editorial', 'Gestion editorial completa en ambas verticales.', 2),
  ('editor_media', 'Editor ZEN MEDIA', 'Gestion editorial limitada a ZEN MEDIA.', 3),
  ('editor_tech', 'Editor ZEN TECH', 'Gestion editorial limitada a ZEN TECH.', 4),
  ('redactor', 'Redactor', 'Crea y edita borradores propios.', 5),
  ('revisor', 'Revisor', 'Revisa contenido antes de publicacion.', 6),
  ('multimedia', 'Multimedia', 'Gestiona biblioteca, videos y transmisiones.', 7),
  ('analista', 'Analista', 'Consulta metricas y contenido sin operar cambios criticos.', 8),
  ('readonly', 'Solo lectura', 'Acceso consultivo al panel.', 9)
ON CONFLICT (role) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.admin_permissions(key, label, module) VALUES
  ('content.create', 'Crear contenido', 'content'),
  ('content.edit_own', 'Editar contenido propio', 'content'),
  ('content.edit_any', 'Editar cualquier contenido', 'content'),
  ('content.publish', 'Publicar', 'content'),
  ('content.schedule', 'Programar', 'content'),
  ('content.archive', 'Archivar', 'content'),
  ('content.delete', 'Eliminar', 'content'),
  ('users.manage', 'Administrar usuarios', 'security'),
  ('verticals.manage', 'Administrar verticales', 'structure'),
  ('sections.manage', 'Administrar secciones', 'structure'),
  ('live.manage', 'Administrar en vivo', 'live'),
  ('media.manage', 'Administrar multimedia', 'media'),
  ('integrations.manage', 'Administrar integraciones', 'integrations'),
  ('logs.view', 'Ver logs', 'security'),
  ('settings.manage', 'Cambiar configuracion global', 'settings'),
  ('analytics.view', 'Ver metricas', 'analytics')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  module = EXCLUDED.module;

INSERT INTO public.role_permissions(role, permission_key)
SELECT 'super_admin'::public.app_role, key FROM public.admin_permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions(role, permission_key) VALUES
  ('director_editorial','content.create'), ('director_editorial','content.edit_any'), ('director_editorial','content.publish'),
  ('director_editorial','content.schedule'), ('director_editorial','content.archive'), ('director_editorial','verticals.manage'),
  ('director_editorial','sections.manage'), ('director_editorial','live.manage'), ('director_editorial','media.manage'),
  ('director_editorial','logs.view'), ('director_editorial','analytics.view'),
  ('editor_media','content.create'), ('editor_media','content.edit_any'), ('editor_media','content.publish'),
  ('editor_media','content.schedule'), ('editor_media','content.archive'), ('editor_media','sections.manage'),
  ('editor_media','live.manage'), ('editor_media','media.manage'),
  ('editor_tech','content.create'), ('editor_tech','content.edit_any'), ('editor_tech','content.publish'),
  ('editor_tech','content.schedule'), ('editor_tech','content.archive'), ('editor_tech','sections.manage'),
  ('editor_tech','live.manage'), ('editor_tech','media.manage'),
  ('redactor','content.create'), ('redactor','content.edit_own'),
  ('revisor','content.edit_any'), ('revisor','content.archive'),
  ('multimedia','media.manage'), ('multimedia','live.manage'),
  ('analista','analytics.view'),
  ('readonly','analytics.view')
ON CONFLICT DO NOTHING;

-- ============== SEED VERTICALS ==============
INSERT INTO public.verticals(slug, name, tagline, description, mission, vision, primary_color, accent_color, sort_order, seo_title, seo_description)
VALUES
  ('news', 'ZEN NEWS', 'Empresa madre', 'Portal madre que integra periodismo, tecnologia y cultura digital.', 'Integrar tecnologia y periodismo para consolidar una empresa referente a nivel nacional e internacional, transformando la informacion en conocimiento estrategico.', 'Posicionar a la empresa entre las mejores en facilitar informacion tecnologica y periodistica.', '#111827', '#c9a84c', 1, 'ZEN NEWS', 'ZEN NEWS integra ZEN MEDIA y ZEN TECH en una sola plataforma editorial.'),
  ('media', 'ZEN MEDIA', 'Actualidad con rigor', 'Periodismo humano, claro y dinamico sobre actualidad nacional e internacional.', 'Alcanzar el reconocimiento como un medio informativo referente por su rigor, credibilidad e innovacion.', 'Brindar periodismo de calidad sobre la actualidad nacional e internacional, con informacion veridica, analisis oportuno y contenidos relevantes para la audiencia.', '#7f1d1d', '#dc2626', 2, 'ZEN MEDIA', 'Actualidad, cultura, deporte, opinion y reportajes de ZEN MEDIA.'),
  ('tech', 'ZEN TECH', 'Tecnologia util', 'IA, ciencia, ciberseguridad, startups e innovacion explicadas para tomar mejores decisiones.', 'Impulsar a las personas a usar la tecnologia sin que esta las use a ellas, traduciendo el ruido en decisiones concretas.', 'Promover que la tecnologia deje de ser territorio de especialistas y vuelva a ser una herramienta al servicio de las personas. Ser la voz que pregunta antes de comprar, instalar o creer.', '#0f172a', '#0284c7', 3, 'ZEN TECH', 'IA, seguridad digital, ciencia, startups e innovacion de ZEN TECH.')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  mission = EXCLUDED.mission,
  vision = EXCLUDED.vision,
  primary_color = EXCLUDED.primary_color,
  accent_color = EXCLUDED.accent_color,
  sort_order = EXCLUDED.sort_order,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description,
  active = true;

-- ============== SEED SECTIONS ==============
WITH media AS (SELECT id FROM public.verticals WHERE slug = 'media'),
tech AS (SELECT id FROM public.verticals WHERE slug = 'tech'),
media_sections(name, slug, sort_order) AS (
  VALUES
    ('Ultima hora','ultima-hora',1), ('Actualidad Nacional','actualidad-nacional',2), ('Educacion','educacion',3),
    ('Salud','salud',4), ('Trabajo','trabajo',5), ('Infraestructura','infraestructura',6),
    ('Internacionales','internacionales',7), ('Politica','politica',8), ('Sucesos','sucesos',9),
    ('Economia','economia',10), ('Entretenimiento','entretenimiento',11), ('Opinion','opinion',12),
    ('Deportes','deportes',13), ('Reportajes','reportajes',14), ('Tecnologia','tecnologia',15),
    ('Moda','moda',16), ('Salud mental','salud-mental',17), ('Cultura','cultura',18),
    ('Anuncios','anuncios',19), ('Lo que debes saber hoy','lo-que-debes-saber-hoy',20),
    ('Temas explicados','temas-explicados',21), ('Artisticas y conciertos','artisticas-y-conciertos',22),
    ('Seccion especial','seccion-especial',23), ('Entrevistas','entrevistas',24),
    ('Reportajes especiales','reportajes-especiales',25)
),
tech_sections(name, slug, sort_order) AS (
  VALUES
    ('Inteligencia artificial','inteligencia-artificial',1), ('Ciencia','ciencia',2), ('Tendencias','tendencias',3),
    ('Seguridad digital','seguridad-digital',4), ('Robotica','robotica',5), ('Realidad virtual','realidad-virtual',6),
    ('Startups','startups',7), ('Economia digital','economia-digital',8), ('Tecnologia verde','tecnologia-verde',9),
    ('Mercado tecnologico','mercado-tecnologico',10), ('Entretenimiento digital','entretenimiento-digital',11),
    ('Innovacion','innovacion',12), ('Plataformas','plataformas',13), ('Movilidad','movilidad',14),
    ('Conectividad','conectividad',15), ('Gaming','gaming',16), ('Anuncios','anuncios',17),
    ('Creatividad digital','creatividad-digital',18), ('Educacion digital','educacion-digital',19)
)
INSERT INTO public.sections(vertical_id, name, slug, sort_order, color, show_in_menu, show_in_home, active)
SELECT media.id, media_sections.name, media_sections.slug, media_sections.sort_order, '#dc2626', true, true, true
FROM media, media_sections
ON CONFLICT (vertical_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  color = EXCLUDED.color,
  active = true;

WITH tech AS (SELECT id FROM public.verticals WHERE slug = 'tech'),
tech_sections(name, slug, sort_order) AS (
  VALUES
    ('Inteligencia artificial','inteligencia-artificial',1), ('Ciencia','ciencia',2), ('Tendencias','tendencias',3),
    ('Seguridad digital','seguridad-digital',4), ('Robotica','robotica',5), ('Realidad virtual','realidad-virtual',6),
    ('Startups','startups',7), ('Economia digital','economia-digital',8), ('Tecnologia verde','tecnologia-verde',9),
    ('Mercado tecnologico','mercado-tecnologico',10), ('Entretenimiento digital','entretenimiento-digital',11),
    ('Innovacion','innovacion',12), ('Plataformas','plataformas',13), ('Movilidad','movilidad',14),
    ('Conectividad','conectividad',15), ('Gaming','gaming',16), ('Anuncios','anuncios',17),
    ('Creatividad digital','creatividad-digital',18), ('Educacion digital','educacion-digital',19)
)
INSERT INTO public.sections(vertical_id, name, slug, sort_order, color, show_in_menu, show_in_home, active)
SELECT tech.id, tech_sections.name, tech_sections.slug, tech_sections.sort_order, '#0284c7', true, true, true
FROM tech, tech_sections
ON CONFLICT (vertical_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  color = EXCLUDED.color,
  active = true;

-- ============== SEED AUTHORS, TAGS, ARTICLES ==============
INSERT INTO public.authors(name, slug, bio, email, active)
VALUES
  ('Redaccion ZEN NEWS', 'redaccion-zen-news', 'Equipo editorial central de ZEN NEWS.', 'redaccion@zennews.cr', true),
  ('Mesa ZEN MEDIA', 'mesa-zen-media', 'Equipo de actualidad, cultura y reportajes de ZEN MEDIA.', 'media@zennews.cr', true),
  ('Mesa ZEN TECH', 'mesa-zen-tech', 'Equipo de tecnologia, IA y seguridad digital de ZEN TECH.', 'tech@zennews.cr', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  bio = EXCLUDED.bio,
  email = EXCLUDED.email,
  active = true;

INSERT INTO public.tags(name, slug)
VALUES
  ('ZEN NEWS','zen-news'), ('Costa Rica','costa-rica'), ('IA','ia'), ('Ciberseguridad','ciberseguridad'),
  ('Actualidad','actualidad'), ('Innovacion','innovacion'), ('Reportajes','reportajes'), ('Opinion','opinion')
ON CONFLICT (slug) DO NOTHING;

WITH
media_v AS (SELECT id FROM public.verticals WHERE slug = 'media'),
tech_v AS (SELECT id FROM public.verticals WHERE slug = 'tech'),
media_author AS (SELECT id FROM public.authors WHERE slug = 'mesa-zen-media'),
tech_author AS (SELECT id FROM public.authors WHERE slug = 'mesa-zen-tech'),
news_author AS (SELECT id FROM public.authors WHERE slug = 'redaccion-zen-news')
INSERT INTO public.articles(
  vertical_id, section_id, author_id, title, slug, subtitle, summary, content, content_html,
  cover_image_url, cover_image_alt, status, source_type, is_breaking, is_featured, is_week_main,
  is_sponsored, published_at, seo_title, seo_description, reading_time
)
VALUES
  (
    (SELECT id FROM media_v),
    (SELECT id FROM public.sections WHERE slug = 'actualidad-nacional' AND vertical_id = (SELECT id FROM media_v)),
    (SELECT id FROM media_author),
    'Costa Rica entra en una semana clave de decisiones publicas',
    'costa-rica-semana-clave-decisiones-publicas',
    'Instituciones, comunidades y sector privado miran una agenda marcada por infraestructura, educacion y empleo.',
    'Un recorrido editorial por los temas que explican el pulso nacional de la semana.',
    '{"type":"doc"}'::jsonb,
    '<p>ZEN MEDIA abre la jornada con una lectura amplia del contexto nacional: infraestructura, educacion, salud y empleo vuelven al centro de la conversacion publica.</p><p>La cobertura prioriza datos verificables, voces de comunidades y el impacto cotidiano de las decisiones institucionales.</p>',
    'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1400&q=80',
    'Vista urbana de una capital latinoamericana',
    'published','original',true,true,true,false, now() - interval '2 hours',
    'Costa Rica entra en una semana clave de decisiones publicas',
    'Actualidad nacional con contexto y verificacion de ZEN MEDIA.',
    4
  ),
  (
    (SELECT id FROM tech_v),
    (SELECT id FROM public.sections WHERE slug = 'inteligencia-artificial' AND vertical_id = (SELECT id FROM tech_v)),
    (SELECT id FROM tech_author),
    'La IA deja de ser promesa y entra en la oficina diaria',
    'ia-oficina-diaria-decisiones-concretas',
    'Herramientas de automatizacion, busqueda y analisis ya cambian tareas comunes en pequenas y grandes organizaciones.',
    'ZEN TECH explica como adoptar IA sin perder criterio, privacidad ni control humano.',
    '{"type":"doc"}'::jsonb,
    '<p>La inteligencia artificial ya no vive solo en laboratorios o presentaciones corporativas. Aparece en correos, hojas de calculo, soporte, analisis de documentos y decisiones operativas.</p><p>La pregunta editorial no es si usarla, sino como hacerlo con seguridad, proposito y supervision humana.</p>',
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1400&q=80',
    'Interfaz abstracta de inteligencia artificial',
    'published','original',false,true,true,false, now() - interval '3 hours',
    'La IA entra en la oficina diaria',
    'Analisis de ZEN TECH sobre adopcion responsable de inteligencia artificial.',
    5
  ),
  (
    (SELECT id FROM tech_v),
    (SELECT id FROM public.sections WHERE slug = 'seguridad-digital' AND vertical_id = (SELECT id FROM tech_v)),
    (SELECT id FROM tech_author),
    'Cinco senales de que una cuenta puede estar comprometida',
    'cinco-senales-cuenta-comprometida',
    'Pequenos cambios en actividad, dispositivos y mensajes pueden revelar un riesgo antes de que sea tarde.',
    'Guia practica para detectar actividad sospechosa y actuar con calma.',
    '{"type":"doc"}'::jsonb,
    '<p>Una alerta de inicio de sesion, mensajes enviados sin permiso o cambios en metodos de recuperacion son senales que no conviene ignorar.</p><p>La respuesta recomendada empieza por cambiar contrasenas, cerrar sesiones abiertas y activar autenticacion multifactor.</p>',
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1400&q=80',
    'Persona revisando seguridad digital',
    'published','original',false,true,false,false, now() - interval '7 hours',
    'Cinco senales de una cuenta comprometida',
    'Consejos de seguridad digital de ZEN TECH.',
    3
  ),
  (
    (SELECT id FROM media_v),
    (SELECT id FROM public.sections WHERE slug = 'reportajes-especiales' AND vertical_id = (SELECT id FROM media_v)),
    (SELECT id FROM media_author),
    'El trabajo que no se ve detras de una noticia verificada',
    'trabajo-detras-noticia-verificada',
    'Reportaje especial sobre fuentes, contraste, edicion y responsabilidad editorial.',
    'Una mirada interna al proceso que separa informacion util de ruido.',
    '{"type":"doc"}'::jsonb,
    '<p>Verificar una noticia no es un gesto final: es una cadena de decisiones. Implica preguntar, contrastar, revisar documentos, escuchar a partes involucradas y reconocer lo que aun no se sabe.</p><p>ZEN MEDIA asume ese proceso como parte central de su identidad editorial.</p>',
    'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80',
    'Periodicos y herramientas de redaccion',
    'published','original',false,true,false,false, now() - interval '1 day',
    'El trabajo detras de una noticia verificada',
    'Reportaje especial de ZEN MEDIA sobre rigor editorial.',
    6
  ),
  (
    (SELECT id FROM media_v),
    (SELECT id FROM public.sections WHERE slug = 'anuncios' AND vertical_id = (SELECT id FROM media_v)),
    (SELECT id FROM news_author),
    'ZEN NEWS abre espacios de contenido patrocinado responsable',
    'zen-news-contenido-patrocinado-responsable',
    'La plataforma separa con claridad publicidad, alianzas y contenido editorial.',
    'Nueva politica comercial para anuncios identificados y seguros.',
    '{"type":"doc"}'::jsonb,
    '<p>ZEN NEWS habilita espacios de contenido patrocinado con etiquetado visible, revision editorial y separacion clara entre publicidad e informacion periodistica.</p>',
    'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1400&q=80',
    'Equipo revisando una estrategia editorial',
    'published','sponsored',false,false,false,true, now() - interval '2 days',
    'Contenido patrocinado responsable',
    'Politica de anuncios y patrocinios de ZEN NEWS.',
    2
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  summary = EXCLUDED.summary,
  content_html = EXCLUDED.content_html,
  cover_image_url = EXCLUDED.cover_image_url,
  cover_image_alt = EXCLUDED.cover_image_alt,
  status = EXCLUDED.status,
  is_breaking = EXCLUDED.is_breaking,
  is_featured = EXCLUDED.is_featured,
  is_week_main = EXCLUDED.is_week_main,
  is_sponsored = EXCLUDED.is_sponsored,
  published_at = EXCLUDED.published_at,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description,
  reading_time = EXCLUDED.reading_time;

-- ============== SEED SETTINGS, ADS, INTEGRATIONS, BLOCKS ==============
INSERT INTO public.site_settings(key, value)
VALUES
  ('global', '{"siteName":"ZEN NEWS","country":"Costa Rica","maintenance":false,"seo":{"title":"ZEN NEWS","description":"Periodismo y tecnologia para comprender una sola realidad."},"social":{"facebook":"","instagram":"","youtube":"","x":""},"contact":{"email":"contacto@zennews.cr"}}'::jsonb),
  ('security', '{"maxUploadMb":10,"allowedImageTypes":["image/jpeg","image/png","image/webp"],"mfaPrepared":true,"failedLoginLimit":5}'::jsonb),
  ('newsletter', '{"enabled":true,"headline":"Recibe el pulso de ZEN NEWS","description":"Titulares clave de ZEN MEDIA y ZEN TECH."}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

WITH news AS (SELECT id FROM public.verticals WHERE slug = 'news')
INSERT INTO public.ads(vertical_id, name, placement, image_url, link_url, active)
SELECT news.id, 'Patrocinio portada institucional', 'home_sidebar', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80', '/anuncios', true
FROM news
ON CONFLICT DO NOTHING;

INSERT INTO public.api_integrations(provider, label, enabled, config, secret_env_key, last_status)
VALUES
  ('feedly', 'Feedly API', false, '{"mode":"api","requiresReview":true}'::jsonb, 'FEEDLY_API_KEY', 'not_configured'),
  ('newsapi', 'NewsAPI', false, '{"mode":"api","requiresReview":true}'::jsonb, 'NEWSAPI_KEY', 'not_configured'),
  ('google-news-rss', 'Google News RSS autorizado', false, '{"mode":"rss","requiresReview":true}'::jsonb, null, 'not_configured'),
  ('flipboard-rss', 'Flipboard RSS', false, '{"mode":"rss","requiresReview":true}'::jsonb, null, 'not_configured'),
  ('ground-news-rss', 'Ground News autorizado', false, '{"mode":"rss","requiresReview":true}'::jsonb, null, 'not_configured')
ON CONFLICT (provider) DO UPDATE SET
  label = EXCLUDED.label,
  config = EXCLUDED.config,
  secret_env_key = EXCLUDED.secret_env_key;

WITH news AS (SELECT id FROM public.verticals WHERE slug = 'news')
INSERT INTO public.page_blocks(vertical_id, page_key, block_key, title, body, config, active, sort_order)
SELECT news.id, 'home', 'what-to-know', 'Lo que debes saber hoy', 'Actualidad verificada y tecnologia util, reunidas en una sola lectura editorial.', '{"layout":"ticker"}'::jsonb, true, 1
FROM news
ON CONFLICT (vertical_id, page_key, block_key) DO UPDATE SET
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  config = EXCLUDED.config,
  active = true,
  updated_at = now();
