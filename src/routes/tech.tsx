import { createFileRoute } from "@tanstack/react-router";

import { VerticalPage } from "@/components/VerticalPage";
import { getVerticalData } from "@/lib/news.functions";

export const Route = createFileRoute("/tech")({
  head: () => ({
    meta: [
      { title: "ZEN TECH - Tecnologia util" },
      { name: "description", content: "IA, ciberseguridad, ciencia y tecnologia responsable." },
    ],
  }),
  loader: () => getVerticalData({ data: { slug: "tech" } }),
  component: TechPage,
});

function TechPage() {
  const { vertical, articles, sections, mostRead, live } = Route.useLoaderData();
  if (!vertical) return <div className="p-20 text-center">ZEN TECH no esta disponible.</div>;
  return (
    <VerticalPage
      slug="tech"
      vertical={vertical}
      articles={articles}
      sections={sections}
      mostRead={mostRead}
      live={live}
    />
  );
}
