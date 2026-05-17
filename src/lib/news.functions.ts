import { createServerFn } from "@tanstack/react-start";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  deriveLiveEmbed,
  deriveYouTubeEmbedUrl,
  estimateReadingTime,
  sanitizeHtml,
  slugify,
} from "@/lib/security";

type AppRole =
  | "super_admin"
  | "director_editorial"
  | "editor_media"
  | "editor_tech"
  | "redactor"
  | "revisor"
  | "multimedia"
  | "analista"
  | "readonly";

type VerticalSlug = "news" | "media" | "tech";

const elevatedRoles = new Set<AppRole>(["super_admin", "director_editorial"]);
const adminRoles = new Set<AppRole>([
  "super_admin",
  "director_editorial",
  "editor_media",
  "editor_tech",
  "redactor",
  "revisor",
  "multimedia",
  "analista",
  "readonly",
]);

const appRoleSchema = z.enum([
  "super_admin",
  "director_editorial",
  "editor_media",
  "editor_tech",
  "redactor",
  "revisor",
  "multimedia",
  "analista",
  "readonly",
]);

function hasAnyRole(roles: AppRole[], allowed: AppRole[]) {
  return roles.some((role) => allowed.includes(role));
}

function canEditVertical(roles: AppRole[], vertical: VerticalSlug) {
  if (roles.some((role) => elevatedRoles.has(role))) return true;
  if (vertical === "media" && roles.includes("editor_media")) return true;
  if (vertical === "tech" && roles.includes("editor_tech")) return true;
  return hasAnyRole(roles, ["redactor", "revisor", "multimedia"]);
}

function canPublish(roles: AppRole[]) {
  return hasAnyRole(roles, ["super_admin", "director_editorial", "editor_media", "editor_tech"]);
}

