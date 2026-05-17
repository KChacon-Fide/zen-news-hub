# ZEN NEWS Architecture

## General Architecture

ZEN NEWS is the parent editorial platform. ZEN MEDIA and ZEN TECH are sibling editorial verticals that share authentication, database, storage, admin tooling, audit, security, and deployment, while keeping their own identity, sections, menus, SEO settings, colors, content, and editorial controls.

The current codebase is a TanStack Start application deployed to Cloudflare Workers. The architecture mirrors the requested Next.js App Router separation using server-rendered routes, server functions, strongly typed React, Tailwind CSS, shadcn/ui components, and Supabase as the backend of record.

Core layers:

- Public web: ZEN NEWS home, vertical home pages, article details, sections, videos, live, authors, search, sponsored content, contact, and institutional pages.
- Admin CMS: `/admin`, protected by Supabase Auth and role checks in server functions and PostgreSQL RLS.
- Editorial services: article workflows, live streams, media metadata, external import staging, audit logs, settings, ads, menus, and page blocks.
- Data platform: Supabase PostgreSQL, Supabase Auth, Supabase Storage, RLS policies, RPC helpers, indexes, and migrations.
- Edge deployment: Cloudflare Workers using `@cloudflare/vite-plugin` and `wrangler`.

## Data Model

Primary tables:

- `profiles`: authenticated admin profile and first-login password-change state.
- `user_roles`, `admin_roles`, `admin_permissions`, `role_permissions`: RBAC assignments and permission catalog.
- `verticals`: ZEN NEWS, ZEN MEDIA, ZEN TECH identities.
- `sections`: vertical-owned editorial sections.
- `articles`: original, external, sponsored, draft, review, scheduled, published, and archived content.
- `article_versions`, `article_tags`, `tags`: versioning and taxonomy.
- `authors`: public author profiles.
- `media_assets`: Supabase Storage metadata with alt text.
- `live_streams`: live broadcast schedule and active embed state.
- `external_sources`, `external_imports`, `api_integrations`: import connectors and staging queue.
- `site_settings`, `navigation_menus`, `menu_items`, `page_blocks`, `ads`: editable public presentation.
- `audit_logs`, `security_events`, `active_sessions`, `editorial_locks`, `newsletters`: operational controls.

Articles always belong to one vertical. Public users only read published content. Admin users get access through role, vertical ownership, and RLS.

## Roles And Permissions

Roles:

- `super_admin`
- `director_editorial`
- `editor_media`
- `editor_tech`
- `redactor`
- `revisor`
- `multimedia`
- `analista`
- `readonly`

Permission strategy:

- Super Admin can manage the whole system.
- Director Editorial can manage editorial content across verticals.
- ZEN MEDIA and ZEN TECH editors are limited to their own verticals unless explicitly promoted.
- Redactors create drafts and send to review.
- Reviewers approve editorial workflow but do not manage global settings.
- Multimedia manages live and assets.
- Analysts and read-only users can inspect dashboards and logs according to policy.

Every sensitive write path validates permission in both the application server function and PostgreSQL RLS.

## RLS Strategy

Public reads:

- Active verticals and sections.
- Published, non-deleted articles whose `published_at` is not in the future.
- Active or scheduled live-stream metadata.
- Active ads and public media metadata.

Authenticated admin reads:

- Own profile and roles.
- Editorial data according to role.
- Audit/security according to elevated roles.

Writes:

- Role management, API integrations, and global settings require Super Admin.
- Article create/update requires vertical edit access.
- Publish/delete requires elevated editorial permissions.
- Live stream management requires editorial or multimedia permissions.
- Storage policies require authenticated uploads and ownership/elevated deletion.

## Folder Structure

- `src/routes`: public and admin route modules.
- `src/components`: shared editorial UI and shadcn/ui components.
- `src/lib`: server functions, constants, security utilities, formatting, and validation helpers.
- `src/integrations/supabase`: browser/server Supabase clients and auth middleware.
- `supabase/migrations`: schema, RLS, indexes, RPC functions, and platform seed data.
- `docs`: architecture and setup documentation.

## Editorial Flow

Article states:

1. `draft`
2. `review`
3. `scheduled`
4. `published`
5. `archived`

Admin workflow:

- Create content with vertical, section, author, SEO, media, flags, tags, and sanitized rich HTML.
- Save as draft, send to review, schedule, publish, archive, or duplicate.
- Preserve `article_versions` snapshots before material edits.
- Use `editorial_locks` for collision prevention when multiple admins edit simultaneously.
- Public routes never expose drafts, review content, deleted content, or future scheduled content.

## Authentication Flow

- Supabase Auth handles login, recovery, refresh token, persistent session, and password updates.
- `/admin` renders a private shell and retrieves secure data through authenticated server functions.
- First admin is created by the seed script with `must_change_password = true`.
- First login forces password change before operating the CMS.
- Server functions require Bearer tokens and verify claims before using privileged Supabase operations.

## Live Flow

Admin can create, schedule, activate, pause, and finish live streams. Public users see the EN VIVO button only when there is an active stream.

Embed rules:

- YouTube normal, shorts, live, and embed URLs are normalized to a safe embed URL.
- Facebook video/live URLs use the Facebook plugin endpoint with encoded href.
- Instagram gets a professional fallback when embedding is restricted.
- Iframes use an allowlist and no arbitrary scripts are accepted.

## Public Design

ZEN NEWS is the sober parent portal with combined headlines, live state, latest news, featured vertical blocks, videos, reports, sponsored placements, newsletter, and institutional footer.

ZEN MEDIA uses a warmer editorial identity for national/international news, culture, sport, opinion, and reporting.

ZEN TECH uses a sharper analytical identity for AI, security, science, startups, innovation, platforms, gaming, and connectivity.

## Dashboard Design

The admin panel is structured as an enterprise CMS:

- KPI ribbon for published, drafts, scheduled, active live, pending imports, users, and security alerts.
- Dense operational tables for articles, verticals, sections, live streams, media, external imports, audit, and settings.
- Forms are grouped by business workflow instead of decorative marketing panels.
- All destructive actions are explicit and soft-delete/archive content where possible.

## Security Strategy

- Never expose server secret keys in browser code.
- Use server-side validation with Zod.
- Sanitize rich HTML before saving.
- Restrict iframe domains and MIME types.
- Add security headers, frame protections, referrer policy, permissions policy, and baseline CSP.
- Use same-origin CSRF protection for server functions.
- Use RLS and service-role only inside server functions after app-level role checks.
- Keep logs free of secrets.
- Store API keys only in environment variables or encrypted integration config.

## External Integrations

Current connector:

- Google News RSS only.

Imported content lands in `external_imports` as `pending`. Admin review is required before publication. The system supports viewing, editing, converting into an internal draft/published article, publishing as an attributed external link, or rejecting the item.

## Future AI Architecture

The model leaves room for:

- headline suggestions
- summaries
- tag suggestions
- duplicate detection
- section classification
- sentiment analysis
- semantic search with embeddings
- internal editorial assistant
- moderation
- video transcription

AI work should live behind server-only service modules and never run from public client code with exposed provider keys.
