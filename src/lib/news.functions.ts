import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const [verticals, breaking, featured, latest, live] = await Promise.all([
    supabaseAdmin.from("verticals").select("*").eq("active", true).order("sort_order"),
    supabaseAdmin
      .from("articles")
      .select("id,title,slug,subtitle,summary,cover_image_url,published_at,vertical_id,section_id,reading_time,is_breaking")
      .eq("status", "published")
      .eq("is_breaking", true)
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("articles")
      .select("id,title,slug,subtitle,summary,cover_image_url,published_at,vertical_id,section_id,reading_time")
      .eq("status", "published")
      .eq("is_featured", true)
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(6),
    supabaseAdmin
      .from("articles")
      .select("id,title,slug,subtitle,cover_image_url,published_at,vertical_id,section_id,reading_time")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(12),
    supabaseAdmin
      .from("live_streams")
      .select("id,title,description,platform,embed_url,stream_url,status")
      .eq("status", "active")
      .limit(1),
  ]);
  return {
    verticals: verticals.data ?? [],
    breaking: breaking.data?.[0] ?? null,
    featured: featured.data ?? [],
    latest: latest.data ?? [],
    live: live.data?.[0] ?? null,
  };
});

export const getVerticalData = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: "media" | "tech" }) => d)
  .handler(async ({ data }) => {
    const { data: vertical } = await supabaseAdmin.from("verticals").select("*").eq("slug", data.slug).single();
    if (!vertical) return { vertical: null, articles: [], sections: [] };
    const [articles, sections] = await Promise.all([
      supabaseAdmin
        .from("articles")
        .select("id,title,slug,subtitle,summary,cover_image_url,published_at,section_id,reading_time,is_featured,is_breaking")
        .eq("vertical_id", vertical.id)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("published_at", { ascending: false })
        .limit(24),
      supabaseAdmin
        .from("sections")
        .select("id,name,slug,sort_order")
        .eq("vertical_id", vertical.id)
        .eq("active", true)
        .order("sort_order"),
    ]);
    return { vertical, articles: articles.data ?? [], sections: sections.data ?? [] };
  });

export const getArticle = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const { data: article } = await supabaseAdmin
      .from("articles")
      .select("*, verticals(slug,name,primary_color,accent_color), sections(name,slug), authors(name,slug,bio,avatar_url)")
      .eq("slug", data.slug)
      .eq("status", "published")
      .is("deleted_at", null)
      .single();
    if (!article) return { article: null, related: [] };
    const { data: related } = await supabaseAdmin
      .from("articles")
      .select("id,title,slug,cover_image_url,published_at")
      .eq("vertical_id", article.vertical_id)
      .eq("status", "published")
      .neq("id", article.id)
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(4);
    return { article, related: related ?? [] };
  });
