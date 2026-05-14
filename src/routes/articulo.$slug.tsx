import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getArticle } from "@/lib/news.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { ArticleCard } from "@/components/ArticleCard";

export const Route = createFileRoute("/articulo/$slug")({
  loader: async ({ params }) => {
    const data = await getArticle({ data: { slug: params.slug } });
    if (!data.article) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.article?.title ?? "Artículo"} — ZEN NEWS` },
    { name: "description", content: loaderData?.article?.summary ?? "" },
    { property: "og:image", content: loaderData?.article?.cover_image_url ?? "" },
  ]}),
  component: ArticlePage,
  notFoundComponent: () => <div className="p-20 text-center">Noticia no encontrada</div>,
});

function ArticlePage() {
  const { article, related } = Route.useLoaderData();
  if (!article) return null;
  const v = article.verticals as any;
  const s = article.sections as any;
  const au = article.authors as any;
  return (
    <div className="min-h-screen" data-vertical={v?.slug}>
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <div className="kicker text-accent">
          {v?.name}{s ? ` · ${s.name}` : ""}
        </div>
        <h1 className="mt-3 font-serif text-5xl font-black leading-[1.05] tracking-tight">{article.title}</h1>
        {article.subtitle && <p className="mt-4 font-serif text-2xl leading-snug text-muted-foreground">{article.subtitle}</p>}
        <div className="mt-6 flex items-center gap-4 border-y border-border py-4 text-sm text-muted-foreground">
          {au?.name && <span>Por <strong className="text-foreground">{au.name}</strong></span>}
          {article.published_at && <span>· {new Date(article.published_at).toLocaleDateString("es-CR",{day:"numeric",month:"long",year:"numeric"})}</span>}
          {article.reading_time && <span>· {article.reading_time} min de lectura</span>}
        </div>
        {article.cover_image_url && (
          <img src={article.cover_image_url} alt={article.cover_image_alt ?? article.title} className="mt-8 aspect-[16/9] w-full rounded-md object-cover" />
        )}
        <div className="prose prose-lg mt-10 max-w-none font-serif leading-relaxed" dangerouslySetInnerHTML={{ __html: article.content_html ?? "" }} />
      </article>
      {related.length > 0 && (
        <section className="mx-auto max-w-7xl border-t border-border px-6 py-16">
          <h2 className="mb-8 font-serif text-2xl font-bold">Sigue leyendo</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r: any) => (
              <ArticleCard key={r.id} slug={r.slug} title={r.title} cover={r.cover_image_url} publishedAt={r.published_at} size="sm" />
            ))}
          </div>
        </section>
      )}
      <SiteFooter />
    </div>
  );
}
