import { createFileRoute } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";

import { ArticleCard } from "@/components/ArticleCard";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getSpecials } from "@/lib/news.functions";

export const Route = createFileRoute("/especiales")({
  head: () => ({ meta: [{ title: "Especiales y reportajes - ZEN NEWS" }] }),
  loader: () => getSpecials(),
  component: SpecialsPage,
});

function SpecialsPage() {
  const { articles } = Route.useLoaderData();
  const hero = articles[0];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-accent">
          <Newspaper className="h-4 w-4" /> Especiales
        </div>
        <h1 className="mt-3 font-serif text-5xl font-black">Reportajes y especiales</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Historias de contexto, entrevistas breves, explicadores y reportajes de profundidad de ZEN
          MEDIA y ZEN TECH.
        </p>

        {hero && (
          <section className="mt-10 border-b border-border pb-10">
            <ArticleCard
              slug={hero.slug}
              title={hero.title}
              subtitle={hero.summary ?? hero.subtitle}
              cover={hero.cover_image_url}
              publishedAt={hero.published_at}
              kicker={hero.verticals?.name}
              section={hero.sections?.name}
              size="lg"
            />
          </section>
        )}

        <section className="grid grid-cols-1 gap-8 py-10 sm:grid-cols-2 lg:grid-cols-3">
          {articles.slice(1).map((article: any) => (
            <ArticleCard
              key={article.id}
              slug={article.slug}
              title={article.title}
              subtitle={article.summary ?? article.subtitle}
              cover={article.cover_image_url}
              publishedAt={article.published_at}
              kicker={article.verticals?.name}
              section={article.sections?.name}
            />
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
