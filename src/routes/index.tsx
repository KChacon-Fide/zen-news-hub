import { createFileRoute } from "@tanstack/react-router";
import { getHomeData } from "@/lib/news.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { ArticleCard } from "@/components/ArticleCard";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "ZEN NEWS — Periodismo y tecnología" },
    { name: "description", content: "Plataforma editorial que reúne ZEN MEDIA y ZEN TECH." },
  ]}),
  loader: () => getHomeData(),
  component: Home,
});

function Home() {
  const { verticals, breaking, featured, latest, live } = Route.useLoaderData();
  const vMap = Object.fromEntries(verticals.map((v: any) => [v.id, v]));

  return (
    <div className="min-h-screen">
      <SiteHeader live={!!live} />

      {breaking && (
        <div className="border-b border-destructive/40 bg-destructive/5">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-2 text-sm">
            <span className="rounded bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">ÚLTIMA HORA</span>
            <Link to="/articulo/$slug" params={{ slug: breaking.slug }} className="truncate hover:underline">{breaking.title}</Link>
          </div>
        </div>
      )}

      <section className="mx-auto max-w-7xl px-6 pt-12">
        <div className="mb-3 flex items-center justify-between">
          <span className="kicker text-muted-foreground">Edición de hoy · {new Date().toLocaleDateString("es-CR",{weekday:"long",day:"numeric",month:"long"})}</span>
          <div className="flex gap-2">
            <Link to="/media" className="kicker rounded-full border border-[var(--zen-media)] px-3 py-1 text-[var(--zen-media)]">ZEN Media</Link>
            <Link to="/tech" className="kicker rounded-full border border-[var(--zen-tech)] px-3 py-1 text-[var(--zen-tech)]">ZEN Tech</Link>
          </div>
        </div>

        {featured[0] && (
          <div className="grid grid-cols-1 gap-10 border-b border-border pb-12 lg:grid-cols-[1.6fr_1fr]">
            <ArticleCard
              slug={featured[0].slug}
              title={featured[0].title}
              subtitle={featured[0].summary}
              cover={featured[0].cover_image_url}
              publishedAt={featured[0].published_at}
              size="lg"
              kicker={vMap[featured[0].vertical_id]?.name}
            />
            <div className="flex flex-col gap-6">
              {featured.slice(1, 4).map((a: any) => (
                <div key={a.id} className="border-b border-border pb-6 last:border-0">
                  <ArticleCard slug={a.slug} title={a.title} subtitle={a.summary} cover={a.cover_image_url} publishedAt={a.published_at} size="sm" kicker={vMap[a.vertical_id]?.name} />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="font-serif text-3xl font-bold">Lo último</h2>
          <Link to="/search" className="kicker text-muted-foreground hover:text-foreground">Ver todo →</Link>
        </div>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {latest.slice(0, 8).map((a: any) => (
            <ArticleCard key={a.id} slug={a.slug} title={a.title} cover={a.cover_image_url} publishedAt={a.published_at} kicker={vMap[a.vertical_id]?.name} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {verticals.filter((v: any) => v.slug !== "news").map((v: any) => (
            <Link key={v.id} to={v.slug === "media" ? "/media" : "/tech"} className="group relative overflow-hidden rounded-lg border border-border bg-card p-10 transition-all hover:shadow-xl" data-vertical={v.slug}>
              <div className="kicker text-accent">{v.tagline}</div>
              <div className="mt-3 font-serif text-5xl font-black tracking-tight">{v.name}</div>
              <p className="mt-4 max-w-md text-sm text-muted-foreground">{v.description}</p>
              <div className="kicker mt-8 text-foreground group-hover:text-accent">Entrar →</div>
            </Link>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
