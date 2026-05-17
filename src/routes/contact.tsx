import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contacto - ZEN NEWS" }] }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-12 md:px-6 lg:grid-cols-[0.8fr_1fr]">
        <section>
          <div className="text-xs font-bold uppercase text-accent">Contacto</div>
          <h1 className="mt-3 font-serif text-5xl font-black">Hablemos con claridad</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Para noticias, alianzas, anuncios, correcciones editoriales o consultas institucionales
            de ZEN NEWS, escríbenos por los canales oficiales.
          </p>
          <div className="mt-8 space-y-4 text-sm">
            <a
              href="mailto:contacto@zennews.cr"
              className="flex items-center gap-3 hover:text-accent"
            >
              <Mail className="h-4 w-4" /> contacto@zennews.cr
            </a>
            <div className="flex items-center gap-3 text-muted-foreground">
              <MapPin className="h-4 w-4" /> Costa Rica
            </div>
          </div>
        </section>

        <form className="rounded-md border border-border p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold">
              Nombre
              <input className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <label className="text-sm font-semibold">
              Correo
              <input
                type="email"
                className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold">
            Tema
            <select className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option>Noticias y redaccion</option>
              <option>Anuncios y patrocinios</option>
              <option>Soporte tecnico</option>
              <option>Correcciones</option>
            </select>
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Mensaje
            <textarea className="mt-2 min-h-36 w-full rounded-md border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <a
            href="mailto:contacto@zennews.cr"
            className="mt-5 inline-flex rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Enviar por correo
          </a>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
