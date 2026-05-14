import { createFileRoute, Link } from "@tanstack/react-router";
import { getVerticalData } from "@/lib/news.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { ArticleCard } from "@/components/ArticleCard";

export const Route = createFileRoute("/media")({
  head: () => ({ meta: [
    { title: "ZEN MEDIA — Actualidad con rigor" },
    { name: "description", content: "Periodismo veraz sobre actualidad nacional e internacional." },
  ]}),
  loader: () => getVerticalData({ data: { slug: "media" } }),
  component: MediaPage,
});

function MediaPage() {
  const { vertical, articles, sections } = Route.useLoaderData();
  if (!vertical) return <div>No disponible</div>;
  const hero = articles[0];
  return (
    <div className="min-h-screen" data-vertical="media">
      <SiteHeader />
      <header className="border-b border-border bg-[var(--zen-media)]/5">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="kicker text-[var(--zen-media)]">{vertical.tagline}</div>
          <h1 className="mt-2 font-serif text-6xl font-black tracking-tight">ZEN MEDIA</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{vertical.description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {sections.slice(0, 12).map((s: any) => (
              <Link key={s.id} to="/seccion/$slug" params={{ slug: s.slug }} className="kicker rounded-full border border-border px-3 py-1 hover:border-[var(--zen-media)] hover:text-[var(--zen-media)]">{s.name}</Link>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-12">
        {hero && (
          <div className="mb-16 border-b border-border pb-12">
            <ArticleCard slug={hero.slug} title={hero.title} subtitle={hero.summary} cover={hero.cover_image_url} publishedAt={hero.published_at} size="lg" kicker="Destacado" />
          </div>
        )}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {articles.slice(1).map((a: any) => (
            <ArticleCard key={a.id} slug={a.slug} title={a.title} subtitle={a.summary} cover={a.cover_image_url} publishedAt={a.published_at} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
