import { Link } from "@tanstack/react-router";
import { Radio, Search, ShieldCheck } from "lucide-react";

export function SiteHeader({ live }: { live?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-serif text-2xl font-black">ZEN</span>
          <span className="text-[0.68rem] font-bold uppercase text-muted-foreground">NEWS</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          <Link
            to="/media"
            className="text-xs font-bold uppercase text-foreground hover:text-[var(--zen-media)]"
          >
            ZEN Media
          </Link>
          <Link
            to="/tech"
            className="text-xs font-bold uppercase text-foreground hover:text-[var(--zen-tech)]"
          >
            ZEN Tech
          </Link>
          <Link
            to="/videos"
            className="text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
          >
            Videos
          </Link>
          <Link
            to="/especiales"
            className="text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
          >
            Especiales
          </Link>
          <Link
            to="/autores"
            className="text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
          >
            Autores
          </Link>
          <Link
            to="/about"
            className="text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
          >
            Quienes somos
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {live && (
            <Link
              to="/live"
              className="flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground"
            >
              <Radio className="h-3 w-3 animate-pulse" /> EN VIVO
            </Link>
          )}
          <Link to="/search" className="rounded-full p-2 hover:bg-muted" aria-label="Buscar">
            <Search className="h-4 w-4" />
          </Link>
          <Link
            to="/admin"
            className="hidden items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted md:flex"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin
          </Link>
        </div>
      </div>

      <div className="border-t border-border lg:hidden">
        <nav className="mx-auto flex max-w-7xl gap-4 overflow-x-auto px-4 py-2 text-xs font-bold uppercase text-muted-foreground">
          <Link to="/media" className="shrink-0 hover:text-[var(--zen-media)]">
            ZEN Media
          </Link>
          <Link to="/tech" className="shrink-0 hover:text-[var(--zen-tech)]">
            ZEN Tech
          </Link>
          <Link to="/videos" className="shrink-0 hover:text-foreground">
            Videos
          </Link>
          <Link to="/especiales" className="shrink-0 hover:text-foreground">
            Especiales
          </Link>
          <Link to="/search" className="shrink-0 hover:text-foreground">
            Buscar
          </Link>
          <Link to="/admin" className="shrink-0 hover:text-foreground">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-card/50">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 md:grid-cols-4 md:px-6">
        <div>
          <div className="font-serif text-2xl font-black">ZEN NEWS</div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Periodismo y tecnologia responsable para comprender una sola realidad.
          </p>
        </div>
        <div>
          <div className="mb-3 text-xs font-bold uppercase text-muted-foreground">Verticales</div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/media" className="hover:text-[var(--zen-media)]">
                ZEN MEDIA
              </Link>
            </li>
            <li>
              <Link to="/tech" className="hover:text-[var(--zen-tech)]">
                ZEN TECH
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-xs font-bold uppercase text-muted-foreground">Empresa</div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/about">Quienes somos</Link>
            </li>
            <li>
              <Link to="/contact">Contacto</Link>
            </li>
            <li>
              <Link to="/anuncios">Anuncios</Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-xs font-bold uppercase text-muted-foreground">Operacion</div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/live">Transmision en vivo</Link>
            </li>
            <li>
              <Link to="/search">Busqueda global</Link>
            </li>
            <li>
              <Link to="/admin">Panel administrativo</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ZEN NEWS · Costa Rica
      </div>
    </footer>
  );
}
