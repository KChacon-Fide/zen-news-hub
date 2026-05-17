-- Operational seed for menus, editable blocks, live history, media library and pending imports.

WITH v AS (
  SELECT id, slug FROM public.verticals
),
menus AS (
  INSERT INTO public.navigation_menus(vertical_id, name, slug, location, active, sort_order)
  SELECT id, name, slug, location, true, sort_order
  FROM (
    SELECT id, 'ZEN NEWS Principal' AS name, 'zen-news-main' AS slug, 'header' AS location, 1 AS sort_order
    FROM v WHERE slug = 'news'
    UNION ALL
    SELECT id, 'ZEN MEDIA Principal', 'zen-media-main', 'header', 2
    FROM v WHERE slug = 'media'
    UNION ALL
    SELECT id, 'ZEN TECH Principal', 'zen-tech-main', 'header', 3
    FROM v WHERE slug = 'tech'
  ) seed
  ON CONFLICT (vertical_id, slug, location) DO UPDATE SET
    name = EXCLUDED.name,
    active = true,
    sort_order = EXCLUDED.sort_order
  RETURNING id, slug
)
INSERT INTO public.menu_items(menu_id, label, href, icon, active, sort_order)
SELECT menus.id, item.label, item.href, item.icon, true, item.sort_order
FROM menus
JOIN LATERAL (
  SELECT *
  FROM (
    VALUES
      ('zen-news-main','Inicio','/','home',1),
      ('zen-news-main','ZEN MEDIA','/media','newspaper',2),
      ('zen-news-main','ZEN TECH','/tech','cpu',3),
      ('zen-news-main','En vivo','/live','radio',4),
      ('zen-news-main','Videos','/videos','play',5),
      ('zen-news-main','Especiales','/especiales','book-open',6),
      ('zen-media-main','Ultima hora','/seccion/ultima-hora','zap',1),
      ('zen-media-main','Nacionales','/seccion/actualidad-nacional','landmark',2),
      ('zen-media-main','Internacionales','/seccion/internacionales','globe',3),
      ('zen-media-main','Politica','/seccion/politica','vote',4),
      ('zen-media-main','Deportes','/seccion/deportes','trophy',5),
      ('zen-media-main','Cultura','/seccion/cultura','palette',6),
      ('zen-tech-main','IA','/seccion/inteligencia-artificial','sparkles',1),
      ('zen-tech-main','Seguridad digital','/seccion/seguridad-digital','shield',2),
      ('zen-tech-main','Ciencia','/seccion/ciencia','atom',3),
      ('zen-tech-main','Startups','/seccion/startups','rocket',4),
      ('zen-tech-main','Gaming','/seccion/gaming','gamepad-2',5),
      ('zen-tech-main','Plataformas','/seccion/plataformas','layers',6)
  ) AS values(slug, label, href, icon, sort_order)
  WHERE values.slug = menus.slug
) item ON true
ON CONFLICT DO NOTHING;

WITH v AS (SELECT id, slug FROM public.verticals)
INSERT INTO public.page_blocks(vertical_id, page_key, block_key, title, body, config, active, sort_order)
SELECT v.id, seed.page_key, seed.block_key, seed.title, seed.body, seed.config::jsonb, true, seed.sort_order
FROM v
JOIN (
  VALUES
    ('news','home','hero-policy','Criterio editorial ZEN','Una portada madre que separa actualidad, tecnologia, anuncios y transmisiones con claridad editorial.','{"editable":true,"placement":"home"}',2),
    ('media','vertical-home','media-editorial-line','Linea editorial ZEN MEDIA','Actualidad nacional e internacional con contexto, verificacion y cercania humana.','{"editable":true,"tone":"periodistico"}',1),
    ('tech','vertical-home','tech-editorial-line','Linea editorial ZEN TECH','Tecnologia explicada desde utilidad, seguridad, criterio y decisiones concretas.','{"editable":true,"tone":"analitico"}',1),
    ('media','footer','media-footer','ZEN MEDIA','Periodismo veraz, oportuno y relevante para la audiencia.','{"editable":true}',2),
    ('tech','footer','tech-footer','ZEN TECH','IA, seguridad digital, ciencia e innovacion al servicio de las personas.','{"editable":true}',2)
) AS seed(vertical_slug, page_key, block_key, title, body, config, sort_order)
  ON seed.vertical_slug::public.vertical_slug = v.slug
ON CONFLICT (vertical_id, page_key, block_key) DO UPDATE SET
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  config = EXCLUDED.config,
  active = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

WITH v AS (SELECT id FROM public.verticals WHERE slug = 'news')
INSERT INTO public.live_streams(
  vertical_id, title, description, platform, stream_url, embed_url, cover_image_url,
  status, starts_at, ends_at, allow_live_button, display_label, embed_sanitized
)
SELECT
  v.id,
  'Prueba programada ZEN NEWS',
  'Transmision programada de ejemplo para validar el modulo en vivo y su historial.',
  'youtube',
  'https://www.youtube.com/watch?v=21X5lGlDOfg',
  'https://www.youtube.com/embed/21X5lGlDOfg',
  'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=1400&q=80',
  'scheduled',
  now() + interval '2 days',
  now() + interval '2 days 1 hour',
  false,
  'PROGRAMADO',
  true
FROM v
WHERE NOT EXISTS (SELECT 1 FROM public.live_streams WHERE title = 'Prueba programada ZEN NEWS');

WITH v AS (SELECT id, slug FROM public.verticals)
INSERT INTO public.media_assets(vertical_id, url, mime_type, size_bytes, alt_text, caption, kind)
SELECT v.id, seed.url, 'image/jpeg', 0, seed.alt_text, seed.caption, 'image'
FROM v
JOIN (
  VALUES
    ('media','https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80','Mesa editorial con periodicos','Imagen de referencia para ZEN MEDIA'),
    ('tech','https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80','Circuitos y tecnologia','Imagen de referencia para ZEN TECH'),
    ('news','https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1400&q=80','Redaccion de noticias','Imagen institucional ZEN NEWS')
) AS seed(vertical_slug, url, alt_text, caption)
  ON seed.vertical_slug::public.vertical_slug = v.slug
WHERE NOT EXISTS (SELECT 1 FROM public.media_assets WHERE media_assets.url = seed.url);

WITH source AS (
  INSERT INTO public.external_sources(name, kind, config, active)
  VALUES ('Google News RSS - Tecnologia', 'rss', '{"url":"https://news.google.com/rss/search?q=tecnologia&hl=es-419"}'::jsonb, false)
  ON CONFLICT DO NOTHING
  RETURNING id
),
fallback AS (
  SELECT id FROM source
  UNION ALL
  SELECT id FROM public.external_sources WHERE name = 'Google News RSS - Tecnologia' LIMIT 1
)
INSERT INTO public.external_imports(source_id, external_url, title, description, image_url, published_at, status, dedupe_hash)
SELECT
  fallback.id,
  'https://example.com/noticia-tecnologia-pendiente',
  'Titular externo pendiente de revision',
  'Ejemplo de import externo que un editor debe revisar antes de convertirlo en noticia propia.',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
  now(),
  'pending',
  'zen-news-example-import-tecnologia-pendiente'
FROM fallback
WHERE NOT EXISTS (
  SELECT 1 FROM public.external_imports WHERE external_url = 'https://example.com/noticia-tecnologia-pendiente'
);
