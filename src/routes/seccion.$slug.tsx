import { createFileRoute, notFound } from "@tanstack/react-router";

import { ArticleCard } from "@/components/ArticleCard";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getSectionData } from "@/lib/news.functions";

export const Route = createFileRoute("/seccion/$slug")({
  loader: async ({ params }) => {
    const data = await getSectionData({ data: { slug: params.slug } });
    if (!data.section) throw notFound();
    return data;
  },
  component: SectionPage,
  notFoundComponent: () => <div className="p-20 text-center">Seccion no encontrada</div>,
});

function SectionPage() {
  const { section, articles } = Route.useLoaderData();
  const vertical = section.verticals as any;

  return (
    <div className="min-h-screen" data-vertical={vertical?.slug}>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="border-b border-border pb-8">
          <div className="text-xs font-bold uppercase text-accent">{vertical?.name}</div>
          <h1 className="mt-2 font-serif text-5xl font-black">{section.name}</h1>
          {section.description && (
            <p className="mt-3 max-w-2xl text-muted-foreground">{section.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
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
      </main>
      <SiteFooter />
    </div>
  );
}
