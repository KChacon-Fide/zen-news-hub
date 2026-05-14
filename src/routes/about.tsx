import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "Quiénes somos — ZEN NEWS" }] }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="kicker text-accent">Quiénes somos</div>
        <h1 className="mt-2 font-serif text-5xl font-black tracking-tight">ZEN</h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground">
          Somos un equipo de profesionales comprometidos que creen que la información puede y debe ser diferente. Nacimos de una pregunta simple: ¿por qué, aun contando con la preparación y los requisitos, sigue siendo difícil acceder a oportunidades laborales?
        </p>
        <p className="mt-4 text-lg leading-relaxed text-foreground">
          Impulsamos un periodismo veraz y de calidad, junto con información tecnológica responsable. Nos distinguimos por integrar creatividad y claridad con el rigor necesario para interpretar la realidad, desde lo que ocurre al otro lado del mundo hasta las nuevas eras digitales: dos plataformas hermanas que nacen de una misma visión para comprender una sola realidad.
        </p>
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div className="rounded-lg border border-border p-6">
            <div className="kicker text-accent">Misión ZEN</div>
            <p className="mt-3 text-sm">Integrar tecnología y periodismo para consolidar una empresa referente a nivel nacional e internacional, transformando la información en conocimiento estratégico.</p>
          </div>
          <div className="rounded-lg border border-border p-6">
            <div className="kicker text-accent">Visión ZEN</div>
            <p className="mt-3 text-sm">Posicionar a la empresa entre las mejores en facilitar información tecnológica y periodística.</p>
          </div>
          <div className="rounded-lg border border-border p-6" data-vertical="media">
            <div className="kicker text-[var(--zen-media)]">ZEN Media</div>
            <p className="mt-3 text-sm"><strong>Misión:</strong> Alcanzar el reconocimiento como un medio informativo referente por su rigor, credibilidad e innovación.</p>
            <p className="mt-2 text-sm"><strong>Visión:</strong> Brindar periodismo de calidad sobre la actualidad nacional e internacional.</p>
          </div>
          <div className="rounded-lg border border-border p-6" data-vertical="tech">
            <div className="kicker text-[var(--zen-tech)]">ZEN Tech</div>
            <p className="mt-3 text-sm"><strong>Misión:</strong> Impulsar a las personas a usar la tecnología sin que esta las use a ellas.</p>
            <p className="mt-2 text-sm"><strong>Visión:</strong> Que la tecnología deje de ser territorio de especialistas y vuelva a ser una herramienta al servicio de las personas.</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
