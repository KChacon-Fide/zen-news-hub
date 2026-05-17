import "./lib/error-capture";

import { supabaseAdmin } from "./integrations/supabase/client.server";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_MUTATIONS = 120;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

const STATIC_SITEMAP_PATHS = [
  "/",
  "/media",
  "/tech",
  "/videos",
  "/live",
  "/autores",
  "/especiales",
  "/anuncios",
  "/about",
  "/contact",
  "/search",
];

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return withSecurityHeaders(
    new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("cf-connecting-ip") ?? forwarded ?? "local";
  return `${ip}:${new URL(request.url).pathname}`;
}

function rateLimitMutation(request: Request): Response | undefined {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return undefined;

  const now = Date.now();
  if (rateBuckets.size > 5000) {
    for (const [key, bucket] of rateBuckets.entries()) {
      if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
  }

  const key = clientKey(request);
  const current = rateBuckets.get(key);
  const bucket =
    current && current.resetAt > now
      ? { count: current.count + 1, resetAt: current.resetAt }
      : { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };

  rateBuckets.set(key, bucket);

  if (bucket.count <= RATE_LIMIT_MAX_MUTATIONS) return undefined;

  return new Response(JSON.stringify({ message: "Demasiadas solicitudes. Intente de nuevo." }), {
    status: 429,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "retry-after": String(Math.ceil((bucket.resetAt - now) / 1000)),
    },
  });
}

function robotsResponse(request: Request): Response {
  const origin = new URL(request.url).origin;
  return new Response(
    ["User-agent: *", "Allow: /", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n"),
    {
      headers: {
        "cache-control": "public, max-age=3600",
        "content-type": "text/plain; charset=utf-8",
      },
    },
  );
}

async function sitemapResponse(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const urls = new Map<string, { lastmod?: string; priority: string; changefreq: string }>();

  for (const path of STATIC_SITEMAP_PATHS) {
    urls.set(`${origin}${path}`, {
      priority: path === "/" ? "1.0" : "0.7",
      changefreq: path === "/" ? "hourly" : "daily",
    });
  }

  try {
    const [articles, sections] = await Promise.all([
      supabaseAdmin
        .from("articles")
        .select("slug,updated_at,published_at")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("published_at", { ascending: false })
        .limit(1000),
      supabaseAdmin
        .from("sections")
        .select("slug,updated_at")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(500),
    ]);

    for (const article of articles.data ?? []) {
      urls.set(`${origin}/articulo/${article.slug}`, {
        lastmod: article.updated_at ?? article.published_at ?? undefined,
        priority: "0.8",
        changefreq: "daily",
      });
    }

    for (const section of sections.data ?? []) {
      urls.set(`${origin}/seccion/${section.slug}`, {
        lastmod: section.updated_at ?? undefined,
        priority: "0.6",
        changefreq: "daily",
      });
    }
  } catch (error) {
    console.error("Sitemap dynamic data failed", error);
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...Array.from(urls.entries()).map(([loc, meta]) => {
      const lastmod = meta.lastmod ? `<lastmod>${escapeXml(meta.lastmod)}</lastmod>` : "";
      return [
        "  <url>",
        `    <loc>${escapeXml(loc)}</loc>`,
        lastmod ? `    ${lastmod}` : "",
        `    <changefreq>${meta.changefreq}</changefreq>`,
        `    <priority>${meta.priority}</priority>`,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    }),
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=900, stale-while-revalidate=3600",
      "content-type": "application/xml; charset=utf-8",
    },
  });
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://www.instagram.com https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://i.ytimg.com https://*.fbcdn.net https://*.cdninstagram.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.facebook.com https://web.facebook.com https://www.instagram.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 converts in-handler throws into a normal 500 Response with body.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const limited = rateLimitMutation(request);
      if (limited) return withSecurityHeaders(limited);

      const url = new URL(request.url);
      if (url.pathname === "/robots.txt") return withSecurityHeaders(robotsResponse(request));
      if (url.pathname === "/sitemap.xml")
        return withSecurityHeaders(await sitemapResponse(request));

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
