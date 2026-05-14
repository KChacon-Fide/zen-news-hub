import { Link } from "@tanstack/react-router";
import { Search, Radio } from "lucide-react";

export function SiteHeader({ live }: { live?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-serif text-2xl font-black tracking-tight">ZEN</span>
          <span className="kicker text-muted-foreground">NEWS</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link to="/media" className="kicker text-foreground hover:text-[var(--zen-media)]">ZEN Media</Link>
          <Link to="/tech" className="kicker text-foreground hover:text-[var(--zen-tech)]">ZEN Tech</Link>
          <Link to="/about" className="kicker text-muted-foreground hover:text-foreground">Quiénes somos</Link>
          <Link to="/search" className="kicker text-muted-foreground hover:text-foreground">Buscar</Link>
        </nav>
        <div className="flex items-center gap-3">
          {live && (
            <Link to="/live" className="flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground">
              <Radio className="h-3 w-3 animate-pulse" /> EN VIVO
            </Link>
          )}
          <Link to="/search" className="rounded-full p-2 hover:bg-muted"><Search className="h-4 w-4" /></Link>
          <Link to="/admin" className="kicker rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">Admin</Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-card/50">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-16 md:grid-cols-4">
        <div>
          <div className="font-serif text-2xl font-black">ZEN NEWS</div>
          <p className="mt-3 text-sm text-muted-foreground">Periodismo y tecnología, una misma realidad.</p>
        </div>
        <div>
          <div className="kicker mb-3 text-muted-foreground">Verticales</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/media" className="hover:text-[var(--zen-media)]">ZEN Media</Link></li>
            <li><Link to="/tech" className="hover:text-[var(--zen-tech)]">ZEN Tech</Link></li>
          </ul>
        </div>
        <div>
          <div className="kicker mb-3 text-muted-foreground">Empresa</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/about">Quiénes somos</Link></li>
            <li><Link to="/contact">Contacto</Link></li>
          </ul>
        </div>
        <div>
          <div className="kicker mb-3 text-muted-foreground">Sistema</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/admin">Panel administrativo</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ZEN NEWS · Costa Rica
      </div>
    </footer>
  );
}
