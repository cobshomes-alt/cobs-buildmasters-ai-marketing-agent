# Implemented technology stack

| Area | Implementation |
| --- | --- |
| Application | Existing Next.js 15 App Router, React 19, strict TypeScript |
| Styling | Responsive CSS, navy, gold, white and charcoal; no external font service |
| Authentication | Supabase email/password; owner profile checked by APIs and database policies |
| Database | `cobs_profiles`, `cobs_posts`, `cobs_campaigns`, `cobs_leads`, `cobs_media_assets` |
| Storage | Private `cobs-media` bucket; original JPEG, PNG, WebP, MP4 and MOV files up to 50 MiB |
| AI | Server-side OpenAI Responses API; authenticated owner only; no fallback disguised as AI |
| Approval | PostgreSQL transition trigger, approval actor/time, edit invalidation, optimistic concurrency |
| Tests | Vitest, Testing Library, PGlite PostgreSQL, Playwright with local Chrome |

Drafts, campaigns, leads and media metadata are database records. Supabase Auth may use browser storage for its session token; marketing records do not use localStorage.

No Meta publishing, social account connections, analytics ingestion, post version history, team roles, multi-organisation workspace, background publisher or actual date-based scheduler is implemented. The existing Scheduled status means ready for **manual** publishing.

API clients use the public Supabase key plus the user's verified bearer token, preserving RLS. No Supabase service-role key is required. File uploads go directly to Storage after authenticated preparation; completion checks stored size, MIME type and the initial file signature before creating a library record. Signature checks are basic format validation, not a complete video decoder or malware scanner.
