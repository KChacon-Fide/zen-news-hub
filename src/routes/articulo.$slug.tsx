import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Facebook, Linkedin, Mail, Share2 } from "lucide-react";

import { ArticleCard } from "@/components/ArticleCard";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getArticle } from "@/lib/news.functions";
import { deriveYouTubeEmbedUrl, isAllowedIframeUrl, isLikelyVideoFileUrl } from "@/lib/security";

export const Route = createFileRoute("/articulo/$slug")({
  loader: async ({ params }) => {
    const data = await getArticle({ data: { slug: params.slug } });
    if (!data.article) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.article?.seo_title ?? loaderData?.article?.title ?? "Articulo"} - ZEN NEWS`,
      },
      {
        name: "description",
        content: loaderData?.article?.seo_description ?? loaderData?.article?.summary ?? "",
      },
      { property: "og:title", content: loaderData?.article?.title ?? "ZEN NEWS" },
      { property: "og:description", content: loaderData?.article?.summary ?? "" },
      { property: "og:image", content: loaderData?.article?.cover_image_url ?? "" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArticlePage,
  notFoundComponent: () => <div className="p-20 text-center">Noticia no encontrada</div>,
});

function ArticlePage() {
  const { article, related, tags } = Route.useLoaderData();
  if (!article) return null;

  const vertical = article.verticals as any;
  const section = article.sections as any;
  const author = article.authors as any;
  const siteUrl = "https://zen-news-hub.kchacon20525.workers.dev";
  const shareUrl = `/articulo/${article.slug}`;
  const absoluteShareUrl = `${siteUrl}${shareUrl}`;
  const encodedShare = encodeURIComponent(absoluteShareUrl);
  const gallery = Array.isArray(article.gallery) ? article.gallery : [];
  const videoEmbed = article.video_embed_url || deriveYouTubeEmbedUrl(article.video_url);
  const videoFile = !videoEmbed && isLikelyVideoFileUrl(article.video_url) ? article.video_url : "";
  const leadHtml =
    typeof article.content === "object" && article.content?.lead_html
      ? String(article.content.lead_html)
      : "";
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.seo_description ?? article.summary ?? article.subtitle ?? article.title,
    image: article.cover_image_url ? [article.cover_image_url] : undefined,
    datePublished: article.published_at,
    dateModified: article.updated_at ?? article.published_at,
    author: author?.name ? [{ "@type": "Person", name: author.name }] : undefined,
    publisher: {
      "@type": "Organization",
      name: "ZEN NEWS",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/favicon.ico`,
      },
    },
    mainEntityOfPage: absoluteShareUrl,
    articleSection: section?.name,
    isPartOf: vertical?.name,
  };

  return (
    <div className="min-h-screen" data-vertical={vertical?.slug}>
      <SiteHeader />
      <main>
        <article className="mx-auto max-w-3xl px-4 py-12 md:px-6">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
          />
          <div className="text-xs font-bold uppercase text-accent">
            {vertical?.name}
            {section ? ` / ${section.name}` : ""}
          </div>
          <h1 className="mt-3 font-serif text-4xl font-black leading-tight md:text-6xl">
            {article.title}
          </h1>
          {article.subtitle && (
            <p className="mt-5 font-serif text-2xl leading-snug text-muted-foreground">
              {article.subtitle}
            </p>
          )}

          {article.cover_image_url && (
            <figure className="mt-8">
              <img
                src={article.cover_image_url}
                alt={article.cover_image_alt ?? article.title}
                className="aspect-[16/9] w-full rounded-md object-cover"
              />
              {article.cover_image_alt && (
                <figcaption className="mt-2 text-xs text-muted-foreground">
                  {article.cover_image_alt}
                </figcaption>
              )}
            </figure>
          )}

          {!article.cover_image_url && videoEmbed && isAllowedIframeUrl(videoEmbed) && (
            <figure className="mt-8 overflow-hidden rounded-md border border-border bg-black">
              <iframe
                src={videoEmbed}
                title={article.title}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
              />
            </figure>
          )}

          {!article.cover_image_url && videoFile && (
            <figure className="mt-8 overflow-hidden rounded-md border border-border bg-black">
              <video
                key={videoFile}
                src={videoFile}
                controls
                preload="metadata"
                playsInline
                className="aspect-video w-full object-contain"
              />
            </figure>
          )}

          {(leadHtml || article.summary) && (
            <div
              className="article-lead prose-content mt-8 border-l-4 border-accent pl-4 font-serif text-xl leading-8 text-foreground"
              {...(leadHtml
                ? { dangerouslySetInnerHTML: { __html: leadHtml } }
                : { children: article.summary })}
            />
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-border py-4 text-sm text-muted-foreground">
            {author?.name && (
              <span>
                Por <strong className="text-foreground">{author.name}</strong>
              </span>
            )}
            {article.published_at && (
              <span>
                {new Date(article.published_at).toLocaleDateString("es-CR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
            {article.reading_time && <span>{article.reading_time} min de lectura</span>}
            <span>{article.views_count ?? 0} lecturas</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground">
              <Share2 className="h-3.5 w-3.5" /> Compartir
            </span>
            <a
              className="rounded-full border border-border p-2 hover:bg-muted"
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShare}`}
              aria-label="Compartir en Facebook"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              className="rounded-full border border-border p-2 hover:bg-muted"
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedShare}`}
              aria-label="Compartir en LinkedIn"
            >
              <Linkedin className="h-4 w-4" />
            </a>
            <a
              className="rounded-full border border-border p-2 hover:bg-muted"
              href={`mailto:?subject=${encodeURIComponent(article.title)}&body=${encodedShare}`}
              aria-label="Compartir por correo"
            >
              <Mail className="h-4 w-4" />
            </a>
          </div>

          {article.external_source_name && (
            <div className="mt-8 rounded-md border border-border bg-muted/30 p-4 text-sm">
              Fuente externa:{" "}
              {article.external_url ? (
                <a
                  href={article.external_url}
                  className="font-semibold text-accent"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {article.external_source_name}
                </a>
              ) : (
                <strong>{article.external_source_name}</strong>
              )}
            </div>
          )}

          <div
            className="prose-content mt-10 font-serif text-lg leading-8"
            dangerouslySetInnerHTML={{ __html: article.content_html ?? "" }}
          />

          {article.cover_image_url && videoEmbed && isAllowedIframeUrl(videoEmbed) && (
            <div className="mt-10 overflow-hidden rounded-md border border-border bg-black">
              <iframe
                src={videoEmbed}
                title={article.title}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}

          {article.cover_image_url && videoFile && (
            <div className="mt-10 overflow-hidden rounded-md border border-border bg-black">
              <video
                key={videoFile}
                src={videoFile}
                controls
                preload="metadata"
                playsInline
                className="aspect-video w-full object-contain"
              />
            </div>
          )}

          {gallery.length > 0 && (
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {gallery.slice(0, 6).map((item: any, index: number) => (
                <img
                  key={`${item.url}-${index}`}
                  src={item.url}
                  alt={item.alt ?? article.title}
                  className="aspect-[4/3] rounded-md object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2 border-t border-border pt-6">
              {tags.map((item: any) => {
                const tag = item.tags;
                if (!tag) return null;
                return (
                  <a
                    key={tag.slug}
                    href={`/search?q=${encodeURIComponent(tag.name)}`}
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:border-accent hover:text-accent"
                  >
                    {tag.name}
                  </a>
                );
              })}
            </div>
          )}
        </article>

        {related.length > 0 && (
          <section className="mx-auto max-w-7xl border-t border-border px-4 py-14 md:px-6">
            <h2 className="mb-8 font-serif text-3xl font-bold">Sigue leyendo</h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item: any) => (
                <ArticleCard
                  key={item.id}
                  slug={item.slug}
                  title={item.title}
                  subtitle={item.summary}
                  cover={item.cover_image_url}
                  publishedAt={item.published_at}
                  size="sm"
                />
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
