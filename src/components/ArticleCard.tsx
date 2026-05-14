import { Link } from "@tanstack/react-router";

type Props = {
  slug: string;
  title: string;
  subtitle?: string | null;
  cover?: string | null;
  publishedAt?: string | null;
  size?: "sm" | "md" | "lg";
  kicker?: string;
};

export function ArticleCard({ slug, title, subtitle, cover, publishedAt, size = "md", kicker }: Props) {
  const date = publishedAt ? new Date(publishedAt).toLocaleDateString("es-CR", { day: "numeric", month: "short" }) : "";
  return (
    <Link to="/articulo/$slug" params={{ slug }} className="group block">
      {cover && (
        <div className={`overflow-hidden rounded-md bg-muted ${size === "lg" ? "aspect-[16/10]" : "aspect-[4/3]"}`}>
          <img src={cover} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        </div>
      )}
      <div className="mt-3">
        {kicker && <div className="kicker mb-1.5 text-accent">{kicker}</div>}
        <h3 className={`font-serif font-bold leading-tight tracking-tight text-foreground group-hover:text-accent ${size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl"}`}>
          {title}
        </h3>
        {subtitle && size !== "sm" && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{subtitle}</p>}
        {date && <div className="mt-2 text-xs text-muted-foreground">{date}</div>}
      </div>
    </Link>
  );
}
