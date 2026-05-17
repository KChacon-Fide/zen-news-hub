import { createFileRoute } from "@tanstack/react-router";
import { Radio } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getLiveData } from "@/lib/news.functions";
import { PUBLIC_IMAGE_FALLBACKS } from "@/lib/editorial.constants";
import { isAllowedIframeUrl } from "@/lib/security";

export const Route = createFileRoute("/live")({
  head: () => ({ meta: [{ title: "En vivo - ZEN NEWS" }] }),
  loader: () => getLiveData(),
  component: LivePage,
});

function LivePage() {
  const { active, history } = Route.useLoaderData();
  const canEmbed = active?.embed_url && isAllowedIframeUrl(active.embed_url);

  return (
    <div className="min-h-screen">
      <SiteHeader live={!!active} />
      <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-destructive">
          <Radio className={active ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />{" "}
          {active ? "EN VIVO" : "Transmision"}
        </div>
        <h1 className="mt-3 font-serif text-5xl font-black">
          {active?.title ?? "No hay transmision activa"}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {active?.description ??
            "Cuando ZEN NEWS, ZEN MEDIA o ZEN TECH activen una cobertura en vivo, el reproductor aparecera aqui sin enlaces rotos ni espacios vacios."}
        </p>

        <section className="mt-10 overflow-hidden rounded-md border border-border bg-black">
          {active && canEmbed ? (
            <iframe
              src={active.embed_url}
              title={active.title}
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="relative aspect-video">
              <img
                src={active?.cover_image_url ?? PUBLIC_IMAGE_FALLBACKS.live}
                alt={active?.title ?? "Transmision ZEN NEWS"}
                className="h-full w-full object-cover opacity-50"
              />
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                <div>
                  <div className="text-xs font-bold uppercase text-white/80">
                    {active ? active.platform : "ZEN NEWS"}
                  </div>
                  <p className="mt-3 max-w-md text-lg font-semibold text-white">
                    {active
                      ? "Esta plataforma limita el embed. Puedes abrir la transmision desde el enlace oficial cuando este disponible."
                      : "No hay una transmision activa en este momento."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {active?.stream_url && (
          <a
            href={active.stream_url}
            rel="noopener noreferrer"
            target="_blank"
            className="mt-4 inline-flex rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Abrir plataforma original
          </a>
        )}

        <section className="mt-14">
          <h2 className="mb-6 font-serif text-3xl font-bold">Historial y programadas</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {history.map((item: any) => (
              <div key={item.id} className="rounded-md border border-border p-5">
                <div className="text-xs font-bold uppercase text-muted-foreground">
                  {item.status} / {item.platform}
                </div>
                <h3 className="mt-2 font-serif text-xl font-bold">{item.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