async function getAdminContext(userId: string) {
  const [profileResult, rolesResult] = await Promise.all([
    supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const profile = profileResult.data as any;
  if (profile?.is_active === false) {
    throw new Error("Tu usuario administrativo esta desactivado.");
  }

  const roles = ((rolesResult.data ?? []).map((row) => row.role) as AppRole[]).filter((role) =>
    adminRoles.has(role),
  );

  if (roles.length === 0) {
    throw new Error("No tienes permisos administrativos.");
  }

  return {
    userId,
    profile,
    roles,
  };
}

async function writeAudit(
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  await supabaseAdmin.from("audit_logs").insert({
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    metadata: metadata ?? {},
  });
}

function cleanOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertSuperAdmin(roles: AppRole[]) {
  if (!roles.includes("super_admin")) {
    throw new Error("Solo Super Admin puede realizar esta accion.");
  }
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return textValue(record["#text"] ?? record._text ?? record.cdata ?? "");
  }
  return "";
}

function stripHtml(value: string) {
  return decodeEntities(sanitizeHtml(value))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function limitText(value: string | null | undefined, max: number) {
  const clean = cleanOptionalString(value);
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, Math.max(0, max - 1)).trim()}…` : clean;
}

function normalizeExternalDate(value: string) {
  const parsed = value ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function normalizeTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractExternalImage(item: any): string | null {
  const enclosure = asArray(item.enclosure)[0];
  const mediaContent = asArray(item["media:content"])[0];
  const mediaThumbnail = asArray(item["media:thumbnail"])[0];
  const candidate =
    enclosure?.["@_url"] ??
    mediaContent?.["@_url"] ??
    mediaThumbnail?.["@_url"] ??
    item.image?.url ??
    item.image;

  const clean = textValue(candidate).trim();
  return clean.startsWith("http") ? clean : null;
}

function parseRssItems(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });
  const parsed = parser.parse(xml);
  const rssItems = asArray(parsed?.rss?.channel?.item);
  const atomEntries = asArray(parsed?.feed?.entry);
  const items = rssItems.length > 0 ? rssItems : atomEntries;

  return items
    .map((item: any) => {
      const atomLink = asArray(item.link).find((link: any) => link?.["@_href"]);
      const link = textValue(item.link) || atomLink?.["@_href"] || textValue(item.guid);
      const sourceName = stripHtml(textValue(item.source));
      const rawTitle = stripHtml(textValue(item.title));
      const title =
        sourceName && rawTitle.endsWith(` - ${sourceName}`)
          ? rawTitle.slice(0, -sourceName.length - 3).trim()
          : rawTitle;
      const description = stripHtml(
        textValue(item.description ?? item.summary ?? item.content ?? item["content:encoded"]),
      );

      return {
        external_url: link.trim(),
        original_url: link.trim(),
        title,
        description,
        image_url: extractExternalImage(item),
        published_at: normalizeExternalDate(
          textValue(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"]),
        ),
        source_name: sourceName || null,
        normalized_title: normalizeTitle(title),
        raw_payload: item,
      };
    })
    .filter((item) => item.external_url.startsWith("http") && item.title);
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function statusPublishedFilter(query: any) {
  const now = new Date().toISOString();
  return query
    .eq("status", "published")
    .is("deleted_at", null)
    .or(`published_at.is.null,published_at.lte.${now}`);
}

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const [verticals, breaking, featured, latest, mostRead, live, videos, sponsored, blocks, ads] =
    await Promise.all([
      supabaseAdmin.from("verticals").select("*").eq("active", true).order("sort_order"),
      statusPublishedFilter(
        supabaseAdmin
          .from("articles")
          .select(
            "id,title,slug,subtitle,summary,cover_image_url,published_at,vertical_id,section_id,reading_time,is_breaking,verticals(name,slug),sections(name,slug)",
          )
          .eq("is_breaking", true),
      )
        .order("published_at", { ascending: false })
        .limit(1),
      statusPublishedFilter(
        supabaseAdmin
          .from("articles")
          .select(
            "id,title,slug,subtitle,summary,cover_image_url,published_at,vertical_id,section_id,reading_time,views_count,verticals(name,slug),sections(name,slug)",
          )
          .eq("is_featured", true),
      )
        .order("published_at", { ascending: false })
        .limit(8),
      statusPublishedFilter(
        supabaseAdmin
          .from("articles")
          .select(
            "id,title,slug,subtitle,summary,cover_image_url,published_at,vertical_id,section_id,reading_time,views_count,verticals(name,slug),sections(name,slug)",
          ),
      )
        .order("published_at", { ascending: false })
        .limit(16),
      statusPublishedFilter(
        supabaseAdmin
          .from("articles")
          .select(
            "id,title,slug,cover_image_url,published_at,vertical_id,views_count,verticals(name,slug)",
          ),
      )
        .order("views_count", { ascending: false })
        .limit(6),
      supabaseAdmin
        .from("live_streams")
        .select(
          "id,title,description,platform,embed_url,stream_url,status,starts_at,cover_image_url,allow_live_button",
        )
        .eq("status", "active")
        .eq("allow_live_button", true)
        .order("starts_at", { ascending: false })
        .limit(1),
      statusPublishedFilter(
        supabaseAdmin
          .from("articles")
          .select(
            "id,title,slug,subtitle,cover_image_url,video_url,video_embed_url,published_at,verticals(name,slug)",
          )
          .not("video_url", "is", null),
      )
        .order("published_at", { ascending: false })
        .limit(4),
      statusPublishedFilter(
        supabaseAdmin
          .from("articles")
          .select("id,title,slug,subtitle,cover_image_url,published_at,verticals(name,slug)")
          .eq("is_sponsored", true),
      )
        .order("published_at", { ascending: false })
        .limit(4),
      (supabaseAdmin as any)
        .from("page_blocks")
        .select("*")
        .eq("page_key", "home")
        .eq("active", true)
        .order("sort_order"),
      supabaseAdmin
        .from("ads")
        .select("*")
        .eq("active", true)
        .or("starts_at.is.null,starts_at.lte.now()")
        .or("ends_at.is.null,ends_at.gte.now()")
        .limit(4),
    ]);

  return {
    verticals: verticals.data ?? [],
    breaking: breaking.data?.[0] ?? null,
    featured: featured.data ?? [],
    latest: latest.data ?? [],
    mostRead: mostRead.data ?? [],
    live: live.data?.[0] ?? null,
    videos: videos.data ?? [],
    sponsored: sponsored.data ?? [],
    blocks: blocks.data ?? [],
    ads: ads.data ?? [],
  };
});

export const getVerticalData = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.enum(["media", "tech"]) }))
  .handler(async ({ data }) => {
    const { data: vertical } = await supabaseAdmin
      .from("verticals")
      .select("*")
      .eq("slug", data.slug)
      .eq("active", true)
      .single();

    if (!vertical) return { vertical: null, articles: [], sections: [], mostRead: [], live: null };

    const [articles, sections, mostRead, live] = await Promise.all([
      statusPublishedFilter(
        supabaseAdmin
          .from("articles")
          .select(
            "id,title,slug,subtitle,summary,cover_image_url,published_at,section_id,reading_time,is_featured,is_breaking,is_sponsored,views_count,sections(name,slug)",
          )
          .eq("vertical_id", vertical.id),
      )
        .order("published_at", { ascending: false })
        .limit(36),
      supabaseAdmin
        .from("sections")
        .select("id,name,slug,sort_order,show_in_home,show_in_menu,color")
        .eq("vertical_id", vertical.id)
        .eq("active", true)
        .order("sort_order"),
      statusPublishedFilter(
        supabaseAdmin
          .from("articles")
          .select("id,title,slug,cover_image_url,published_at,views_count")
          .eq("vertical_id", vertical.id),
      )
        .order("views_count", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("live_streams")
        .select("id,title,description,platform,embed_url,stream_url,status,starts_at")
        .eq("status", "active")
        .or(`vertical_id.is.null,vertical_id.eq.${vertical.id}`)
        .order("starts_at", { ascending: false })
        .limit(1),
    ]);

    return {
      vertical,
      articles: articles.data ?? [],
      sections: sections.data ?? [],
      mostRead: mostRead.data ?? [],
      live: live.data?.[0] ?? null,
    };
  });

export const getArticle = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().min(1).max(160) }))
  .handler(async ({ data }) => {
    const { data: article } = await supabaseAdmin
      .from("articles")
      .select(
        "*, verticals(slug,name,primary_color,accent_color), sections(name,slug), authors(name,slug,bio,avatar_url)",
      )
      .eq("slug", data.slug)
      .eq("status", "published")
      .is("deleted_at", null)
      .or("published_at.is.null,published_at.lte.now()")
      .single();

    if (!article) return { article: null, related: [], tags: [] };

    await (supabaseAdmin as any).rpc("increment_article_view", { _slug: data.slug });

    const [related, tags] = await Promise.all([
      supabaseAdmin
        .from("articles")
        .select("id,title,slug,cover_image_url,published_at,summary")
        .eq("vertical_id", article.vertical_id)
        .eq("status", "published")
        .neq("id", article.id)
        .is("deleted_at", null)
        .order("published_at", { ascending: false })
        .limit(4),
      supabaseAdmin.from("article_tags").select("tags(name,slug)").eq("article_id", article.id),
    ]);

    return { article, related: related.data ?? [], tags: tags.data ?? [] };
  });

export const searchArticles = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      q: z.string().max(120).optional().default(""),
      verticalSlug: z.enum(["media", "tech"]).optional(),
      sectionSlug: z.string().max(120).optional(),
    }),
  )
  .handler(async ({ data }) => {
    let query = statusPublishedFilter(
      supabaseAdmin
        .from("articles")
        .select(
          "id,title,slug,subtitle,summary,cover_image_url,published_at,vertical_id,section_id,reading_time,verticals(name,slug),sections(name,slug)",
        ),
    );

    if (data.verticalSlug) {
      const { data: vertical } = await supabaseAdmin
        .from("verticals")
        .select("id")
        .eq("slug", data.verticalSlug)
        .single();
      if (vertical) query = query.eq("vertical_id", vertical.id);
    }

    if (data.sectionSlug) {
      const { data: sections } = await supabaseAdmin
        .from("sections")
        .select("id")
        .eq("slug", data.sectionSlug)
        .eq("active", true);
      const sectionIds = (sections ?? []).map((section) => section.id);
      if (sectionIds.length > 0) query = query.in("section_id", sectionIds);
    }

    const term = data.q.trim().replace(/[%,]/g, " ");
    if (term) {
      query = query.or(`title.ilike.%${term}%,subtitle.ilike.%${term}%,summary.ilike.%${term}%`);
    }

    const { data: articles } = await query.order("published_at", { ascending: false }).limit(40);
    return { articles: articles ?? [], q: data.q };
  });

export const getSectionData = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      slug: z.string().min(1).max(120),
      verticalSlug: z.enum(["media", "tech"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    let sectionQuery = supabaseAdmin
      .from("sections")
      .select("*, verticals(id,name,slug,primary_color,accent_color)")
      .eq("slug", data.slug)
      .eq("active", true)
      .limit(2);

    if (data.verticalSlug) {
      const { data: vertical } = await supabaseAdmin
        .from("verticals")
        .select("id")
        .eq("slug", data.verticalSlug)
        .single();
      if (vertical) sectionQuery = sectionQuery.eq("vertical_id", vertical.id);
    }

    const { data: sections } = await sectionQuery;
    const section = sections?.[0] ?? null;
    if (!section) return { section: null, articles: [] };

    const articles = await statusPublishedFilter(
      supabaseAdmin
        .from("articles")
        .select(
          "id,title,slug,subtitle,summary,cover_image_url,published_at,reading_time,verticals(name,slug),sections(name,slug)",
        )
        .eq("section_id", section.id),
    )
      .order("published_at", { ascending: false })
      .limit(36);

    return { section, articles: articles.data ?? [] };
  });

export const getLiveData = createServerFn({ method: "GET" }).handler(async () => {
  const [active, history] = await Promise.all([
    supabaseAdmin
      .from("live_streams")
      .select("*, verticals(name,slug)")
      .eq("status", "active")
      .order("starts_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("live_streams")
      .select(
        "id,title,description,platform,status,starts_at,ends_at,cover_image_url,verticals(name,slug)",
      )
      .in("status", ["scheduled", "paused", "finished"])
      .order("starts_at", { ascending: false })
      .limit(12),
  ]);

  return { active: active.data?.[0] ?? null, history: history.data ?? [] };
});

export const getVideos = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await statusPublishedFilter(
    supabaseAdmin
      .from("articles")
      .select(
        "id,title,slug,subtitle,summary,cover_image_url,video_url,video_embed_url,published_at,verticals(name,slug)",
      )
      .not("video_url", "is", null),
  )
    .order("published_at", { ascending: false })
    .limit(36);
  return { videos: data ?? [] };
});

export const getAuthors = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("authors")
    .select("id,name,slug,bio,avatar_url,email,twitter")
    .eq("active", true)
    .order("name");
  return { authors: data ?? [] };
});

export const getSpecials = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await statusPublishedFilter(
    supabaseAdmin
      .from("articles")
      .select(
        "id,title,slug,subtitle,summary,cover_image_url,published_at,reading_time,verticals(name,slug),sections(name,slug)",
      )
      .or(
        "is_week_main.eq.true,sections.slug.eq.reportajes-especiales,sections.slug.eq.reportajes",
      ),
  )
    .order("published_at", { ascending: false })
    .limit(36);
  return { articles: data ?? [] };
});

export const getSponsored = createServerFn({ method: "GET" }).handler(async () => {
  const [articles, ads] = await Promise.all([
    statusPublishedFilter(
      supabaseAdmin
        .from("articles")
        .select("id,title,slug,subtitle,summary,cover_image_url,published_at,verticals(name,slug)")
        .eq("is_sponsored", true),
    )
      .order("published_at", { ascending: false })
      .limit(36),
    supabaseAdmin.from("ads").select("*, verticals(name,slug)").eq("active", true).limit(20),
  ]);
  return { articles: articles.data ?? [], ads: ads.data ?? [] };
});

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email(),
      name: z.string().max(120).optional(),
      verticalSlug: z.enum(["news", "media", "tech"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).from("newsletters").upsert(
      {
        email: data.email.toLowerCase(),
        name: cleanOptionalString(data.name),
        vertical_slug: data.verticalSlug ?? "news",
        consent: true,
        status: "subscribed",
        source: "public_site",
      },
      { onConflict: "email" },
    );

    if (error) throw new Error("No se pudo registrar el newsletter.");
    return { ok: true };
  });

export const getAdminSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: any) => {
    const admin = await getAdminContext(context.userId);

    const [
      verticals,
      sections,
      articles,
      live,
      imports,
      audit,
      security,
      authors,
      media,
      roles,
      profiles,
      externalSources,
      integrations,
    ] = await Promise.all([
      supabaseAdmin.from("verticals").select("*").order("sort_order"),
      supabaseAdmin.from("sections").select("*, verticals(name,slug)").order("sort_order"),
      supabaseAdmin
        .from("articles")
        .select(
          "id,title,slug,subtitle,summary,content,content_html,cover_image_url,cover_image_alt,video_url,status,source_type,external_url,external_source_name,is_breaking,is_featured,is_week_main,is_sponsored,published_at,scheduled_at,seo_title,seo_description,created_at,updated_at,views_count,vertical_id,section_id,author_id,verticals(name,slug),sections(name,slug),authors(name,slug)",
        )
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(120),
      supabaseAdmin
        .from("live_streams")
        .select("*, verticals(name,slug)")
        .order("created_at", { ascending: false })
        .limit(30),
      supabaseAdmin
        .from("external_imports")
        .select("*, external_sources(name,kind,config)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(40),
      supabaseAdmin
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin.from("authors").select("*").order("name"),
      supabaseAdmin
        .from("media_assets")
        .select("*, verticals(name,slug)")
        .order("created_at", { ascending: false })
        .limit(60),
      supabaseAdmin.from("user_roles").select("role,user_id").limit(500),
      (supabaseAdmin as any).from("profiles").select("*").order("created_at", { ascending: false }),
      (supabaseAdmin as any)
        .from("external_sources")
        .select("*")
        .eq("kind", "google_news")
        .order("created_at", { ascending: false }),
      (supabaseAdmin as any).from("api_integrations").select("*").order("provider"),
    ]);

    let authUsers: any[] = [];
    try {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      authUsers = data.users;
    } catch (error) {
      console.error("No se pudo listar Auth Admin users", error);
    }

    const profileById = new Map((profiles.data ?? []).map((profile: any) => [profile.id, profile]));
    const rolesByUser = new Map<string, AppRole[]>();
    for (const row of roles.data ?? []) {
      const current = rolesByUser.get(row.user_id) ?? [];
      current.push(row.role as AppRole);
      rolesByUser.set(row.user_id, current);
    }
    const authById = new Map(authUsers.map((user) => [user.id, user]));
    const adminUserIds = new Set<string>([...rolesByUser.keys(), ...profileById.keys()]);
    const adminUsers = [...adminUserIds]
      .map((userId) => {
        const profile = profileById.get(userId) as any;
        const authUser = authById.get(userId);
        const userRoles = rolesByUser.get(userId) ?? [];
        return {
          id: userId,
          email: profile?.email ?? authUser?.email ?? "",
          full_name:
            profile?.full_name ?? profile?.display_name ?? authUser?.user_metadata?.full_name ?? "",
          is_active: profile?.is_active !== false,
          must_change_password: profile?.must_change_password === true,
          roles: userRoles,
          created_at: profile?.created_at ?? authUser?.created_at,
          last_sign_in_at: authUser?.last_sign_in_at ?? null,
        };
      })
      .filter((user) => user.roles.length > 0 || user.email)
      .sort((a, b) => String(a.email).localeCompare(String(b.email)));

    const articleRows = articles.data ?? [];
    const counts = {
      published: articleRows.filter((article) => article.status === "published").length,
      draft: articleRows.filter((article) => article.status === "draft").length,
      review: articleRows.filter((article) => article.status === "review").length,
      scheduled: articleRows.filter((article) => article.status === "scheduled").length,
      archived: articleRows.filter((article) => article.status === "archived").length,
      activeLive: (live.data ?? []).filter((item) => item.status === "active").length,
      pendingImports: (imports.data ?? []).filter((item) => item.status === "pending").length,
      admins: adminUsers.filter((user) => user.roles.length > 0 && user.is_active).length,
      securityAlerts: (security.data ?? []).filter(
        (event) => event.severity === "high" || event.severity === "critical",
      ).length,
    };

    return {
      admin,
      counts,
      verticals: verticals.data ?? [],
      sections: sections.data ?? [],
      articles: articleRows,
      liveStreams: live.data ?? [],
      externalImports: imports.data ?? [],
      auditLogs: audit.data ?? [],
      securityEvents: security.data ?? [],
      authors: authors.data ?? [],
      mediaAssets: media.data ?? [],
      externalSources: externalSources.data ?? [],
      integrations: integrations.data ?? [],
      adminUsers,
    };
  });

const articleInputSchema = z.object({
  id: z.string().uuid().optional(),
  vertical_id: z.string().uuid(),
  section_id: z.string().uuid().nullable().optional(),
  author_id: z.string().uuid().nullable().optional(),
  title: z.string().min(3).max(220),
  slug: z.string().max(160).optional(),
  subtitle: z.string().max(10000).nullable().optional(),
  summary: z.string().max(10000).nullable().optional(),
  lead_html: z.string().max(30000).nullable().optional(),
  content_html: z.string().max(100000).optional().default(""),
  cover_image_url: z.string().url().nullable().optional(),
  cover_image_alt: z.string().max(220).nullable().optional(),
  video_url: z.string().url().nullable().optional(),
  status: z.enum(["draft", "review", "scheduled", "published", "archived"]).default("draft"),
  source_type: z.enum(["original", "external", "sponsored"]).default("original"),
  external_url: z.string().url().nullable().optional(),
  external_source_name: z.string().max(160).nullable().optional(),
  is_breaking: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  is_week_main: z.boolean().default(false),
  is_sponsored: z.boolean().default(false),
  published_at: z.string().nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  seo_title: z.string().max(220).nullable().optional(),
  seo_description: z.string().max(10000).nullable().optional(),
  tags: z.array(z.string().min(1).max(80)).optional().default([]),
});

export const saveArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(articleInputSchema)
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    const { data: vertical } = await supabaseAdmin
      .from("verticals")
      .select("id,slug")
      .eq("id", data.vertical_id)
      .single();

    if (!vertical || !canEditVertical(admin.roles, vertical.slug as VerticalSlug)) {
      throw new Error("No tienes permisos para editar esta vertical.");
    }

    if (data.status === "published" && !canPublish(admin.roles)) {
      throw new Error("Tu rol no puede publicar contenido.");
    }

    const sanitizedLeadHtml = sanitizeHtml(data.lead_html ?? "");
    const sanitizedHtml = sanitizeHtml(data.content_html);
    const plainLead = stripHtml(data.summary || sanitizedLeadHtml);
    const slug = slugify(data.slug || data.title);
    const videoEmbedUrl = deriveYouTubeEmbedUrl(data.video_url);
    const payload = {
      vertical_id: data.vertical_id,
      section_id: data.section_id ?? null,
      author_id: data.author_id ?? null,
      title: data.title.trim(),
      slug,
      subtitle: limitText(data.subtitle, 700),
      summary: limitText(plainLead, 1000),
      content: { type: "html", lead_html: sanitizedLeadHtml },
      content_html: sanitizedHtml,
      cover_image_url: cleanOptionalString(data.cover_image_url),
      cover_image_alt: cleanOptionalString(data.cover_image_alt),
      video_url: cleanOptionalString(data.video_url),
      video_embed_url: videoEmbedUrl || null,
      status: data.status,
      source_type: data.source_type,
      external_url: cleanOptionalString(data.external_url),
      external_source_name: cleanOptionalString(data.external_source_name),
      is_breaking: data.is_breaking,
      is_featured: data.is_featured,
      is_week_main: data.is_week_main,
      is_sponsored: data.is_sponsored || data.source_type === "sponsored",
      published_at:
        data.status === "published"
          ? data.published_at || new Date().toISOString()
          : (data.published_at ?? null),
      scheduled_at: data.status === "scheduled" ? data.scheduled_at : null,
      seo_title: cleanOptionalString(data.seo_title) ?? data.title.trim(),
      seo_description: limitText(data.seo_description ?? plainLead, 320),
      reading_time: estimateReadingTime(sanitizedHtml || plainLead || data.title),
      updated_by: admin.userId,
    };

    if (data.id) {
      const { data: previous } = await supabaseAdmin
        .from("articles")
        .select("*")
        .eq("id", data.id)
        .single();
      if (previous) {
        await supabaseAdmin.from("article_versions").insert({
          article_id: data.id,
          snapshot: previous,
          edited_by: admin.userId,
        });
      }

      const { data: updated, error } = await supabaseAdmin
        .from("articles")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw error;
      await syncArticleTags(updated.id, data.tags);
      await writeAudit("article_updated", "articles", updated.id, { status: data.status });
      return { article: updated };
    }

    const { data: created, error } = await supabaseAdmin
      .from("articles")
      .insert({ ...payload, created_by: admin.userId })
      .select("*")
      .single();
    if (error) throw error;
    await syncArticleTags(created.id, data.tags);
    await writeAudit("article_created", "articles", created.id, { status: data.status });
    return { article: created };
  });

async function syncArticleTags(articleId: string, tags: string[]) {
  await supabaseAdmin.from("article_tags").delete().eq("article_id", articleId);
  const uniqueTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
  for (const name of uniqueTags) {
    const tagSlug = slugify(name);
    const { data: tag } = await supabaseAdmin
      .from("tags")
      .upsert({ name, slug: tagSlug }, { onConflict: "slug" })
      .select("id")
      .single();
    if (tag) {
      await supabaseAdmin.from("article_tags").insert({ article_id: articleId, tag_id: tag.id });
    }
  }
}

export const archiveArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    const { data: article } = await supabaseAdmin
      .from("articles")
      .select("id,verticals(slug)")
      .eq("id", data.id)
      .single();
    const verticalSlug = (article?.verticals as any)?.slug as VerticalSlug | undefined;
    if (!verticalSlug || !canEditVertical(admin.roles, verticalSlug))
      throw new Error("No tienes permisos para archivar.");

    const { error } = await supabaseAdmin
      .from("articles")
      .update({ status: "archived", updated_by: admin.userId })
      .eq("id", data.id);
    if (error) throw error;
    await writeAudit("article_archived", "articles", data.id);
    return { ok: true };
  });

export const saveSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      vertical_id: z.string().uuid(),
      name: z.string().min(2).max(120),
      slug: z.string().max(120).optional(),
      description: z.string().max(500).nullable().optional(),
      color: z.string().max(40).nullable().optional(),
      sort_order: z.number().int().min(0).max(999).default(0),
      show_in_menu: z.boolean().default(true),
      show_in_home: z.boolean().default(true),
      active: z.boolean().default(true),
    }),
  )
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    const { data: vertical } = await supabaseAdmin
      .from("verticals")
      .select("id,slug")
      .eq("id", data.vertical_id)
      .single();
    if (!vertical || !canEditVertical(admin.roles, vertical.slug as VerticalSlug)) {
      throw new Error("No tienes permisos para administrar esta seccion.");
    }

    const payload = {
      vertical_id: data.vertical_id,
      name: data.name.trim(),
      slug: slugify(data.slug || data.name),
      description: cleanOptionalString(data.description),
      color: cleanOptionalString(data.color),
      sort_order: data.sort_order,
      show_in_menu: data.show_in_menu,
      show_in_home: data.show_in_home,
      active: data.active,
    };

    const mutation = data.id
      ? supabaseAdmin.from("sections").update(payload).eq("id", data.id)
      : supabaseAdmin.from("sections").insert(payload);
    const { error } = await mutation;
    if (error) throw error;
    await writeAudit(data.id ? "section_updated" : "section_created", "sections", data.id);
    return { ok: true };
  });

export const saveVertical = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(2).max(120),
      tagline: z.string().max(160).nullable().optional(),
      description: z.string().max(10000).nullable().optional(),
      mission: z.string().max(1200).nullable().optional(),
      vision: z.string().max(1200).nullable().optional(),
      primary_color: z.string().max(40),
      accent_color: z.string().max(40),
      seo_title: z.string().max(220).nullable().optional(),
      seo_description: z.string().max(320).nullable().optional(),
      active: z.boolean(),
      sort_order: z.number().int().min(0).max(99),
    }),
  )
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    if (!hasAnyRole(admin.roles, ["super_admin", "director_editorial"])) {
      throw new Error("No tienes permisos para administrar verticales.");
    }

    const { error } = await supabaseAdmin
      .from("verticals")
      .update({
        name: data.name.trim(),
        tagline: cleanOptionalString(data.tagline),
        description: cleanOptionalString(data.description),
        mission: cleanOptionalString(data.mission),
        vision: cleanOptionalString(data.vision),
        primary_color: data.primary_color,
        accent_color: data.accent_color,
        seo_title: cleanOptionalString(data.seo_title),
        seo_description: cleanOptionalString(data.seo_description),
        active: data.active,
        sort_order: data.sort_order,
      })
      .eq("id", data.id);
    if (error) throw error;
    await writeAudit("vertical_updated", "verticals", data.id);
    return { ok: true };
  });

export const saveLiveStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      vertical_id: z.string().uuid().nullable().optional(),
      title: z.string().min(3).max(220),
      description: z.string().max(1000).nullable().optional(),
      platform: z.enum(["youtube", "facebook", "instagram", "other"]),
      stream_url: z.string().url(),
      cover_image_url: z.string().url().nullable().optional(),
      status: z.enum(["scheduled", "active", "paused", "finished"]),
      starts_at: z.string().nullable().optional(),
      ends_at: z.string().nullable().optional(),
      allow_live_button: z.boolean().default(true),
    }),
  )
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    if (
      !hasAnyRole(admin.roles, [
        "super_admin",
        "director_editorial",
        "editor_media",
        "editor_tech",
        "multimedia",
      ])
    ) {
      throw new Error("No tienes permisos para administrar transmisiones.");
    }

    const embed = deriveLiveEmbed(data.platform, data.stream_url);
    if (data.platform !== "instagram" && !embed.embeddable) {
      throw new Error("El enlace de transmision no es compatible con la plataforma seleccionada.");
    }

    const payload = {
      vertical_id: data.vertical_id ?? null,
      title: data.title.trim(),
      description: cleanOptionalString(data.description),
      platform: data.platform,
      stream_url: data.stream_url,
      embed_url: embed.embedUrl || null,
      cover_image_url: cleanOptionalString(data.cover_image_url),
      status: data.status,
      starts_at: data.starts_at ?? null,
      ends_at: data.ends_at ?? null,
      allow_live_button: data.allow_live_button,
      embed_sanitized: !!embed.embedUrl,
      updated_by: admin.userId,
    };

    const mutation = data.id
      ? supabaseAdmin.from("live_streams").update(payload).eq("id", data.id).select("id").single()
      : supabaseAdmin
          .from("live_streams")
          .insert({ ...payload, created_by: admin.userId })
          .select("id")
          .single();
    const { data: row, error } = await mutation;
    if (error) throw error;
    await writeAudit(
      data.id ? "live_stream_updated" : "live_stream_created",
      "live_streams",
      row?.id,
    );
    return { ok: true, id: row?.id };
  });

export const saveMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      vertical_id: z.string().uuid().nullable().optional(),
      url: z.string().url(),
      storage_path: z.string().max(500).nullable().optional(),
      mime_type: z.string().max(120).nullable().optional(),
      size_bytes: z.number().int().nonnegative().nullable().optional(),
      alt_text: z.string().min(3).max(220),
      caption: z.string().max(500).nullable().optional(),
      kind: z.string().max(40).default("image"),
    }),
  )
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    if (
      !hasAnyRole(admin.roles, [
        "super_admin",
        "director_editorial",
        "editor_media",
        "editor_tech",
        "multimedia",
      ])
    ) {
      throw new Error("No tienes permisos para administrar multimedia.");
    }

    const { data: asset, error } = await supabaseAdmin
      .from("media_assets")
      .insert({
        vertical_id: data.vertical_id ?? null,
        uploaded_by: admin.userId,
        storage_path: cleanOptionalString(data.storage_path),
        url: data.url,
        mime_type: cleanOptionalString(data.mime_type),
        size_bytes: data.size_bytes ?? null,
        alt_text: data.alt_text.trim(),
        caption: cleanOptionalString(data.caption),
        kind: data.kind,
      })
      .select("*")
      .single();
    if (error) throw error;
    await writeAudit("media_asset_created", "media_assets", asset.id);
    return { asset };
  });

export const deleteMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    if (
      !hasAnyRole(admin.roles, [
        "super_admin",
        "director_editorial",
        "editor_media",
        "editor_tech",
        "multimedia",
      ])
    ) {
      throw new Error("No tienes permisos para eliminar multimedia.");
    }

    const { data: asset, error: assetError } = await supabaseAdmin
      .from("media_assets")
      .select("*")
      .eq("id", data.id)
      .single();
    if (assetError || !asset) throw new Error("No se encontro el archivo multimedia.");

    const [articleImage, articleVideo, liveCover] = await Promise.all([
      supabaseAdmin
        .from("articles")
        .select("id")
        .eq("cover_image_url", asset.url)
        .is("deleted_at", null)
        .limit(1),
      supabaseAdmin
        .from("articles")
        .select("id")
        .eq("video_url", asset.url)
        .is("deleted_at", null)
        .limit(1),
      supabaseAdmin.from("live_streams").select("id").eq("cover_image_url", asset.url).limit(1),
    ]);

    if (
      (articleImage.data?.length ?? 0) > 0 ||
      (articleVideo.data?.length ?? 0) > 0 ||
      (liveCover.data?.length ?? 0) > 0
    ) {
      throw new Error(
        "Este archivo esta usado en una noticia o transmision. Retiralo primero antes de eliminarlo.",
      );
    }

    if (asset.storage_path) {
      const { error: storageError } = await supabaseAdmin.storage
        .from("media")
        .remove([asset.storage_path]);
      if (storageError) throw storageError;
    }

    const { error } = await supabaseAdmin.from("media_assets").delete().eq("id", data.id);
    if (error) throw error;
    await writeAudit("media_asset_deleted", "media_assets", data.id, {
      url: asset.url,
      storage_path: asset.storage_path,
      kind: asset.kind,
    });
    return { ok: true };
  });

export const logSystemProblem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      message: z.string().min(1).max(2000),
      panel: z.string().max(80).nullable().optional(),
      context: z.record(z.unknown()).optional().default({}),
    }),
  )
  .handler(async ({ data, context }: any) => {
    let admin;
    try {
      admin = await getAdminContext(context.userId);
    } catch {
      admin = { userId: context.userId };
    }
    await writeAudit("system_problem", "admin_ui", undefined, {
      message: data.message,
      panel: data.panel ?? null,
      context: data.context ?? {},
      captured_at: new Date().toISOString(),
      actor_id: admin.userId,
    });
    return { ok: true };
  });

export const saveAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      email: z.string().email().max(180),
      full_name: z.string().min(2).max(160),
      role: appRoleSchema,
      password: z.string().min(12).max(128).optional(),
      is_active: z.boolean().default(true),
    }),
  )
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    assertSuperAdmin(admin.roles);

    const email = data.email.toLowerCase().trim();
    const fullName = data.full_name.trim();
    let userId = data.id as string | undefined;

    if (!userId) {
      const existing = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = existing.data.users.find((user) => user.email?.toLowerCase() === email)?.id;
    }

    if (userId) {
      const updates: any = {
        email,
        user_metadata: { full_name: fullName, must_change_password: !!data.password },
      };
      if (data.password) updates.password = data.password;

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
      if (authError) throw authError;
    } else {
      if (!data.password) {
        throw new Error("La contrasena temporal es obligatoria para crear un admin.");
      }
      const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: fullName, must_change_password: true },
      });
      if (authError) throw authError;
      userId = created.user?.id;
    }

    if (!userId) throw new Error("No se pudo resolver el usuario administrativo.");

    const { error: profileError } = await (supabaseAdmin as any).from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        display_name: fullName,
        is_active: data.is_active,
        must_change_password: data.password ? true : undefined,
        disabled_at: data.is_active ? null : new Date().toISOString(),
        disabled_by: data.is_active ? null : admin.userId,
      },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (roleError) throw roleError;

    await writeAudit(data.id ? "admin_user_updated" : "admin_user_created", "profiles", userId, {
      email,
      role: data.role,
      active: data.is_active,
    });

    return { ok: true, id: userId };
  });

export const setAdminUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), is_active: z.boolean() }))
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    assertSuperAdmin(admin.roles);

    if (data.id === admin.userId && !data.is_active) {
      throw new Error("No puedes desactivar tu propio Super Admin.");
    }

    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({
        is_active: data.is_active,
        disabled_at: data.is_active ? null : new Date().toISOString(),
        disabled_by: data.is_active ? null : admin.userId,
      })
      .eq("id", data.id);
    if (error) throw error;

    await writeAudit(
      data.is_active ? "admin_user_enabled" : "admin_user_disabled",
      "profiles",
      data.id,
    );
    return { ok: true };
  });

export const resetAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), password: z.string().min(12).max(128) }))
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    assertSuperAdmin(admin.roles);

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.password,
      user_metadata: { must_change_password: true },
    });
    if (authError) throw authError;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", data.id);
    if (error) throw error;

    await writeAudit("admin_password_reset", "profiles", data.id);
    return { ok: true };
  });

export const saveExternalSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(3).max(160),
      kind: z.literal("google_news").default("google_news"),
      url: z.string().url().optional().or(z.literal("")),
      query: z.string().max(160).optional(),
      language: z.string().max(12).optional(),
      country: z.string().max(12).optional(),
      active: z.boolean().default(true),
    }),
  )
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    if (!hasAnyRole(admin.roles, ["super_admin", "director_editorial"])) {
      throw new Error("No tienes permisos para administrar fuentes externas.");
    }

    const sourceUrl = cleanOptionalString(data.url);
    if (!sourceUrl || !sourceUrl.startsWith("https://news.google.com/rss")) {
      throw new Error("Solo se aceptan URLs RSS de Google News.");
    }

    const config = {
      url: sourceUrl,
      query: cleanOptionalString(data.query),
      language: cleanOptionalString(data.language) ?? "es",
      country: cleanOptionalString(data.country),
      requiresReview: true,
      autoPublish: false,
    };

    const payload = {
      name: data.name.trim(),
      kind: data.kind,
      config,
      active: data.active,
      updated_by: admin.userId,
    };

    const mutation = data.id
      ? (supabaseAdmin as any).from("external_sources").update(payload).eq("id", data.id)
      : (supabaseAdmin as any).from("external_sources").insert(payload);
    const { error } = await mutation;
    if (error) throw error;

    await writeAudit(
      data.id ? "external_source_updated" : "external_source_created",
      "external_sources",
      data.id,
    );
    return { ok: true };
  });

export const runExternalImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ source_id: z.string().uuid().optional() }).optional())
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    if (
      !hasAnyRole(admin.roles, ["super_admin", "director_editorial", "editor_media", "editor_tech"])
    ) {
      throw new Error("No tienes permisos para importar contenido externo.");
    }

    const query = (supabaseAdmin as any)
      .from("external_sources")
      .select("*")
      .eq("active", true)
      .eq("kind", "google_news");
    if (data?.source_id) query.eq("id", data.source_id);
    const { data: sources, error } = await query;
    if (error) throw error;

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const source of sources ?? []) {
      try {
        const config = (source.config ?? {}) as Record<string, string>;
        const sourceUrl = config.url || config.rss_url;
        if (!sourceUrl || !sourceUrl.startsWith("https://news.google.com/rss")) {
          errors.push(`${source.name}: falta URL valida de Google News RSS.`);
          continue;
        }

        const response = await fetch(sourceUrl, {
          headers: { "user-agent": "ZEN NEWS Google News RSS Importer/1.0" },
        });
        if (!response.ok) throw new Error(`Google News RSS respondio ${response.status}`);

        const items = parseRssItems(await response.text());

        for (const item of items.slice(0, 25)) {
          const originalUrl = item.original_url || item.external_url;
          const normalized = item.normalized_title || normalizeTitle(item.title);
          const sourceName = item.source_name || source.name;
          const [externalUrlMatch, originalUrlMatch, titleMatch] = await Promise.all([
            (supabaseAdmin as any)
              .from("external_imports")
              .select("id")
              .eq("external_url", originalUrl)
              .limit(1),
            (supabaseAdmin as any)
              .from("external_imports")
              .select("id")
              .eq("original_url", originalUrl)
              .limit(1),
            (supabaseAdmin as any)
              .from("external_imports")
              .select("id")
              .eq("source_id", source.id)
              .eq("normalized_title", normalized)
              .limit(1),
          ]);

          if (
            (externalUrlMatch.data ?? []).length > 0 ||
            (originalUrlMatch.data ?? []).length > 0 ||
            (titleMatch.data ?? []).length > 0
          ) {
            skipped += 1;
            continue;
          }

          const hash = await sha256Hex(`${originalUrl}|${source.id}|${normalized}`);
          const { error: insertError } = await (supabaseAdmin as any)
            .from("external_imports")
            .insert({
              source_id: source.id,
              external_url: originalUrl,
              original_url: originalUrl,
              source_name: sourceName,
              title: item.title,
              normalized_title: normalized,
              description: item.description,
              image_url: item.image_url,
              published_at: item.published_at,
              status: "pending",
              dedupe_hash: hash,
              raw_payload: item.raw_payload ?? {},
            });
          if (insertError) skipped += 1;
          else imported += 1;
        }
      } catch (error: any) {
        errors.push(`${source.name}: ${error?.message ?? "error desconocido"}`);
      }
    }

    await writeAudit("external_import_run", "external_imports", undefined, {
      imported,
      skipped,
      errors,
    });

    return { ok: true, imported, skipped, errors };
  });

export const updateExternalImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      title: z.string().min(3).max(240),
      description: z.string().max(1000).nullable().optional(),
      image_url: z.string().url().nullable().optional().or(z.literal("")),
      source_name: z.string().max(180).nullable().optional(),
      original_url: z.string().url(),
    }),
  )
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    if (
      !hasAnyRole(admin.roles, [
        "super_admin",
        "director_editorial",
        "editor_media",
        "editor_tech",
        "revisor",
      ])
    ) {
      throw new Error("No tienes permisos para editar imports externos.");
    }

    const { error } = await (supabaseAdmin as any)
      .from("external_imports")
      .update({
        title: data.title.trim(),
        normalized_title: normalizeTitle(data.title),
        description: cleanOptionalString(data.description),
        image_url: cleanOptionalString(data.image_url),
        source_name: cleanOptionalString(data.source_name),
        original_url: data.original_url,
        external_url: data.original_url,
        reviewed_by: admin.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw error;

    await writeAudit("external_import_updated", "external_imports", data.id);
    return { ok: true };
  });

export const promoteExternalImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      vertical_id: z.string().uuid(),
      section_id: z.string().uuid().nullable().optional(),
      author_id: z.string().uuid().nullable().optional(),
      title: z.string().min(3).max(240),
      summary: z.string().max(10000).nullable().optional(),
      image_url: z.string().url().nullable().optional().or(z.literal("")),
      content_html: z.string().max(30000).nullable().optional(),
      source_name: z.string().max(180).nullable().optional(),
      original_url: z.string().url(),
      status: z.enum(["draft", "review", "published"]).default("draft"),
    }),
  )
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    const { data: vertical } = await supabaseAdmin
      .from("verticals")
      .select("id,slug")
      .eq("id", data.vertical_id)
      .single();

    if (!vertical || !canEditVertical(admin.roles, vertical.slug as VerticalSlug)) {
      throw new Error("No tienes permisos para convertir contenido en esta vertical.");
    }
    if (data.status === "published" && !canPublish(admin.roles)) {
      throw new Error("Tu rol no puede publicar directamente.");
    }

    const { data: external } = await (supabaseAdmin as any)
      .from("external_imports")
      .select("*, external_sources(name)")
      .eq("id", data.id)
      .single();
    if (!external) throw new Error("Import externo no encontrado.");

    const sourceName =
      cleanOptionalString(data.source_name) ??
      external.source_name ??
      external.external_sources?.name ??
      "Fuente externa";
    const originalUrl = data.original_url || external.original_url || external.external_url;
    const editorialContent = cleanOptionalString(data.content_html);
    const content = sanitizeHtml(
      `${editorialContent ? `${editorialContent}<hr />` : ""}<p><strong>Atribucion:</strong> Esta noticia fue preparada por ZEN NEWS usando como insumo editorial una publicacion externa de ${sourceName}. <a href="${originalUrl}" rel="noopener noreferrer" target="_blank">Ver fuente original</a>.</p>`,
    );

    const { data: article, error } = await supabaseAdmin
      .from("articles")
      .insert({
        vertical_id: data.vertical_id,
        section_id: data.section_id ?? null,
        author_id: data.author_id ?? null,
        title: data.title.trim(),
        slug: slugify(`${data.title}-${data.id.slice(0, 8)}`),
        subtitle: limitText(data.summary, 700),
        summary: limitText(data.summary, 1000),
        content: { type: "html" },
        content_html: content,
        cover_image_url: cleanOptionalString(data.image_url),
        cover_image_alt: data.title,
        status: data.status,
        source_type: "external",
        external_url: originalUrl,
        external_source_name: sourceName,
        published_at: data.status === "published" ? new Date().toISOString() : null,
        seo_title: data.title,
        seo_description: limitText(data.summary, 320),
        reading_time: estimateReadingTime(content || data.summary || data.title),
        created_by: admin.userId,
        updated_by: admin.userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await (supabaseAdmin as any)
      .from("external_imports")
      .update({
        status: "converted",
        promoted_article_id: article.id,
        title: data.title.trim(),
        description: limitText(data.summary, 1000),
        image_url: cleanOptionalString(data.image_url),
        source_name: sourceName,
        original_url: originalUrl,
        external_url: originalUrl,
        reviewed_by: admin.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    await writeAudit("external_import_converted", "articles", article.id, { importId: data.id });
    return { ok: true, articleId: article.id };
  });

export const publishExternalImportLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      vertical_id: z.string().uuid(),
      section_id: z.string().uuid().nullable().optional(),
      author_id: z.string().uuid().nullable().optional(),
      title: z.string().min(3).max(240),
      summary: z.string().max(10000).nullable().optional(),
      image_url: z.string().url().nullable().optional().or(z.literal("")),
      source_name: z.string().max(180).nullable().optional(),
      original_url: z.string().url(),
    }),
  )
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    if (!canPublish(admin.roles)) {
      throw new Error("Tu rol no puede publicar enlaces externos.");
    }

    const { data: vertical } = await supabaseAdmin
      .from("verticals")
      .select("id,slug")
      .eq("id", data.vertical_id)
      .single();
    if (!vertical || !canEditVertical(admin.roles, vertical.slug as VerticalSlug)) {
      throw new Error("No tienes permisos para publicar en esta vertical.");
    }

    const { data: external } = await (supabaseAdmin as any)
      .from("external_imports")
      .select("*, external_sources(name)")
      .eq("id", data.id)
      .eq("status", "pending")
      .single();
    if (!external) throw new Error("Import externo no encontrado.");

    const sourceName =
      cleanOptionalString(data.source_name) ??
      external.source_name ??
      external.external_sources?.name ??
      "Fuente externa";
    const originalUrl = data.original_url || external.original_url || external.external_url;
    const content = sanitizeHtml(
      `<p>${cleanOptionalString(data.summary) ?? "Enlace externo seleccionado por el equipo editorial de ZEN NEWS."}</p><p><strong>Fuente original:</strong> <a href="${originalUrl}" rel="noopener noreferrer" target="_blank">${sourceName}</a>.</p>`,
    );

    const { data: article, error } = await supabaseAdmin
      .from("articles")
      .insert({
        vertical_id: data.vertical_id,
        section_id: data.section_id ?? null,
        author_id: data.author_id ?? null,
        title: data.title.trim(),
        slug: slugify(`${data.title}-${data.id.slice(0, 8)}`),
        subtitle: limitText(data.summary, 700),
        summary: limitText(data.summary, 1000),
        content: { type: "external_link" },
        content_html: content,
        cover_image_url: cleanOptionalString(data.image_url),
        cover_image_alt: data.title,
        status: "published",
        source_type: "external",
        external_url: originalUrl,
        external_source_name: sourceName,
        published_at: new Date().toISOString(),
        seo_title: data.title,
        seo_description: limitText(data.summary, 320),
        reading_time: 1,
        created_by: admin.userId,
        updated_by: admin.userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await (supabaseAdmin as any)
      .from("external_imports")
      .update({
        status: "external_published",
        promoted_article_id: article.id,
        title: data.title.trim(),
        description: limitText(data.summary, 1000),
        image_url: cleanOptionalString(data.image_url),
        source_name: sourceName,
        original_url: originalUrl,
        external_url: originalUrl,
        reviewed_by: admin.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    await writeAudit("external_import_link_published", "articles", article.id, {
      importId: data.id,
    });
    return { ok: true, articleId: article.id };
  });

export const discardExternalImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }: any) => {
    const admin = await getAdminContext(context.userId);
    if (
      !hasAnyRole(admin.roles, [
        "super_admin",
        "director_editorial",
        "editor_media",
        "editor_tech",
        "revisor",
      ])
    ) {
      throw new Error("No tienes permisos para descartar imports.");
    }

    const { error } = await (supabaseAdmin as any)
      .from("external_imports")
      .update({
        status: "rejected",
        reviewed_by: admin.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw error;

    await writeAudit("external_import_rejected", "external_imports", data.id);
    return { ok: true };
  });

export const completeFirstPasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: any) => {
    await getAdminContext(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", context.userId);
    if (error) throw error;
    await writeAudit("password_changed", "profiles", context.userId);
    return { ok: true };
  });
