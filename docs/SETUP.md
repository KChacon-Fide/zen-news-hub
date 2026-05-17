# ZEN NEWS Setup

## Environment

Create `.env.local` from `.env.example`.

Required server variables:

```bash
SUPABASE_URL="https://uzzglnpxtospzcnxlabg.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_SCakC3UWyCs1fgsT2eWbPw_uSVHjWqq"
SUPABASE_SERVICE_ROLE_KEY="server-only-secret"
```

Required browser-safe variables:

```bash
VITE_SUPABASE_URL="https://uzzglnpxtospzcnxlabg.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_SCakC3UWyCs1fgsT2eWbPw_uSVHjWqq"
VITE_SUPABASE_PROJECT_ID="uzzglnpxtospzcnxlabg"
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in `VITE_*` variables or browser code.

Google News RSS does not need secrets. The feed URLs are stored as Google News sources and can be managed from `/admin` under `Contenido externo`.

## Install

```bash
npm install
```

## Supabase Database

Apply migrations from `supabase/migrations` to the Supabase project:

```bash
npx supabase link --project-ref uzzglnpxtospzcnxlabg
npx supabase db push
```

If the Supabase CLI asks for login or database password, complete those prompts first:

```bash
npx supabase login
```

## Seed Initial Admin

Set these only in your local environment or CI secret store:

```bash
ZEN_INITIAL_ADMIN_EMAIL="admin@zennews.cr"
ZEN_INITIAL_ADMIN_PASSWORD="temporary-password"
ZEN_INITIAL_ADMIN_NAME="ZEN Root Admin"
```

Then run:

```bash
npm run seed:admin
```

The admin profile is marked with `must_change_password = true`, so the first successful login forces a password change.

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Cloudflare Workers

Public Supabase values are already listed in `wrangler.jsonc`.

Set the server-only Supabase secret in Cloudflare:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Then deploy:

```bash
npm run deploy
```

## Cloudflare Tunnel

This project is configured for Cloudflare Workers. A tunnel still requires an authenticated Cloudflare account/session and a target hostname. Once authenticated:

```bash
npx wrangler whoami
npx wrangler deploy
```

For local tunnel testing, use Cloudflare Tunnel separately:

```bash
cloudflared tunnel login
cloudflared tunnel create zen-news-hub
cloudflared tunnel route dns zen-news-hub your-domain.example
cloudflared tunnel run zen-news-hub
```

## Security Checklist

- `.env`, `.env.local`, and `.dev.vars` are ignored by git.
- RLS is enabled on sensitive tables.
- Public routes only fetch published, non-deleted content.
- Admin server functions require Supabase Auth Bearer tokens.
- Rich HTML is sanitized before saving.
- Live embeds are normalized and allowlisted.
- Security headers and CSP are applied in the Worker response.
