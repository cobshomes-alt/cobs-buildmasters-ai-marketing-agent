"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import type { Asset } from "./media-library";
import {
  PLATFORM_NAMES,
  WORK_STAGES,
  samplePlan,
  validBrief,
  validPlan,
  encodePlan,
  decodePlan,
  isPlanningRecord,
  calendarDate,
  workflowStage,
  type Brief,
  type PlanDocument,
} from "../../lib/creative-plan";

export type StudioPost = {
  id: string;
  title: string;
  body: string;
  status: "Draft" | "Pending approval" | "Approved" | "Scheduled" | "Rejected";
  source: "ai" | "starter" | "manual";
  campaign_id?: string | null;
  media_id?: string | null;
  updated_at?: string;
  approved_at?: string | null;
};
type Props = {
  client: SupabaseClient;
  session: Session;
  campaigns: { id: string; name: string }[];
  posts: StudioPost[];
  assets: Asset[];
  onSaved: (post: StudioPost) => void;
  navigate: (section: string) => void;
  children: ReactNode;
};
const initialBrief = (): Brief => ({
  topic: "I want to film my concrete block factory",
  project: "",
  evidence: "",
  period: "week",
  style: "Professional",
  length: "45–60 seconds",
  platforms: ["Facebook", "Instagram"],
  startDate: new Date().toISOString().slice(0, 10),
});

