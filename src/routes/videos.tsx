import { createFileRoute } from "@tanstack/react-router";
import { PlayCircle } from "lucide-react";

import { ArticleCard } from "@/components/ArticleCard";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getVideos } from "@/lib/news.functions";

export const Route = createFileRoute("/videos")({
  head: () => ({ meta: [{ title: "Videos - ZEN NEWS" }] }),
  loader: () => getVideos(),
  component: VideosPage,
});

function VideosPage() {
  const { videos } = Route.useLoaderData();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-accent">
          <PlayCircle className="h-4 w-4" /> Video
        </div>
        <h1 className="mt-3 font-serif text-5xl font-black">Videos recientes</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Entrevistas, explicadores, transmisiones archivadas y contenido multimedia de ZEN MEDIA y
          ZEN TECH.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((article: any) => (
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
        {videos.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">Aun no hay videos publicados.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
