import { Link } from "@tanstack/react-router";

import { PUBLIC_IMAGE_FALLBACKS } from "@/lib/editorial.constants";

type Props = {
  slug: string;
  title: string;
  subtitle?: string | null;
  cover?: string | null;
  publishedAt?: string | null;
  size?: "sm" | "md" | "lg";
  kicker?: string;
  section?: string | null;
  horizontal?: boolean;
};

export function ArticleCard({
  slug,
  title,
  subtitle,
  cover,
  publishedAt,
  size = "md",
  kicker,
  section,
  horizontal = false,
}: Props) {
  const date = publishedAt
    ? new Date(publishedAt).toLocaleDateString("es-CR", { day: "numeric", month: "short" })
    : "";
  const image = cover || PUBLIC_IMAGE_FALLBACKS.newsroom;
  const titleClass =
    size === "lg" ? "text-3xl md:text-4xl" : size === "sm" ? "text-base" : "text-xl";

  return (
    <Link
      to="/articulo/$slug"
      params={{ slug }}
      className={horizontal ? "group grid grid-cols-[112px_1fr] gap-4" : "group block"}
    >
      <div
        className={`overflow-hidden rounded-md bg-muted ${horizontal ? "aspect-[4/3]" : size === "lg" ? "aspect-[16/10]" : "aspect-[4/3]"}`}
      >
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className={horizontal ? "" : "mt-3"}>
        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold uppercase text-accent">
          {kicker && <span>{kicker}</span>}
          {section && <span className="text-muted-foreground">{section}</span>}
        </div>
        <h3
          className={`font-serif font-bold leading-tight text-foreground group-hover:text-accent ${titleClass}`}
        >
          {title}
        </h3>
        {subtitle && size !== "sm" && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{subtitle}</p>
        )}
        {date && <div className="mt-2 text-xs text-muted-foreground">{date}</div>}
      </div>
    </Link>
  );
}
