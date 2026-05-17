const ALLOWED_TAGS = new Set([
  "p",
  "div",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h2",
  "h3",
  "h4",
  "figure",
  "figcaption",
  "img",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "hr",
  "code",
  "pre",
  "mark",
  "span",
  "font",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);
const ALLOWED_IFRAME_HOSTS = new Set([
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "www.facebook.com",
  "web.facebook.com",
  "www.instagram.com",
]);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value: string) {
  try {
    const url = new URL(value, "https://zennews.local");
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      return value;
    }
  } catch {
    return "";
  }
  return "";
}

function sanitizeAttributes(tag: string, rawAttributes: string) {
  const attrs: string[] = [];
  const attrRegex = /([a-zA-Z0-9:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(rawAttributes)) !== null) {
    const name = match[1].toLowerCase();
    const rawValue = match[3] ?? match[4] ?? match[5] ?? "";
    const value = rawValue.trim();

    if (name.startsWith("on") || name === "srcdoc") continue;

    if (name === "style") {
      const style = sanitizeInlineStyle(value);
      if (style) attrs.push(`style="${escapeHtml(style)}"`);
      continue;
    }

    if (tag === "a" && name === "href") {
      const href = safeUrl(value);
      if (href) attrs.push(`href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank"`);
      continue;
    }

    if (tag === "img" && ["src", "alt", "title"].includes(name)) {
      if (name === "src") {
        const src = safeUrl(value);
        if (src) attrs.push(`src="${escapeHtml(src)}" loading="lazy"`);
      } else {
        attrs.push(`${name}="${escapeHtml(value)}"`);
      }
      continue;
    }

    if (tag === "font" && ["color", "face", "size"].includes(name)) {
      if (name === "color" && isSafeCssColor(value)) attrs.push(`color="${escapeHtml(value)}"`);
      if (name === "face" && /^[a-zA-Z0-9\s,'"-]{1,80}$/.test(value)) {
        attrs.push(`face="${escapeHtml(value)}"`);
      }
      if (name === "size" && /^[1-7]$/.test(value)) attrs.push(`size="${value}"`);
      continue;
    }

    if (["colspan", "rowspan"].includes(name) && /^[1-9][0-9]?$/.test(value)) {
      attrs.push(`${name}="${value}"`);
    }
  }

  return attrs.length ? ` ${attrs.join(" ")}` : "";
}

function isSafeCssColor(value: string) {
  const clean = value.trim();
  return (
    /^#[0-9a-f]{3,8}$/i.test(clean) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(
      clean,
    ) ||
    /^[a-z]{3,20}$/i.test(clean)
  );
}

function sanitizeInlineStyle(value: string) {
  const allowed: string[] = [];
  for (const declaration of value.split(";")) {
    const [rawProperty, ...rawValueParts] = declaration.split(":");
    const property = rawProperty?.trim().toLowerCase();
    const cssValue = rawValueParts.join(":").trim();
    if (!property || !cssValue) continue;

    if ((property === "color" || property === "background-color") && isSafeCssColor(cssValue)) {
      allowed.push(`${property}: ${cssValue}`);
      continue;
    }

    if (
      property === "font-size" &&
      /^(\d{1,2}(?:\.\d{1,2})?(px|rem|em|%)|small|medium|large|x-large)$/i.test(cssValue)
    ) {
      allowed.push(`${property}: ${cssValue}`);
      continue;
    }

    if (property === "font-family" && /^[a-zA-Z0-9\s,'"-]{1,120}$/.test(cssValue)) {
      allowed.push(`${property}: ${cssValue}`);
      continue;
    }

    if (
      property === "text-decoration" &&
      /^(underline|line-through|none)(\s+(underline|line-through))*$/i.test(cssValue)
    ) {
      allowed.push(`${property}: ${cssValue}`);
      continue;
    }

    if (property === "text-align" && /^(left|right|center|justify)$/i.test(cssValue)) {
      allowed.push(`${property}: ${cssValue}`);
    }
  }

  return allowed.join("; ");
}

export function sanitizeHtml(input: string) {
  if (!input) return "";

  const withoutDangerousBlocks = input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  return withoutDangerousBlocks.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tagName, attrs) => {
    const tag = String(tagName).toLowerCase();
    const closing = match.startsWith("</");

    if (!ALLOWED_TAGS.has(tag)) return "";
    if (closing) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;

    const cleanAttrs = sanitizeAttributes(tag, String(attrs || ""));
    return VOID_TAGS.has(tag) ? `<${tag}${cleanAttrs}>` : `<${tag}${cleanAttrs}>`;
  });
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function estimateReadingTime(htmlOrText: string) {
  const words = htmlOrText
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function deriveLiveEmbed(platform: string, streamUrl: string) {
  if (!streamUrl) return { embedUrl: "", embeddable: false, reason: "missing_url" };

  let url: URL;
  try {
    url = new URL(streamUrl);
  } catch {
    return { embedUrl: "", embeddable: false, reason: "invalid_url" };
  }

  const host = url.hostname.replace(/^m\./, "www.");
  const platformName = platform.toLowerCase();

  if (platformName === "youtube") {
    const videoId =
      url.searchParams.get("v") ||
      url.pathname.match(/\/(shorts|live|embed)\/([^/?#]+)/)?.[2] ||
      (host === "youtu.be" ? url.pathname.replace("/", "") : "");
    if (!videoId) return { embedUrl: "", embeddable: false, reason: "youtube_id_missing" };
    return {
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`,
      embeddable: true,
    };
  }

  if (platformName === "facebook") {
    if (!host.endsWith("facebook.com") && !host.endsWith("fb.watch")) {
      return { embedUrl: "", embeddable: false, reason: "facebook_host_not_allowed" };
    }
    return {
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(streamUrl)}&show_text=false&width=1280`,
      embeddable: true,
    };
  }

  if (platformName === "instagram") {
    if (!host.endsWith("instagram.com")) {
      return { embedUrl: "", embeddable: false, reason: "instagram_host_not_allowed" };
    }
    return {
      embedUrl: `${url.origin}${url.pathname.replace(/\/$/, "")}/embed`,
      embeddable: true,
      reason: "instagram_embed_may_require_browser_support",
    };
  }

  return { embedUrl: "", embeddable: false, reason: "platform_not_supported" };
}

export function deriveYouTubeEmbedUrl(value?: string | null) {
  if (!value) return "";

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^m\./, "www.");
    if (!host.endsWith("youtube.com") && host !== "youtu.be") return "";

    const videoId =
      url.searchParams.get("v") ||
      url.pathname.match(/\/(shorts|live|embed)\/([^/?#]+)/)?.[2] ||
      (host === "youtu.be" ? url.pathname.replace("/", "") : "");

    return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : "";
  } catch {
    return "";
  }
}

export function isLikelyVideoFileUrl(value?: string | null) {
  return !!value && /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(value);
}

export function isAllowedIframeUrl(value?: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_IFRAME_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
