import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";

import { ArticleCard } from "@/components/ArticleCard";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getSponsored } from "@/lib/news.functions";

export const Route = createFileRoute("/anuncios")({
  head: () => ({ meta: [{ title: "Anuncios y contenido patrocinado - ZEN NEWS" }] }),
  loader: () => getSponsored(),
  component: SponsoredPage,
});

function SponsoredPage() {
  const { articles, ads } = Route.useLoaderData();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-accent">
          <Megaphone className="h-4 w-4" /> Publicidad
        </div>
        <h1 className="mt-3 font-serif text-5xl font-black">Anuncios y contenido patrocinado</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Espacios comerciales identificados con claridad y separados del criterio editorial de la
          redaccion.
        </p>

        <section className="mt-10">
          <h2 className="mb-6 font-serif text-3xl font-bold">Contenido patrocinado</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article: any) => (
              <ArticleCard
                key={article.id}
                slug={article.slug}
                title={article.title}
                subtitle={article.summary ?? article.subtitle}
                cover={article.cover_image_url}
                publishedAt={article.published_at}
                kicker={article.verticals?.name}
              />
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="mb-6 font-serif text-3xl font-bold">Banners activos</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {ads.map((ad: any) => (
              <a
                key={ad.id}
                href={ad.link_url || "#"}
                className="rounded-md border border-border p-5 hover:border-accent"
              >
                {ad.image_url && (
                  <img
                    src={ad.image_url}
                    alt={ad.name}
                    className="aspect-[16/9] w-full rounded-md object-cover"
                  />
                )}
                <div className="mt-4 text-xs font-bold uppercase text-accent">{ad.placement}</div>
                <h3 className="mt-1 font-serif text-xl font-bold">{ad.name}</h3>
              </a>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
