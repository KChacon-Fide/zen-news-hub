import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { ArticleCard } from "@/components/ArticleCard";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { searchArticles } from "@/lib/news.functions";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
    verticalSlug:
      search.verticalSlug === "media" || search.verticalSlug === "tech"
        ? search.verticalSlug
        : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => searchArticles({ data: deps }),
  component: SearchPage,
});

function SearchPage() {
  const { articles, q } = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-accent">
            <Search className="h-4 w-4" /> Busqueda global
          </div>
          <h1 className="mt-3 font-serif text-5xl font-black">Buscar en ZEN NEWS</h1>
          <form
            className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_120px]"
            action="/search"
          >
            <input
              name="q"
              defaultValue={search.q}
              placeholder="Buscar noticias, temas o autores"
              className="min-h-11 rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              name="verticalSlug"
              defaultValue={search.verticalSlug ?? ""}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todas</option>
              <option value="media">ZEN MEDIA</option>
              <option value="tech">ZEN TECH</option>
            </select>
            <button className="rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Buscar
            </button>
          </form>
        </div>

        <section className="mt-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-serif text-3xl font-bold">
              {q ? `Resultados para "${q}"` : "Ultimas noticias"}
            </h2>
            <Link
              to="/"
              className="text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
            >
              Inicio
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {articles.map((article: any) => (
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
          </div>
          {articles.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">
              No encontramos resultados publicados.
            </p>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
