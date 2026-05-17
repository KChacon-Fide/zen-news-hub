import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Mail, Radio } from "lucide-react";
import { motion } from "framer-motion";
import { useState, type FormEvent } from "react";

import { ArticleCard } from "@/components/ArticleCard";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getHomeData, subscribeNewsletter } from "@/lib/news.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZEN NEWS - Periodismo y tecnologia" },
      { name: "description", content: "Portal madre de ZEN MEDIA y ZEN TECH." },
    ],
  }),
  loader: () => getHomeData(),
  component: Home,
});

function relationName(value: unknown, fallback = "") {
  if (!value || typeof value !== "object") return fallback;
  return String((value as { name?: string }).name ?? fallback);
}

function relationSlug(value: unknown, fallback = "") {
  if (!value || typeof value !== "object") return fallback;
  return String((value as { slug?: string }).slug ?? fallback);
}

function Home() {
  const { verticals, breaking, featured, latest, live, mostRead, videos, sponsored, blocks, ads } =
    Route.useLoaderData();
  const hero = featured[0] ?? latest[0];
  const [email, setEmail] = useState("");
  const [newsletterState, setNewsletterState] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  const knowBlock = blocks.find((block: any) => block.block_key === "what-to-know");

  async function handleNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewsletterState("saving");
    try {
      await subscribeNewsletter({ data: { email, verticalSlug: "news" } });
      setNewsletterState("done");
      setEmail("");
    } catch {
      setNewsletterState("error");
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader live={!!live} />

      {breaking && (
        <div className="border-b border-destructive/40 bg-destructive/5">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm md:px-6">
            <span className="rounded bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
              ULTIMA HORA
            </span>
            <Link
              to="/articulo/$slug"
              params={{ slug: breaking.slug }}
              className="truncate hover:underline"
            >
              {breaking.title}
            </Link>
          </div>
        </div>
      )}

      <main>
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-10 md:px-6 lg:grid-cols-[1.6fr_0.8fr]">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-bold uppercase text-muted-foreground">
                <span>Edicion de hoy</span>
                <span>
                  {new Date().toLocaleDateString("es-CR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </div>
              {hero && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <ArticleCard
                    slug={hero.slug}
                    title={hero.title}
                    subtitle={hero.summary ?? hero.subtitle}
                    cover={hero.cover_image_url}
                    publishedAt={hero.published_at}
                    size="lg"
                    kicker={relationName(hero.verticals, "ZEN NEWS")}
                    section={relationName(hero.sections)}
                  />
                </motion.div>
              )}
            </div>

            <aside className="space-y-8">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {verticals
                  .filter((vertical: any) => vertical.slug !== "news")
                  .map((vertical: any) => (
                    <Link
                      key={vertical.id}
                      to={vertical.slug === "media" ? "/media" : "/tech"}
                      className="group rounded-md border border-border p-5 transition-colors hover:border-accent"
                      data-vertical={vertical.slug}
                    >
                      <div className="text-xs font-bold uppercase text-accent">
                        {vertical.tagline}
                      </div>
                      <div className="mt-2 font-serif text-3xl font-black">{vertical.name}</div>
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                        {vertical.description}
                      </p>
                      <div className="mt-4 flex items-center gap-2 text-xs font-bold uppercase">
                        Entrar{" "}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                  ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase text-accent">
                {knowBlock?.title ?? "Lo que debes saber hoy"}
              </div>
              <h2 className="mt-2 font-serif text-3xl font-bold">Agenda editorial</h2>
            </div>
            <Link
              to="/search"
              className="hidden text-xs font-bold uppercase text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              Buscar todo
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_0.55fr]">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {latest.slice(0, 6).map((article: any) => (
                <ArticleCard
                  key={article.id}
                  slug={article.slug}
                  title={article.title}
                  subtitle={article.summary ?? article.subtitle}
                  cover={article.cover_image_url}
                  publishedAt={article.published_at}
                  kicker={relationName(article.verticals)}
                  section={relationName(article.sections)}
                />
              ))}
            </div>
            <aside className="space-y-5 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <h3 className="font-serif text-2xl font-bold">Mas leidas</h3>
              {mostRead.map((article: any, index: number) => (
                <Link
                  key={article.id}
                  to="/articulo/$slug"
                  params={{ slug: article.slug }}
                  className="grid grid-cols-[32px_1fr] gap-3 border-b border-border pb-4 last:border-0"
                >
                  <span className="font-serif text-2xl font-black text-muted-foreground">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold leading-snug hover:text-accent">
                      {article.title}
                    </span>
                    <span className="mt-1 block text-xs uppercase text-muted-foreground">
                      {relationName(article.verticals)} · {article.views_count ?? 0} lecturas
                    </span>
                  </span>
                </Link>
              ))}
            </aside>
          </div>
        </section>

        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-12 md:px-6 lg:grid-cols-2">
            {["media", "tech"].map((slug) => {
              const articles = latest
                .filter((article: any) => relationSlug(article.verticals) === slug)
                .slice(0, 4);
              const vertical = verticals.find((item: any) => item.slug === slug);
              return (
                <div key={slug} data-vertical={slug}>
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase text-accent">
                        {vertical?.tagline}
                      </div>
                      <h2 className="mt-1 font-serif text-3xl font-bold">{vertical?.name}</h2>
                    </div>
                    <Link
                      to={slug === "media" ? "/media" : "/tech"}
                      className="text-xs font-bold uppercase text-muted-foreground hover:text-accent"
                    >
                      Ver vertical
                    </Link>
                  </div>
                  <div className="space-y-5">
                    {articles.map((article: any) => (
                      <ArticleCard
                        key={article.id}
                        slug={article.slug}
                        title={article.title}
                        subtitle={article.summary}
                        cover={article.cover_image_url}
                        publishedAt={article.published_at}
                        section={relationName(article.sections)}
                        horizontal
                        size="sm"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-serif text-3xl font-bold">Videos recientes</h2>
                <Link
                  to="/videos"
                  className="text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
                >
                  Ver videos
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {videos.slice(0, 4).map((article: any) => (
                  <ArticleCard
                    key={article.id}
                    slug={article.slug}
                    title={article.title}
                    subtitle={article.subtitle}
                    cover={article.cover_image_url}
                    publishedAt={article.published_at}
                    kicker={relationName(article.verticals)}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-serif text-3xl font-bold">Patrocinado</h2>
                <Link
                  to="/anuncios"
                  className="text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
                >
                  Ver anuncios
                </Link>
              </div>
              <div className="space-y-5">
                {[...sponsored, ...ads].slice(0, 4).map((item: any) =>
                  item.slug ? (
                    <ArticleCard
                      key={item.id}
                      slug={item.slug}
                      title={item.title}
                      subtitle={item.summary ?? item.subtitle}
                      cover={item.cover_image_url}
                      publishedAt={item.published_at}
                      kicker="Contenido patrocinado"
                      horizontal
                      size="sm"
                    />
                  ) : (
                    <a
                      key={item.id}
                      href={item.link_url || "/anuncios"}
                      className="grid grid-cols-[112px_1fr] gap-4 border-b border-border pb-4 last:border-0"
                    >
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="aspect-[4/3] rounded-md object-cover"
                      />
                      <span>
                        <span className="block text-xs font-bold uppercase text-accent">
                          Anuncio
                        </span>
                        <span className="mt-1 block font-serif text-lg font-bold">{item.name}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {item.placement}
                        </span>
                      </span>
                    </a>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-12 md:px-6 lg:grid-cols-[0.8fr_1fr]">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-accent">
                <Mail className="h-4 w-4" /> Newsletter
              </div>
              <h2 className="mt-3 font-serif text-4xl font-bold">El pulso de ZEN en tu correo</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Titulares verificados de ZEN MEDIA y analisis practico de ZEN TECH, sin ruido ni
                relleno.
              </p>
            </div>
            <form
              onSubmit={handleNewsletter}
              className="flex flex-col gap-3 sm:flex-row sm:items-start"
            >
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
                placeholder="correo@ejemplo.com"
                className="min-h-11 flex-1 rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={newsletterState === "saving"}
                className="min-h-11 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                Suscribirme
              </button>
              {newsletterState === "done" && <span className="text-sm text-accent">Listo.</span>}
              {newsletterState === "error" && (
                <span className="text-sm text-destructive">No se pudo registrar.</span>
              )}
            </form>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
