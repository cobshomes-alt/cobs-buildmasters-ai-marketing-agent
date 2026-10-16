export const CHANNELS = ["Instagram", "Facebook", "TikTok", "YouTube"] as const;
export type Channel = (typeof CHANNELS)[number];
export type MarketingPost = {
  id: string;
  title: string;
  body: string;
  status: string;
  updated_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
  campaign_id?: string | null;
  media_id?: string | null;
};
export type PublishingJob = {
  id: string;
  postId: string;
  sourceRevision: string;
  platform: Channel;
  caption: string;
  mode: "now" | "schedule";
  scheduleAt: string | null;
  state:
    | "awaiting_approval"
    | "awaiting_review"
    | "blocked_provider"
    | "cancelled"
    | "owner_reported";
  ownerReviewedAt: string | null;
  reason: string;
  attempts: number;
  revision: number;
  publishedUrl: string | null;
  history: { at: string; state: string; reason: string }[];
};
export type MarketingTask = {
  id: string;
  campaignId: string | null;
  objective: string;
  template: string;
  revision: number;
  steps: {
    label: string;
    component: string;
    state: "planned" | "owner_reported";
    evidence: string;
  }[];
  history: { at: string; message: string }[];
};
export const PLAN_TEMPLATES = {
  local: [
    "Verify service area and contact details",
    "Prepare accurate Google Business Profile copy",
    "Select real project evidence",
    "Owner review before any external update",
    "Record official platform results when connected",
  ],
  progress: [
    "Select dated original progress footage",
    "List verified construction milestones",
    "Prepare before/after comparison from actual evidence",
    "Review claims and site safety",
    "Owner approval before sharing",
  ],
  education: [
    "Choose a building question",
    "Record a verified practical demonstration",
    "Prepare a concise explanation and caption",
    "Review technical accuracy and safety",
    "Owner approval before sharing",
  ],
  followup: [
    "Select an existing consented lead",
    "Review enquiry and owner-approved contact method",
    "Draft a helpful follow-up without invented prices",
    "Owner authorization before sending",
    "Record actual response manually or through a verified integration",
  ],
  production: [
    "Creative Director brief",
    "Select licensed originals",
    "Review editable timeline",
    "Render and inspect actual MP4",
    "Owner approval",
    "Prepare platform captions",
    "Publish only through a separately authorized connector",
  ],
} as const;
export function approvalCurrent(
  post: MarketingPost | undefined,
  owner: string,
  revision?: string,
) {
  return (
    !!post &&
    ["Approved", "Scheduled"].includes(post.status) &&
    post.approved_by === owner &&
    !!post.approved_at &&
    (!revision || post.updated_at === revision)
  );
}
export function analyticsContract() {
  return {
    source: "unconfigured",
    impressions: null,
    reach: null,
    engagements: null,
    adSpend: null,
    conversions: null,
    providerCost: null,
    lastSyncedAt: null,
  };
}
