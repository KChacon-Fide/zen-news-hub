-- Google News RSS only flow for external editorial intake.

ALTER TABLE public.external_imports
  ADD COLUMN IF NOT EXISTS original_url TEXT,
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS normalized_title TEXT,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

UPDATE public.external_imports
SET
  original_url = COALESCE(original_url, external_url),
  normalized_title = COALESCE(normalized_title, lower(trim(title)))
WHERE original_url IS NULL OR normalized_title IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_imports_original_url_unique
  ON public.external_imports(original_url)
  WHERE original_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_external_imports_source_title
  ON public.external_imports(source_id, normalized_title)
  WHERE normalized_title IS NOT NULL;

UPDATE public.external_sources
SET active = false
WHERE kind <> 'google_news';

INSERT INTO public.external_sources(name, kind, config, active)
VALUES
  ('Google News - ZEN NEWS General', 'google_news', '{"url":"https://news.google.com/rss?hl=es-419&gl=CR&ceid=CR:es-419","scope":"news","vertical_slug":"news","section_slug":null,"env_key":"GOOGLE_NEWS_RSS_GENERAL"}'::jsonb, true),
  ('Google News - Media Nacional', 'google_news', '{"url":"https://news.google.com/rss/search?q=Costa%20Rica&hl=es-419&gl=CR&ceid=CR:es-419","scope":"media","vertical_slug":"media","section_slug":"actualidad-nacional","env_key":"GOOGLE_NEWS_RSS_MEDIA_NACIONAL"}'::jsonb, true),
  ('Google News - Media Politica', 'google_news', '{"url":"https://news.google.com/rss/search?q=politica%20Costa%20Rica&hl=es-419&gl=CR&ceid=CR:es-419","scope":"media","vertical_slug":"media","section_slug":"politica","env_key":"GOOGLE_NEWS_RSS_MEDIA_POLITICA"}'::jsonb, true),
  ('Google News - Media Economia', 'google_news', '{"url":"https://news.google.com/rss/search?q=economia%20Costa%20Rica&hl=es-419&gl=CR&ceid=CR:es-419","scope":"media","vertical_slug":"media","section_slug":"economia","env_key":"GOOGLE_NEWS_RSS_MEDIA_ECONOMIA"}'::jsonb, true),
  ('Google News - Media Sucesos', 'google_news', '{"url":"https://news.google.com/rss/search?q=sucesos%20Costa%20Rica&hl=es-419&gl=CR&ceid=CR:es-419","scope":"media","vertical_slug":"media","section_slug":"sucesos","env_key":"GOOGLE_NEWS_RSS_MEDIA_SUCESOS"}'::jsonb, true),
  ('Google News - Media Deportes', 'google_news', '{"url":"https://news.google.com/rss/search?q=deportes%20Costa%20Rica&hl=es-419&gl=CR&ceid=CR:es-419","scope":"media","vertical_slug":"media","section_slug":"deportes","env_key":"GOOGLE_NEWS_RSS_MEDIA_DEPORTES"}'::jsonb, true),
  ('Google News - Media Entretenimiento', 'google_news', '{"url":"https://news.google.com/rss/search?q=entretenimiento%20Costa%20Rica&hl=es-419&gl=CR&ceid=CR:es-419","scope":"media","vertical_slug":"media","section_slug":"entretenimiento","env_key":"GOOGLE_NEWS_RSS_MEDIA_ENTRETENIMIENTO"}'::jsonb, true),
  ('Google News - Media Cultura', 'google_news', '{"url":"https://news.google.com/rss/search?q=cultura%20Costa%20Rica&hl=es-419&gl=CR&ceid=CR:es-419","scope":"media","vertical_slug":"media","section_slug":"cultura","env_key":"GOOGLE_NEWS_RSS_MEDIA_CULTURA"}'::jsonb, true),
  ('Google News - Media Salud', 'google_news', '{"url":"https://news.google.com/rss/search?q=salud%20Costa%20Rica&hl=es-419&gl=CR&ceid=CR:es-419","scope":"media","vertical_slug":"media","section_slug":"salud","env_key":"GOOGLE_NEWS_RSS_MEDIA_SALUD"}'::jsonb, true),
  ('Google News - Tech General', 'google_news', '{"url":"https://news.google.com/rss/search?q=tecnologia&hl=es-419&gl=CR&ceid=CR:es-419","scope":"tech","vertical_slug":"tech","section_slug":"tendencias","env_key":"GOOGLE_NEWS_RSS_TECH_GENERAL"}'::jsonb, true),
  ('Google News - Tech IA', 'google_news', '{"url":"https://news.google.com/rss/search?q=inteligencia%20artificial&hl=es-419&gl=CR&ceid=CR:es-419","scope":"tech","vertical_slug":"tech","section_slug":"inteligencia-artificial","env_key":"GOOGLE_NEWS_RSS_TECH_IA"}'::jsonb, true),
  ('Google News - Tech Ciberseguridad', 'google_news', '{"url":"https://news.google.com/rss/search?q=ciberseguridad&hl=es-419&gl=CR&ceid=CR:es-419","scope":"tech","vertical_slug":"tech","section_slug":"seguridad-digital","env_key":"GOOGLE_NEWS_RSS_TECH_CIBERSEGURIDAD"}'::jsonb, true),
  ('Google News - Tech Startups', 'google_news', '{"url":"https://news.google.com/rss/search?q=startups%20tecnologia&hl=es-419&gl=CR&ceid=CR:es-419","scope":"tech","vertical_slug":"tech","section_slug":"startups","env_key":"GOOGLE_NEWS_RSS_TECH_STARTUPS"}'::jsonb, true),
  ('Google News - Tech Ciencia', 'google_news', '{"url":"https://news.google.com/rss/search?q=ciencia%20tecnologia&hl=es-419&gl=CR&ceid=CR:es-419","scope":"tech","vertical_slug":"tech","section_slug":"ciencia","env_key":"GOOGLE_NEWS_RSS_TECH_CIENCIA"}'::jsonb, true),
  ('Google News - Tech Gaming', 'google_news', '{"url":"https://news.google.com/rss/search?q=gaming%20tecnologia&hl=es-419&gl=CR&ceid=CR:es-419","scope":"tech","vertical_slug":"tech","section_slug":"gaming","env_key":"GOOGLE_NEWS_RSS_TECH_GAMING"}'::jsonb, true),
  ('Google News - Tech Robotica', 'google_news', '{"url":"https://news.google.com/rss/search?q=robotica&hl=es-419&gl=CR&ceid=CR:es-419","scope":"tech","vertical_slug":"tech","section_slug":"robotica","env_key":"GOOGLE_NEWS_RSS_TECH_ROBOTICA"}'::jsonb, true),
  ('Google News - Tech Innovacion', 'google_news', '{"url":"https://news.google.com/rss/search?q=innovacion%20tecnologica&hl=es-419&gl=CR&ceid=CR:es-419","scope":"tech","vertical_slug":"tech","section_slug":"innovacion","env_key":"GOOGLE_NEWS_RSS_TECH_INNOVACION"}'::jsonb, true)
ON CONFLICT (name) DO UPDATE
SET kind = EXCLUDED.kind,
    config = EXCLUDED.config,
    active = EXCLUDED.active;

UPDATE public.api_integrations
SET enabled = false, last_status = 'disabled_google_news_only'
WHERE provider IN ('feedly','newsapi','flipboard','ground-news');

INSERT INTO public.api_integrations(provider, label, enabled, config, secret_env_key, last_status)
VALUES ('google-news-rss-flow', 'Google News RSS ZEN NEWS', true, '{"mode":"rss","requiresReview":true,"autoPublish":false}'::jsonb, null, 'configured')
ON CONFLICT (provider) DO UPDATE
SET enabled = true,
    config = EXCLUDED.config,
    secret_env_key = null,
    last_status = 'configured';
