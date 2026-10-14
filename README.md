# COBS Buildmasters AI Marketing Agent

Secure, approval-first marketing operations for **COBS Buildmasters Ltd** in Adenta New Legon, Ghana.

## What is live

- Next.js / TypeScript dashboard with COBS navy, grey and gold styling
- Supabase email/password authentication and owner-only workspace access
- PostgreSQL persistence for drafts, campaigns and leads, protected by row-level security
- Private `cobs-media` storage for JPEG, PNG, WebP, MP4 and QuickTime uploads up to 50 MB
- OpenAI Responses API integration that extracts real generated text and reports API errors honestly
- Clearly labelled manual starter captions when AI generation is unavailable
- **No automatic social-media publishing** — marked posts are only ready for manual publishing

## Required environment variables

Configure these in Vercel for **Production**:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser-safe Supabase anonymous key |
| `OPENAI_API_KEY` | Optional | Server-only OpenAI key for AI generation |
| `OPENAI_MODEL` | Optional | Defaults to `gpt-4.1-mini` |

Never expose `OPENAI_API_KEY` in browser code or commit it to GitHub. OpenAI generation requires available API credit; use the explicitly labelled sample-caption action when it is unavailable.

## Supabase setup

1. Create a free Supabase project.
2. In Auth URL Configuration, set Site URL and the redirect allowlist to `https://cobs-buildmasters-marketing-agent.vercel.app`.
3. Apply [the migration](supabase/migrations/202610140002_secure_workspace.sql) through the Supabase SQL Editor or CLI.
4. Create/sign in with `cobshomes@gmail.com`; this account receives the owner role.
5. Confirm the newest email confirmation link. Use **Resend confirmation email** if a link expires.

The migration creates protected profiles, posts, campaigns, leads and media-asset records; enables RLS; and creates the private media bucket.

## Local development

```bash
npm install
npm run dev
```

Put required variables in `.env.local`. Do not use production keys in tests.

## Services and cost boundary

- Vercel Hobby and Supabase Free are suitable for early development.
- The dashboard works without OpenAI credit except for live AI generation.
- Meta/Facebook/Instagram publishing is intentionally not configured.
- Do not activate paid services without explicit approval.

## Verification status

The production sign-in screen loads successfully. The secure Supabase workspace and private media migration succeeded. Live OpenAI generation was not invoked because the connected OpenAI account has no available credit.
