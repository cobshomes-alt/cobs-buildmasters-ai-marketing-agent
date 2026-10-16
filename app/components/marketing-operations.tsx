"use client";
import { useCallback, useEffect, useState } from "react";
import type { Asset } from "./media-library";
import SocialPostPreview from "./social-post-preview";
import {
  CHANNELS,
  PLAN_TEMPLATES,
  type Channel,
  type MarketingPost,
  type PublishingJob,
  type MarketingTask,
} from "../../lib/marketing-contracts";
type Workspace = {
  posts: MarketingPost[];
  campaigns: { id: string; name: string }[];
  publishing: PublishingJob[];
  tasks: MarketingTask[];
  renderJobs: {
    id: string;
    state: string;
    error?: string | null;
    history: { at: number; state: string }[];
  }[];
  usage: { jobs: number; reservedBytes: number };
  leadRecordsLoaded: number;
  analytics: {
    source: string;
    impressions: null;
    reach: null;
    engagements: null;
    adSpend: null;
    conversions: null;
    providerCost: null;
  };
  integrations: {
    platform: string;
    connected: boolean;
    liveVerified: boolean;
    reason: string;
  }[];
  scope: string;
};
export default function MarketingOperations({
  token,
  mode,
  assets,
}: {
  token: string;
  mode: "publishing" | "operations";
  assets: Asset[];
}) {
  const [data, setData] = useState<Workspace | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [postId, setPostId] = useState(""),
    [platforms, setPlatforms] = useState<Channel[]>(["Instagram"]),
    [captions, setCaptions] = useState<Record<string, string>>({}),
    [publishMode, setPublishMode] = useState("now"),
    [date, setDate] = useState(""),
    [objective, setObjective] = useState(""),
    [template, setTemplate] =
      useState<keyof typeof PLAN_TEMPLATES>("production"),
    [campaignId, setCampaignId] = useState(""),
    [evidence, setEvidence] = useState<Record<string, string>>({}),
    [urls, setUrls] = useState<Record<string, string>>({});
  const api = useCallback(
    async (payload?: object) => {
      const r = await fetch("/api/marketing-operations", {
        method: payload ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || "Operations unavailable.");
      return result;
    },
    [token],
  );
  const load = useCallback(async () => {
    try {
      setData(await api());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operations unavailable.");
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  async function act(payload: object) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await api(payload);
      setMessage(
        result.results?.some((r: { duplicate: boolean }) => r.duplicate)
          ? "Existing idempotent preparation returned. Nothing was published."
          : "Local operation recorded. No external content was sent.",
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  }
  const post = data?.posts.find((p) => p.id === postId);
  return (
    <section
      className="automatic-director glass-panel"
      aria-label={
        mode === "publishing"
          ? "Publishing Centre foundation"
          : "Marketing operations dashboard"
      }
    >
      <span className="eyebrow">
        COBS /{" "}
        {mode === "publishing" ? "PUBLISHING CENTRE" : "MARKETING OPERATIONS"}
      </span>
      <h2>
        {mode === "publishing"
          ? "Prepare with confidence."
          : "Coordinate the next move."}
      </h2>
      <p>
        Owner-scoped local preparation and activity history. No social account
        connection, live publishing, automated message or advertising spend is
        enabled.
      </p>
      <button disabled={busy} onClick={() => void load()}>
        Refresh operations
      </button>
      {message && <p role="status">{message}</p>}
      {!data ? (
        <p>
          Workspace details unavailable until the authenticated read completes.
        </p>
      ) : (
        <>
          <details>
            <summary>Integration status</summary>
            {data.integrations.map((i) => (
              <p key={i.platform}>
                <strong>{i.platform}</strong>: {i.reason} Live verified:{" "}
                {i.liveVerified ? "yes" : "no"}.
              </p>
            ))}
          </details>
          {mode === "publishing" ? (
            <>
              <fieldset disabled={busy}>
                <legend>Final content review</legend>
                <label>
                  Existing content
                  <select
                    value={postId}
                    onChange={(e) => {
                      setPostId(e.target.value);
                      const p = data.posts.find((p) => p.id === e.target.value);
                      setCaptions(
                        Object.fromEntries(
                          CHANNELS.map((c) => [c, p?.body || ""]),
                        ),
                      );
                    }}
                  >
                    <option value="">Choose a post</option>
                    {data.posts.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.title} · {p.status}
                      </option>
                    ))}
                  </select>
                </label>
                {post && (
                  <>
                    <h3>{post.title}</h3>
                    <p>
                      Source status: {post.status}. Approval and source revision
                      are checked again on the server for every review/report
                      action.
                    </p>
                    <SocialPostPreview
                      title={post.title}
                      body={post.body}
                      asset={assets.find((a) => a.id === post.media_id)}
                    />
                  </>
                )}
                <div className="director-options">
                  {CHANNELS.map((p) => (
                    <label className="check-label" key={p}>
                      <input
                        type="checkbox"
                        checked={platforms.includes(p)}
                        onChange={(e) =>
                          setPlatforms(
                            e.target.checked
                              ? [...platforms, p]
                              : platforms.filter((c) => c !== p),
                          )
                        }
                      />
                      {p}
                    </label>
                  ))}
                </div>
                {platforms.map((p) => (
                  <div key={p}>
                    <label>
                      {p} caption
                      <textarea
                        maxLength={2200}
                        value={captions[p] || ""}
                        onChange={(e) =>
                          setCaptions({ ...captions, [p]: e.target.value })
                        }
                      />
                    </label>
                    {post && (
                      <SocialPostPreview
                        title={post.title}
                        body={captions[p] || ""}
                        asset={assets.find((a) => a.id === post.media_id)}
                        initialPlatform={
                          p === "Instagram"
                            ? "Instagram Feed"
                            : p === "Facebook"
                              ? "Facebook Feed"
                              : p === "YouTube"
                                ? "YouTube Shorts"
                                : "TikTok"
                        }
                      />
                    )}
                  </div>
                ))}
                <label>
                  Publishing intent
                  <select
                    value={publishMode}
                    onChange={(e) => setPublishMode(e.target.value)}
                  >
                    <option value="now">Publish Now preparation</option>
                    <option value="schedule">Schedule preparation</option>
                  </select>
                </label>
                {publishMode === "schedule" && (
                  <label>
                    Planned local time
                    <input
                      type="datetime-local"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                )}
                <p className="muted">
                  This records local jobs only. A source approval and separate
                  review of each platform caption are required. A schedule will
                  not execute while the official connector/worker is
                  unavailable.
                </p>
                <button
                  className="gold-button"
                  disabled={
                    !post ||
                    !platforms.length ||
                    platforms.some((p) => !captions[p]?.trim()) ||
                    (publishMode === "schedule" && !date)
                  }
                  onClick={() =>
                    void act({
                      action: "prepare",
                      postId,
                      platforms,
                      captions,
                      mode: publishMode,
                      scheduleAt:
                        publishMode === "schedule"
                          ? new Date(date).toISOString()
                          : null,
                    })
                  }
                >
                  Prepare selected platforms
                </button>
              </fieldset>
              <h3>Publication preparation history</h3>
              {!data.publishing.length && <p>No local publishing jobs.</p>}
              {data.publishing.map((j) => (
                <article className="director-media" key={j.id}>
                  <h4>
                    {j.platform} · {j.state.replaceAll("_", " ")}
                  </h4>
                  <p>{j.caption}</p>
                  <p>{j.reason}</p>
                  <p>
                    {j.mode === "schedule"
                      ? `Planned: ${j.scheduleAt}`
                      : "Publish Now preparation"}{" "}
                    · Readiness checks {j.attempts}/3
                  </p>
                  <small>
                    Job {j.id} · Source {j.postId} · Revision {j.revision}
                  </small>
                  {j.publishedUrl && (
                    <p>
                      <a
                        href={j.publishedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Owner-reported published post ↗
                      </a>{" "}
                      · unverified by provider
                    </p>
                  )}
                  {!["cancelled", "owner_reported"].includes(j.state) && (
                    <fieldset disabled={busy}>
                      {j.state === "awaiting_review" && (
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                "Approve this exact platform caption for local preparation? This does not authorize or perform external publication.",
                              )
                            )
                              void act({
                                action: "review",
                                id: j.id,
                                revision: j.revision,
                              });
                          }}
                        >
                          Approve platform copy
                        </button>
                      )}
                      <button
                        disabled={j.attempts >= 3}
                        onClick={() =>
                          void act({
                            action: "retry",
                            id: j.id,
                            revision: j.revision,
                          })
                        }
                      >
                        Recheck readiness
                      </button>
                      <button
                        onClick={() =>
                          void act({
                            action: "cancel",
                            id: j.id,
                            revision: j.revision,
                          })
                        }
                      >
                        Cancel preparation
                      </button>
                      {j.ownerReviewedAt && (
                        <>
                          <label>
                            Already-published {j.platform} post URL
                            <input
                              type="url"
                              value={urls[j.id] || ""}
                              onChange={(e) =>
                                setUrls({ ...urls, [j.id]: e.target.value })
                              }
                            />
                          </label>
                          <button
                            disabled={!urls[j.id]}
                            onClick={() =>
                              void act({
                                action: "report",
                                id: j.id,
                                revision: j.revision,
                                url: urls[j.id],
                              })
                            }
                          >
                            Record owner-reported link
                          </button>
                        </>
                      )}
                    </fieldset>
                  )}
                  <details>
                    <summary>Job activity ({j.history.length})</summary>
                    <ol>
                      {j.history.map((h, i) => (
                        <li key={i}>
                          {h.at} · {h.state}: {h.reason}
                        </li>
                      ))}
                    </ol>
                  </details>
                </article>
              ))}
            </>
          ) : (
            <>
              <div className="director-options">
                <article>
                  <h3>Production records loaded</h3>
                  <p>
                    {data.posts.length} content posts ·{" "}
                    {data.posts.filter((p) => p.status === "Draft").length}{" "}
                    Draft ·{" "}
                    {
                      data.posts.filter((p) => p.status === "Pending approval")
                        .length
                    }{" "}
                    awaiting review
                  </p>
                  <p>
                    {data.leadRecordsLoaded} lead IDs loaded. No customer
                    message sent.
                  </p>
                </article>
                <article>
                  <h3>Local resource usage · 30 days</h3>
                  <p>
                    {data.usage.jobs} reserved render jobs ·{" "}
                    {(data.usage.reservedBytes / 1048576).toFixed(2)} MiB
                    reserved originals
                  </p>
                  <p>
                    Provider spend: Unavailable. Local electricity/CPU costs are
                    not measured.
                  </p>
                </article>
              </div>
              <h3>Campaign performance structure</h3>
              <p>
                These are loaded workflow counts, not external reach or campaign
                performance claims.
              </p>
              {data.campaigns.map((c) => (
                <p key={c.id}>
                  {c.name}:{" "}
                  {data.posts.filter((p) => p.campaign_id === c.id).length}{" "}
                  loaded posts ·{" "}
                  {
                    data.posts.filter(
                      (p) => p.campaign_id === c.id && p.status === "Approved",
                    ).length
                  }{" "}
                  Approved
                </p>
              ))}
              <p>
                Impressions: Unavailable · Reach: Unavailable · Engagement:
                Unavailable · Ad spend: Unavailable · Conversions: Unavailable
              </p>
              <h3>Rule-based next actions</h3>
              <ul>
                <li>
                  {data.posts.some((p) => p.status === "Draft")
                    ? "Review existing drafts before planning additional output."
                    : "Prepare a verified objective and select actual originals."}
                </li>
                <li>
                  {data.posts.some((p) => p.status === "Pending approval")
                    ? "Owner review is waiting in Approvals."
                    : "Keep approval separate from editing and export."}
                </li>
                <li>
                  External metrics and publishing remain unavailable until
                  official integration is configured and live-verified.
                </li>
              </ul>
              <fieldset disabled={busy}>
                <legend>Central marketing task planner</legend>
                <label>
                  Marketing objective
                  <textarea
                    maxLength={1000}
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                  />
                </label>
                <label>
                  Workflow template
                  <select
                    value={template}
                    onChange={(e) =>
                      setTemplate(e.target.value as keyof typeof PLAN_TEMPLATES)
                    }
                  >
                    <option value="production">Content production</option>
                    <option value="local">Local marketing campaign</option>
                    <option value="progress">
                      Construction progress storytelling
                    </option>
                    <option value="education">Educational marketing</option>
                    <option value="followup">Lead follow-up planning</option>
                  </select>
                </label>
                <label>
                  Existing campaign
                  <select
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {data.campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="gold-button"
                  disabled={!objective.trim()}
                  onClick={() =>
                    void act({
                      action: "task",
                      objective,
                      template,
                      campaignId: campaignId || null,
                    })
                  }
                >
                  Create local workflow
                </button>
              </fieldset>
              {data.tasks.map((t) => (
                <article className="director-media" key={t.id}>
                  <h3>{t.objective}</h3>
                  <p>
                    Local task {t.id} · {t.template}. Owner-reported evidence is
                    not verified output; the workflow is not automatically
                    marked complete.
                  </p>
                  <ol>
                    {t.steps.map((s, i) => (
                      <li key={i}>
                        <strong>{s.label}</strong>
                        <p>
                          {s.component} · {s.state.replaceAll("_", " ")}
                        </p>
                        {s.evidence && <p>Owner evidence: {s.evidence}</p>}
                        <label>
                          Evidence for {t.objective}, step {i + 1}
                          <textarea
                            maxLength={1000}
                            value={evidence[`${t.id}-${i}`] || ""}
                            onChange={(e) =>
                              setEvidence({
                                ...evidence,
                                [`${t.id}-${i}`]: e.target.value,
                              })
                            }
                          />
                        </label>
                        <button
                          disabled={busy || !evidence[`${t.id}-${i}`]?.trim()}
                          onClick={() =>
                            void act({
                              action: "step",
                              id: t.id,
                              revision: t.revision,
                              index: i,
                              evidence: evidence[`${t.id}-${i}`],
                            })
                          }
                        >
                          Record owner evidence
                        </button>
                      </li>
                    ))}
                  </ol>
                  <details>
                    <summary>Task history</summary>
                    {t.history.map((h, i) => (
                      <p key={i}>
                        {h.at} · {h.message}
                      </p>
                    ))}
                  </details>
                </article>
              ))}
              <h3>Actual render-job activity</h3>
              {!data.renderJobs.length && (
                <p>No local render history for this owner.</p>
              )}
              {data.renderJobs.map((j) => (
                <details key={j.id}>
                  <summary>
                    {j.id} · {j.state}
                  </summary>
                  {j.error && <p>{j.error}</p>}
                  {j.history.map((h, i) => (
                    <p key={i}>
                      {new Date(h.at).toISOString()} · {h.state}
                    </p>
                  ))}
                </details>
              ))}
            </>
          )}
          <p className="muted">
            {data.scope} Local operational data survives reloads on this PC, not
            across devices. Company records and approval status remain in
            Supabase.
          </p>
        </>
      )}
    </section>
  );
}
