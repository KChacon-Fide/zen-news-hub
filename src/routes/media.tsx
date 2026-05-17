import { createFileRoute } from "@tanstack/react-router";

import { VerticalPage } from "@/components/VerticalPage";
import { getVerticalData } from "@/lib/news.functions";

export const Route = createFileRoute("/media")({
  head: () => ({
    meta: [
      { title: "ZEN MEDIA - Actualidad con rigor" },
      {
        name: "description",
        content: "Periodismo veraz sobre actualidad nacional e internacional.",
      },
    ],
  }),
  loader: () => getVerticalData({ data: { slug: "media" } }),
  component: MediaPage,
});

function MediaPage() {
  const { vertical, articles, sections, mostRead, live } = Route.useLoaderData();
  if (!vertical) return <div className="p-20 text-center">ZEN MEDIA no esta disponible.</div>;
  return (
    <VerticalPage
      slug="media"
      vertical={vertical}
      articles={articles}
      sections={sections}
      mostRead={mostRead}
      live={live}
    />
  );
}
