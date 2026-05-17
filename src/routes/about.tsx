import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "Quienes somos - ZEN NEWS" }] }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="border-b border-border">
          <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
            <div className="text-xs font-bold uppercase text-accent">Quienes somos</div>
            <h1 className="mt-2 font-serif text-5xl font-black">ZEN</h1>
            <div className="mt-7 space-y-5 text-lg leading-8">
              <p>
                Somos un equipo de profesionales comprometidos que creen que la informacion puede y
                debe ser diferente. Nacimos de una pregunta simple: por que, aun contando con la
                preparacion y los requisitos, sigue siendo dificil acceder a oportunidades
                laborales?
              </p>
              <p>
                Impulsamos un periodismo veraz y de calidad, junto con informacion tecnologica
                responsable. Nos distinguimos por integrar creatividad y claridad con el rigor
                necesario para interpretar la realidad, desde lo que ocurre al otro lado del mundo
                hasta las nuevas eras digitales: dos plataformas hermanas que nacen de una misma
                vision para comprender una sola realidad.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-12 md:grid-cols-2 md:px-6">
          <MissionBlock title="Mision ZEN">
            Integrar tecnologia y periodismo para consolidar una empresa referente a nivel nacional
            e internacional, transformando la informacion en conocimiento estrategico.
          </MissionBlock>
          <MissionBlock title="Vision ZEN">
            Posicionar a la empresa entre las mejores en facilitar informacion tecnologica y
            periodistica.
          </MissionBlock>
          <MissionBlock title="ZEN MEDIA - Mision" vertical="media">
            Alcanzar el reconocimiento como un medio informativo referente por su rigor,
            credibilidad e innovacion.
          </MissionBlock>
          <MissionBlock title="ZEN MEDIA - Vision" vertical="media">
            Brindar periodismo de calidad sobre la actualidad nacional e internacional, con
            informacion veridica, analisis oportuno y contenidos relevantes para la audiencia.
          </MissionBlock>
          <MissionBlock title="ZEN TECH - Mision" vertical="tech">
            Impulsar a las personas a usar la tecnologia sin que esta las use a ellas, traduciendo
            el ruido en decisiones concretas.
          </MissionBlock>
          <MissionBlock title="ZEN TECH - Vision" vertical="tech">
            Promover que la tecnologia deje de ser territorio de especialistas y vuelva a ser una
            herramienta al servicio de las personas. Ser la voz que pregunta antes de comprar,
            instalar o creer.
          </MissionBlock>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function MissionBlock({
  title,
  children,
  vertical,
}: {
  title: string;
  children: ReactNode;
  vertical?: "media" | "tech";
}) {
  return (
    <div className="rounded-md border border-border p-6" data-vertical={vertical}>
      <div className="text-xs font-bold uppercase text-accent">{title}</div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}
