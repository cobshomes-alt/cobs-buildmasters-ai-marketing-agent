# COBS Buildmasters AI Marketing Agent

The existing private marketing workspace for **COBS Buildmasters Ltd**, developed on `develop/dashboard-media`.

## Implemented in code

- Responsive navy, gold, white and charcoal dashboard with overview, campaigns, content, creative studio, media, approvals, publishing readiness, leads and settings.
- Supabase authentication and owner-only database policies.
- Database-backed drafts, campaigns and leads; draft editing rejects stale saves using optimistic concurrency.
- Private original media uploads, preview links, project/product/campaign labels, search, removal and post attachment selection.
- Owner approval/rejection, approval actor/time, database-enforced transitions and approval reset when content or attachments change.
- Authenticated server-side AI generation, clear configuration/provider errors and clearly labelled sample captions.
- **Publishing remains manual.** No Meta publishing requests are made by this application.

These features have local automated coverage. They do not establish that your hosted Supabase or OpenAI configuration works. See [the development report](DEVELOPMENT_REPORT.md).

## Local setup

Use Node.js 22.12 or newer (Node 22 LTS was used for verification).

```powershell
npm ci
Copy-Item .env.example .env.local
# Fill in your existing Supabase project values locally.
npm run dev
```

This session also prepared an ignored portable Node runtime. If Node is still absent from your terminal PATH:

```powershell
$env:Path = "$PWD\.tools\node-v22.23.3-win-x64;$env:Path"
npm run dev
```

`.tools` is local tooling, outside Git. Git is installed at `C:\Program Files\Git\cmd\git.exe` if the terminal cannot resolve `git`.

## Required configuration

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your existing Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous key; access is restricted by authentication and RLS |
| `OPENAI_API_KEY` | Optional server-only key for your existing OpenAI account |
| `OPENAI_MODEL` | Optional, defaults to the existing `gpt-4.1-mini` model |

Keep credentials in ignored `.env.local`. Never place the OpenAI key in a `NEXT_PUBLIC_` variable. No service-role key is needed. Live AI uses your existing account quota; setup and tests do not activate a subscription or paid service.

In your **existing** Supabase project:

1. Apply `supabase/migrations/202610140002_secure_workspace.sql` if not already applied.
2. Review and apply `supabase/migrations/202610140003_dashboard_media.sql` once. This session did not apply migrations to a hosted project.
3. Enable email confirmation. Configure Auth Site URL and redirect allowlist for your development origin (`http://localhost:3000`) and any separately approved deployment origin.
4. Confirm and sign in with `cobshomes@gmail.com`. Other registered users are members and cannot access the owner workspace. The new migration backfills profiles for users that predate the signup trigger.
5. Verify the `cobs-media` bucket is private and its 50 MiB limit is permitted by the project-wide storage setting.

**Migration effect:** old Approved/Scheduled records without an approval audit record return to Draft for fresh owner review. Drafts, campaigns, leads and original media are retained.

## Media workflow

Upload an original in Media Library and optionally assign a project, product and campaign. Existing assets can receive the labels currently entered above the grid using **Apply labels above**. Select an attachment and campaign in Content Calendar. The attachment is previewed on content and in Approvals.

To replace media, upload a new original and edit the post attachment. The database invalidates approval. Attached assets cannot be deleted or overwritten. Removal reserves an unused asset first so another device cannot attach it during deletion. If removal fails, refresh and retry Remove. Storage and metadata are separate services; an interrupted operation can require reconciliation, and failures are reported.

Preview URLs expire after one hour; Refresh renews them. Supported originals are JPEG, PNG, WebP, MP4 and modern MOV, up to 50 MiB each. Video playback depends on the browser and codec; Open original provides access when inline playback is unsupported. Uploads require the page to remain open and are not resumable. Each post supports one attachment.

## Verification

```powershell
npm test
npm run test:e2e
npm run build
npm run typecheck
npm run format:check
npm audit
```

The browser test starts and stops a dedicated local Next dev server on port 3100. Close other servers on that port first. It uses installed Google Chrome, fake Supabase values and mocked requests, with no OpenAI key. Screenshots are written to `.tools/screenshots/`.

PGlite tests execute migrations and PostgreSQL approval/RLS rules with test Auth/Storage schemas. They do not run the real Supabase Auth or Storage services. Dashboard/API tests mock external connections. Live email delivery, uploads, cross-device hosted persistence and AI responses require verification against your configured project.
