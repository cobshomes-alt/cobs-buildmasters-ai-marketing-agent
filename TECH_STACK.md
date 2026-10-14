# Technology Stack

| Area | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 15, React 19, TypeScript | Responsive private marketing workspace |
| Styling | CSS with COBS navy, grey and gold tokens | Brand-consistent mobile and desktop UI |
| Database | Supabase PostgreSQL | Campaigns, posts, versions, approvals, leads and analytics |
| Authentication | Supabase Auth | Owner, marketer and viewer access |
| Security | Supabase Row-Level Security | Organization-scoped data and owner-only publishing controls |
| Media | Supabase Storage | Brand assets and company media |
| AI | OpenAI API (server-side) | Captions, scripts, calendar ideas and campaign plans |
| Publishing | Official Meta Graph APIs | Eligible Facebook and Instagram publishing and insights |
| Hosting | Vercel | Next.js hosting and server functions |
| Source control | GitHub | Public code repository |

## Safety controls

- Every post has a version and an approval state.
- Any content edit clears approval and moves it back to Draft.
- Only an Approved current version can be queued.
- The server checks approval again immediately before publishing.
- Browser code never receives OpenAI, Meta or Supabase service-role secrets.

## Data tables

`organizations`, `profiles`, `brand_records`, `media_assets`, `campaigns`, `posts`, `post_versions`, `approvals`, `social_accounts`, `publish_jobs`, `analytics_snapshots`, `leads`, and `audit_logs`.