export default function CreativeDirector({
  client,
  session,
  campaigns,
  posts,
  assets,
  onSaved,
  navigate,
  children,
}: Props) {
  const [brief, setBrief] = useState<Brief>(initialBrief);
  const [document, setDocument] = useState<PlanDocument | null>(null);
  const [saved, setSaved] = useState<StudioPost | null>(null);
  const [campaign, setCampaign] = useState("");
  const [media, setMedia] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Choose a campaign, then create a sample plan or request live AI.",
  );
  const [tab, setTab] = useState("Filming plan");
  const [draftCopy, setDraftCopy] = useState<
    "caption" | "description" | "voiceover"
  >("caption");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/creative-director", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled)
          setConfigured(
            typeof data.configured === "boolean" ? data.configured : null,
          );
      })
      .catch(() => {
        if (!cancelled) setConfigured(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session.access_token]);
  const plans = posts.filter(isPlanningRecord);
  const output = posts.find((p) => p.id === document?.outputPostId);
  function changeBrief(patch: Partial<Brief>) {
    setBrief((b) => ({ ...b, ...patch }));
    setDirty(true);
  }
  function changeDocument(patch: Partial<PlanDocument>) {
    setDocument((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  }
  function changePlan(patch: Partial<PlanDocument["plan"]>) {
    if (document)
      changeDocument({
        plan: { ...document.plan, ...patch },
        source: "manual",
      });
  }
  async function generate(ai: boolean) {
    if (!validBrief(brief)) {
      setMessage(
        "Complete the topic, calendar date and at least one platform within the field limits.",
      );
      return;
    }
    if (
      document &&
      dirty &&
      !window.confirm("Replace the unsaved planning changes?")
    )
      return;
    setBusy(true);
    try {
      let plan = samplePlan(brief);
      if (ai) {
        const { data } = await client.auth.getSession();
        const response = await fetch("/api/creative-director", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session?.access_token || ""}`,
          },
          body: JSON.stringify(brief),
        });
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.error || "Live AI could not generate a plan.",
          );
        if (!validPlan(payload.plan))
          throw new Error("The returned plan is invalid.");
        plan = payload.plan;
      }
      const next: PlanDocument = {
        version: 1,
        brief: { ...brief },
        plan,
        source: ai ? "ai" : "starter",
        checked: [],
        stage: "Filming Plan",
        outputPostId: null,
      };
      encodePlan(next);
      setDocument(next);
      setSaved(null);
      setMedia("");
      setDirty(true);
      setTab("Filming plan");
      setMessage(
        ai
          ? "AI-generated plan ready. Verify all facts and save it to your campaign."
          : "Sample template ready — no AI was called. Edit it for your real project and save.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Planning failed.");
    } finally {
      setBusy(false);
    }
  }
  async function persist(next: PlanDocument, outputMedia = media) {
    if (
      document &&
      (brief.period !== document.brief.period ||
        brief.style !== document.brief.style ||
        brief.length !== document.brief.length ||
        [...brief.platforms].sort().join() !==
          [...document.brief.platforms].sort().join())
    )
      throw new Error(
        "Calendar, style, length or platform preferences changed. Generate a new plan to apply them, or restore the saved preferences before saving.",
      );
    if (!campaigns.some((c) => c.id === campaign))
      throw new Error(
        "Choose an existing campaign before saving. Create one in Campaign Planner if needed.",
      );
    const values = {
      title: `Production plan: ${next.brief.topic}`.slice(0, 240),
      body: encodePlan(next),
      source: next.source,
      campaign_id: campaign,
      media_id: outputMedia || null,
      status: "Draft",
    };
    const query = saved
      ? client
          .from("cobs_posts")
          .update(values)
          .eq("id", saved.id)
          .eq("updated_at", saved.updated_at || "")
      : client
          .from("cobs_posts")
          .insert({ ...values, created_by: session.user.id });
    const { data, error } = await query.select("*").single();
    if (error || !data)
      throw new Error(
        "Plan could not be saved. It may have changed on another device; reopen it before retrying. Your current edits remain visible.",
      );
    onSaved(data as StudioPost);
    setSaved(data as StudioPost);
    setDocument(next);
    setDirty(false);
    return data as StudioPost;
  }
  async function save() {
    if (!document) return;
    setBusy(true);
    try {
      await persist({ ...document, brief });
      setMessage("Production plan and checklist saved to the campaign.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  function open(post: StudioPost) {
    if (
      dirty &&
      !window.confirm("Discard unsaved planning changes and open this plan?")
    )
      return;
    const parsed = decodePlan(post.body);
    if (!parsed) {
      setMessage(
        "This saved plan cannot be read. Its original record has been preserved.",
      );
      return;
    }
    setDocument(parsed);
    setBrief(parsed.brief);
    setSaved(post);
    setCampaign(post.campaign_id || "");
    setMedia(post.media_id || "");
    setDirty(false);
    setMessage("Saved campaign production plan opened.");
  }
  async function createDraft(index: number) {
    if (!document) return;
    if (document.outputPostId) {
      setMessage(
        "This plan already has a review draft. Open Content Calendar to edit it; changes invalidate approval.",
      );
      return;
    }
    setBusy(true);
    try {
      encodePlan({
        ...document,
        brief,
        outputPostId: "00000000-0000-4000-8000-000000000000",
        stage: "Editing Queue",
      });
      const stored = await persist({ ...document, brief });
      const script = document.plan.scripts[index];
      const { data, error } = await client
        .from("cobs_posts")
        .insert({
          title: brief.topic.slice(0, 240),
          body: `${script.hook}\n\n${script[draftCopy]}\n\n${script.cta}\n\n${script.hashtags}`,
          status: "Draft",
          source: document.source,
          campaign_id: campaign,
          media_id: media || null,
          created_by: session.user.id,
        })
        .select("*")
        .single();
      if (error || !data)
        throw new Error(
          "Plan saved, but review draft creation failed. No approval or publishing occurred.",
        );
      onSaved(data as StudioPost);
      // Use the freshly saved timestamp rather than a stale React state closure.
      const linked = {
        ...document,
        brief,
        outputPostId: data.id as string,
        stage: "Editing Queue" as const,
      };
      const result = await client
        .from("cobs_posts")
        .update({ body: encodePlan(linked) })
        .eq("id", stored.id)
        .eq("updated_at", stored.updated_at || "")
        .select("*")
        .single();
      if (result.error || !result.data) {
        setDocument(linked);
        setDirty(true);
        setMessage(
          `Review draft ${data.id} was created, but its plan link could not be saved. Save this plan to repair the link; do not create a duplicate draft.`,
        );
        return;
      }
      onSaved(result.data as StudioPost);
      setSaved(result.data as StudioPost);
      setDocument(linked);
      setDirty(false);
      setMessage(
        "Review draft created. It still requires owner submission and approval in the existing workflow. Nothing was published.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Draft creation failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  const selectedAsset = assets.find((a) => a.id === media);
  return (
    <div className="creative-workspace">
      <section className="creative-hero">
        <span className="creative-eyebrow">
          COBS BUILDMASTERS LTD · PRODUCTION STUDIO
        </span>
        <h2>AI Creative Director</h2>
        <p>
          Turn a marketing idea into a practical filming plan, shot checklist
          and content calendar.
        </p>
        <span className="creative-mode">
          {configured === true
            ? "Live AI configured · requests may use your existing API quota"
            : configured === false
              ? "Live AI unavailable · sample / manual planning available"
              : "AI configuration not verified · sample / manual planning available"}
        </span>
      </section>
      <p role="status" className="creative-notice">
        {message}
      </p>
      <div className="creative-layout">
        <aside className="creative-card creative-brief">
          <h3>Your production brief</h3>
          <label>
            Promote or film
            <textarea
              maxLength={400}
              value={brief.topic}
              onChange={(e) => changeBrief({ topic: e.target.value })}
            />
          </label>
          <label>
            Campaign
            <select
              value={campaign}
              disabled={Boolean(document?.outputPostId)}
              onChange={(e) => {
                setCampaign(e.target.value);
                setDirty(true);
              }}
            >
              <option value="">Select a campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {!campaigns.length && (
            <button type="button" onClick={() => navigate("Campaign Planner")}>
              Create a campaign
            </button>
          )}
          <label>
            Project or location label
            <input
              maxLength={120}
              value={brief.project}
              onChange={(e) => changeBrief({ project: e.target.value })}
            />
          </label>
          <label>
            Verified evidence and constraints
            <textarea
              maxLength={1200}
              placeholder="What is genuinely available to film? Which claims need checking?"
              value={brief.evidence}
              onChange={(e) => changeBrief({ evidence: e.target.value })}
            />
          </label>
          <div className="creative-pair">
            <label>
              Calendar
              <select
                value={brief.period}
                onChange={(e) =>
                  changeBrief({ period: e.target.value as Brief["period"] })
                }
              >
                <option value="week">Weekly · 7 ideas</option>
                <option value="month">Monthly · 12 ideas</option>
              </select>
            </label>
            <label>
              Start date
              <input
                type="date"
                value={brief.startDate}
                onChange={(e) => changeBrief({ startDate: e.target.value })}
              />
            </label>
          </div>
          <label>
            Creative style
            <select
              value={brief.style}
              onChange={(e) =>
                changeBrief({ style: e.target.value as Brief["style"] })
              }
            >
              {["Professional", "Educational", "Behind the scenes"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Final video length
            <select
              value={brief.length}
              onChange={(e) =>
                changeBrief({ length: e.target.value as Brief["length"] })
              }
            >
              {["15–30 seconds", "45–60 seconds", "90 seconds"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Platforms</legend>
            {PLATFORM_NAMES.map((p) => (
              <label className="creative-check" key={p}>
                <input
                  type="checkbox"
                  checked={brief.platforms.includes(p)}
                  onChange={(e) =>
                    changeBrief({
                      platforms: e.target.checked
                        ? [...brief.platforms, p]
                        : brief.platforms.filter((x) => x !== p),
                    })
                  }
                />
                {p}
              </label>
            ))}
          </fieldset>
          <div className="creative-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => void generate(false)}
            >
              Create sample plan
            </button>
            <button
              type="button"
              disabled={busy || configured !== true}
              onClick={() => void generate(true)}
            >
              {busy ? "Working…" : "Generate live AI plan"}
            </button>
          </div>
          <p className="creative-small">
            Sample plans use an editable template, never live AI. No image or
            video generation services are used. Check facts, consent and site
            safety before production.
          </p>
          <h3>Saved production plans</h3>
          {plans.length ? (
            plans.map((p) => (
              <button
                className="creative-saved"
                type="button"
                key={p.id}
                disabled={busy}
                onClick={() => open(p)}
              >
                {p.title}
                {!decodePlan(p.body) && " · needs review"}
              </button>
            ))
          ) : (
            <p className="creative-small">
              Saved plans will appear here across devices.
            </p>
          )}
        </aside>
        <section className="creative-card creative-output">
          {!document ? (
            <div className="creative-empty">
              <span aria-hidden="true">✦</span>
              <h3>Plan the story before filming</h3>
              <p>
                Build a weekly or monthly plan for your factory, construction
                project, equipment rentals or property marketing.
              </p>
              <p>
                Start with a labelled sample and customise it, or use your
                configured server-side AI.
              </p>
            </div>
          ) : (
            <>
              <div className="creative-output-heading">
                <div>
                  <span className="creative-eyebrow">
                    {document.source === "ai"
                      ? "AI-GENERATED · FACT CHECK REQUIRED"
                      : document.source === "starter"
                        ? "SAMPLE TEMPLATE · NOT AI-GENERATED"
                        : "MANUALLY EDITED PLAN"}
                  </span>
                  <h3>{document.brief.project || document.brief.topic}</h3>
                  <p>
                    {dirty ? "Unsaved changes" : "Saved to campaign"} ·{" "}
                    {workflowStage(document, output)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  Save production plan
                </button>
              </div>
              <ol className="creative-workflow">
                {[...WORK_STAGES, "Owner Review", "Approved Content"].map(
                  (s) => (
                    <li
                      className={
                        workflowStage(document, output) === s ? "current" : ""
                      }
                      key={s}
                    >
                      {s}
                    </li>
                  ),
                )}
              </ol>
              <label>
                Production stage
                <select
                  value={document.stage}
                  onChange={(e) =>
                    changeDocument({
                      stage: e.target.value as PlanDocument["stage"],
                    })
                  }
                >
                  {WORK_STAGES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <p className="creative-small">
                Editing Queue is a manual production handoff. Owner Review and
                Approved Content reflect the linked post’s actual approval
                status.
              </p>
              <div className="creative-tabs" aria-label="Production plan views">
                {[
                  "Filming plan",
                  "Ideas & calendar",
                  "Scripts & captions",
                  "Original media",
                ].map((t) => (
                  <button
                    type="button"
                    aria-pressed={tab === t}
                    key={t}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tab === "Filming plan" && (
                <>
                  {(
                    [
                      ["overview", "Production direction"],
                      ["orientation", "Recording orientation"],
                      ["lighting", "Lighting and conditions"],
                      ["sequence", "Filming sequence"],
                      ["structure", "Final edit structure"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <textarea
                        maxLength={600}
                        value={document.plan[key]}
                        onChange={(e) => changePlan({ [key]: e.target.value })}
                      />
                    </label>
                  ))}
                  <div className="creative-safety">
                    <h4>Site safety comes first</h4>
                    <ul>
                      {document.plan.safety.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <h4>
                    Shot checklist · {document.checked.length}/
                    {document.plan.shots.length} captured
                  </h4>
                  {document.plan.shots.map((shot, i) => (
                    <article className="creative-shot" key={i}>
                      <label className="creative-check">
                        <input
                          type="checkbox"
                          checked={document.checked.includes(i)}
                          onChange={(e) =>
                            changeDocument({
                              checked: e.target.checked
                                ? [...document.checked, i]
                                : document.checked.filter((n) => n !== i),
                            })
                          }
                        />
                        <strong>
                          {i + 1}. {shot.scene}
                        </strong>
                        <span>{shot.seconds}s raw take</span>
                      </label>
                      <p>
                        <b>Angle:</b> {shot.angle} · <b>Movement:</b>{" "}
                        {shot.movement}
                      </p>
                      <p>{shot.demonstration}</p>
                      <p className="creative-small">
                        Transition: {shot.transition}
                      </p>
                      <details>
                        <summary>Customise this shot</summary>
                        {(
                          [
                            "scene",
                            "angle",
                            "movement",
                            "demonstration",
                            "transition",
                          ] as const
                        ).map((key) => (
                          <label key={key}>
                            {key}
                            <input
                              maxLength={
                                key === "demonstration"
                                  ? 240
                                  : key === "transition"
                                    ? 100
                                    : 160
                              }
                              value={shot[key]}
                              onChange={(e) =>
                                changePlan({
                                  shots: document.plan.shots.map((s, n) =>
                                    n === i
                                      ? { ...s, [key]: e.target.value }
                                      : s,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                        <label>
                          Raw take seconds
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={shot.seconds}
                            onChange={(e) =>
                              changePlan({
                                shots: document.plan.shots.map((s, n) =>
                                  n === i
                                    ? { ...s, seconds: Number(e.target.value) }
                                    : s,
                                ),
                              })
                            }
                          />
                        </label>
                      </details>
                    </article>
                  ))}
                  <h4>Platform production notes</h4>
                  {document.plan.platforms.map((p) => (
                    <p key={p.platform}>
                      <b>
                        {p.platform} · {p.format}
                      </b>
                      <br />
                      {p.requirements}
                    </p>
                  ))}
                </>
              )}
              {tab === "Ideas & calendar" && (
                <>
                  <h4>Content idea bank</h4>
                  <div className="creative-ideas">
                    {document.plan.ideas.map((idea, i) => (
                      <article key={i}>
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <h4>{idea.title}</h4>
                        <p>{idea.evidence}</p>
                        <details>
                          <summary>Customise idea</summary>
                          <label>
                            Idea title
                            <input
                              maxLength={120}
                              value={idea.title}
                              onChange={(e) =>
                                changePlan({
                                  ideas: document.plan.ideas.map((value, n) =>
                                    n === i
                                      ? { ...value, title: e.target.value }
                                      : value,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label>
                            Evidence needed
                            <input
                              maxLength={180}
                              value={idea.evidence}
                              onChange={(e) =>
                                changePlan({
                                  ideas: document.plan.ideas.map((value, n) =>
                                    n === i
                                      ? { ...value, evidence: e.target.value }
                                      : value,
                                  ),
                                })
                              }
                            />
                          </label>
                        </details>
                      </article>
                    ))}
                  </div>
                  <h4>
                    {document.brief.period === "week" ? "Weekly" : "Monthly"}{" "}
                    production calendar
                  </h4>
                  <p className="creative-small">
                    Planning suggestions only — this calendar does not schedule
                    or publish posts.
                  </p>
                  <div className="creative-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Idea</th>
                          <th>Platform</th>
                          <th>Format</th>
                        </tr>
                      </thead>
                      <tbody>
                        {document.plan.calendar.map((day, i) => (
                          <tr key={i}>
                            <td>
                              {calendarDate(document.brief.startDate, day.day)}
                            </td>
                            <td>
                              <input
                                aria-label={`Calendar idea ${i + 1}`}
                                maxLength={120}
                                value={day.idea}
                                onChange={(e) =>
                                  changePlan({
                                    calendar: document.plan.calendar.map(
                                      (value, n) =>
                                        n === i
                                          ? { ...value, idea: e.target.value }
                                          : value,
                                    ),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <select
                                aria-label={`Calendar platform ${i + 1}`}
                                value={day.platform}
                                onChange={(e) =>
                                  changePlan({
                                    calendar: document.plan.calendar.map(
                                      (value, n) =>
                                        n === i
                                          ? {
                                              ...value,
                                              platform: e.target.value,
                                            }
                                          : value,
                                    ),
                                  })
                                }
                              >
                                {document.brief.platforms.map((platform) => (
                                  <option key={platform}>{platform}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                aria-label={`Calendar format ${i + 1}`}
                                maxLength={80}
                                value={day.format}
                                onChange={(e) =>
                                  changePlan({
                                    calendar: document.plan.calendar.map(
                                      (value, n) =>
                                        n === i
                                          ? { ...value, format: e.target.value }
                                          : value,
                                    ),
                                  })
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {tab === "Scripts & captions" && (
                <>
                  <label>
                    Review draft copy
                    <select
                      value={draftCopy}
                      onChange={(e) =>
                        setDraftCopy(e.target.value as typeof draftCopy)
                      }
                    >
                      <option value="caption">
                        Facebook / Instagram caption
                      </option>
                      <option value="description">
                        TikTok / YouTube description
                      </option>
                      <option value="voiceover">Voice-over script</option>
                    </select>
                  </label>
                  {document.plan.scripts.map((script, i) => (
                    <article className="creative-script" key={i}>
                      <h4>
                        {script.style} · {script.length}
                      </h4>
                      {(
                        [
                          "hook",
                          "voiceover",
                          "caption",
                          "description",
                          "hashtags",
                          "cta",
                        ] as const
                      ).map((key) => (
                        <label key={key}>
                          {
                            {
                              hook: "Opening hook",
                              voiceover: "Voice-over / video script",
                              caption: "Facebook & Instagram caption",
                              description: "TikTok & YouTube description",
                              hashtags: "Hashtags",
                              cta: "Call to action",
                            }[key]
                          }
                          <textarea
                            maxLength={
                              key === "voiceover"
                                ? 1200
                                : ["caption", "description"].includes(key)
                                  ? 900
                                  : key === "hashtags"
                                    ? 250
                                    : 200
                            }
                            value={script[key]}
                            onChange={(e) =>
                              changePlan({
                                scripts: document.plan.scripts.map((s, n) =>
                                  n === i ? { ...s, [key]: e.target.value } : s,
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                      <button
                        type="button"
                        disabled={busy || Boolean(document.outputPostId)}
                        onClick={() => void createDraft(i)}
                      >
                        Create review draft
                      </button>
                    </article>
                  ))}
                  {document.outputPostId && (
                    <button
                      type="button"
                      onClick={() => navigate("Content Calendar")}
                    >
                      Open content review draft
                    </button>
                  )}
                </>
              )}
              {tab === "Original media" && (
                <>
                  <h4>Use your original photographs and videos</h4>
                  <p>
                    Upload original footage in the existing secure Media
                    Library. Select one asset for this plan and its review
                    draft. Additional footage remains organised in the library
                    by campaign, project or product.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !dirty ||
                        window.confirm(
                          "Leave Creative Studio? Save your plan first to keep changes.",
                        )
                      )
                        navigate("Media Library");
                    }}
                  >
                    Open Media Library
                  </button>
                  <label>
                    Original media attachment
                    <select
                      value={media}
                      onChange={(e) => {
                        setMedia(e.target.value);
                        setDirty(true);
                      }}
                    >
                      <option value="">No attachment</option>
                      {assets
                        .filter((a) => !a.deletion_pending)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.original_name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {selectedAsset?.url &&
                    (selectedAsset.mime_type.startsWith("image/") ? (
                      <img
                        className="creative-preview"
                        alt={selectedAsset.original_name}
                        src={selectedAsset.url}
                      />
                    ) : (
                      <video
                        className="creative-preview"
                        controls
                        src={selectedAsset.url}
                      />
                    ))}
                  <p className="creative-small">
                    Save to attach to the plan. A newly created review draft
                    inherits the selection; existing draft attachments are
                    edited in Content Calendar.
                  </p>
                </>
              )}
            </>
          )}
        </section>
      </div>
      <details className="creative-card">
        <summary>Quick post generator · existing tools</summary>
        {children}
      </details>
    </div>
  );
}
