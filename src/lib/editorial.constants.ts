export const ZEN_VERTICALS = {
  news: {
    name: "ZEN NEWS",
    label: "Empresa madre",
    accent: "var(--zen-gold)",
    path: "/",
  },
  media: {
    name: "ZEN MEDIA",
    label: "Actualidad con rigor",
    accent: "var(--zen-media)",
    path: "/media",
  },
  tech: {
    name: "ZEN TECH",
    label: "Tecnologia util",
    accent: "var(--zen-tech)",
    path: "/tech",
  },
} as const;

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  director_editorial: "Director Editorial",
  editor_media: "Editor ZEN MEDIA",
  editor_tech: "Editor ZEN TECH",
  redactor: "Redactor",
  revisor: "Revisor",
  multimedia: "Multimedia",
  analista: "Analista",
  readonly: "Solo lectura",
};

export const ARTICLE_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  review: "Revision",
  scheduled: "Programada",
  published: "Publicada",
  archived: "Archivada",
};

export const LIVE_STATUS_LABELS: Record<string, string> = {
  scheduled: "Programada",
  active: "Activa",
  paused: "Pausada",
  finished: "Finalizada",
};

export const PUBLIC_IMAGE_FALLBACKS = {
  newsroom:
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1400&q=80",
  media:
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80",
  tech: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80",
  live: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=1400&q=80",
};

export const PLATFORM_MODULES = [
  "Dashboard",
  "Noticias",
  "Verticales",
  "Secciones",
  "En vivo",
  "Multimedia",
  "Contenido externo",
  "Usuarios",
  "Apariencia",
  "Auditoria",
  "Seguridad",
  "Configuracion",
] as const;

export type VerticalSlug = keyof typeof ZEN_VERTICALS;
