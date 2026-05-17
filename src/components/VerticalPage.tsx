import { Link } from "@tanstack/react-router";
import { Radio } from "lucide-react";

import { ArticleCard } from "@/components/ArticleCard";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

type Props = {
  slug: "media" | "tech";
  vertical: any;
  articles: any[];
  sections: any[];
  mostRead: any[];
  live?: any;
};

function sectionName(article: any) {
  return article?.sections?.name ?? "";
}

export function VerticalPage({ slug, vertical, articles, sections, mostRead, live }: Props) {
  const hero = articles.find((article) => article.is_featured) ?? articles[0];
  const topSections = sections
    .filter((section) => section.show_in_home)
    .slice(0, slug === "media" ? 12 : 10);

  return (
    <div className="min-h-screen" data-vertical={slug}>
      <SiteHeader live={!!live} />
      <header className="border-b border-border bg-muted/30">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 md:px-6 lg:grid-cols-[1fr_0.55fr]">
          <div>
            <div className="text-xs font-bold uppercase text-accent">{vertical.tagline}</div>
            <h1 className="mt-2 font-serif text-5xl font-black md:text-6xl">{vertical.name}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
              {vertical.description}
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {topSections.map((section: any) => (
                <Link
                  key={section.id}
                  to="/seccion/$slug"
                  params={{ slug: section.slug }}
                  className="rounded-full border border-border px-3 py-1 text-xs font-bold uppercase hover:border-accent hover:text-accent"
                >
                  {section.name}
                </Link>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            {live && (
              <Link
                to="/live"
                className="block rounded-md border border-destructive/30 bg-destructive/5 p-5"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-destructive">
                  <Radio className="h-4 w-4 animate-pulse" /> EN VIVO
                </div>
                <h2 className="mt-3 font-serif text-2xl font-bold">{live.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {live.description}
                </p>
              </Link>
            )}
            <div className="rounded-md border border-border p-5">
              <div className="text-xs font-bold uppercase text-muted-foreground">Mision</div>
              <p className="mt-2 text-sm leading-6">{vertical.mission}</p>
            </div>
          </aside>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        {hero && (
          <section className="grid grid-cols-1 gap-10 border-b border-border pb-12 lg:grid-cols-[1.4fr_0.8fr]">
            <ArticleCard
              slug={hero.slug}
              title={hero.title}
              subtitle={hero.summary ?? hero.subtitle}
              cover={hero.cover_image_url}
              publishedAt={hero.published_at}
              size="lg"
              kicker="Apertura"
              section={sectionName(hero)}
            />
            <div className="space-y-5">
              {articles
                .filter((article) => article.id !== hero.id)
                .slice(0, 4)
                .map((article) => (
                  <ArticleCard
                    key={article.id}
                    slug={article.slug}
                    title={article.title}
                    subtitle={article.summary}
                    cover={article.cover_image_url}
                    publishedAt={article.published_at}
                    section={sectionName(article)}
                    horizontal
                    size="sm"
                  />
                ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="mb-7 font-serif text-3xl font-bold">Cobertura por secciones</h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {articles.slice(5, 23).map((article) => (
                <ArticleCard
                  key={article.id}
                  slug={article.slug}
                  title={article.title}
                  subtitle={article.summary ?? article.subtitle}
                  cover={article.cover_image_url}
                  publishedAt={article.published_at}
                  section={sectionName(article)}
                />
              ))}
            </div>
          </div>

          <aside className="space-y-8">
            <div>
              <h2 className="mb-5 font-serif text-2xl font-bold">Mas leidas</h2>
              <div className="space-y-4">
                {mostRead.map((article, index) => (
                  <Link
                    key={article.id}
                    to="/articulo/$slug"
                    params={{ slug: article.slug }}
                    className="grid grid-cols-[28px_1fr] gap-3 border-b border-border pb-4 last:border-0"
                  >
                    <span className="font-serif text-xl font-black text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold leading-snug hover:text-accent">
                      {article.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-5 font-serif text-2xl font-bold">Menu editorial</h2>
              <div className="flex flex-wrap gap-2">
                {sections.map((section) => (
                  <Link
                    key={section.id}
                    to="/seccion/$slug"
                    params={{ slug: section.slug }}
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:border-accent hover:text-accent"
                  >
                    {section.name}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
