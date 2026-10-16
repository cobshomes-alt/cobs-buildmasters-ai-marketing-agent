"use client";
import { useEffect, useState, useRef, type ReactNode } from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import {
  ProductionDashboard,
  VisualStoryboard,
  StudioIcon,
} from "./creative-production";
import {
  ACTIVITY_LABELS,
  VERIFIED_ACTIVITIES,
} from "../../lib/production-guidance";
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
  activity: "factory",
  product: "Concrete blocks",
  audience: "Builders and property developers",
  objective: "Explain our production process and invite enquiries",
  footage: "",
  instructions: "",
  verifiedActivities: [],
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
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("Creative dashboard");
  const [draftCopy, setDraftCopy] = useState<
    "caption" | "description" | "voiceover"
  >("caption");
  const [dirty, setDirty] = useState(false);
  const operation = useRef(false);
  const pendingPlanId = useRef<string | null>(null);
  const pendingDraftId = useRef<string | null>(null);
  const sectionNames = [
    "Creative dashboard",
    "Production brief",
    "Storyboard",
    "Filming checklist",
    "Scripts & captions",
    "Ideas & calendar",
    "Original media",
    "Production workflow",
  ];
  const sectionIcons = [
    "dashboard",
    "brief",
    "storyboard",
    "checklist",
    "script",
    "calendar",
    "media",
    "workflow",
  ];
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const leave = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest("button") : null;
      if (
        target &&
        ((target.closest('nav[aria-label="Workspace sections"]') &&
          target.getAttribute("data-workspace-section") !==
            "Creative Studio") ||
          ["Refresh", "Refresh workspace", "Sign out"].includes(
            target.textContent?.trim() || "",
          )) &&
        !window.confirm(
          "Leave Creative Studio and discard unsaved changes? Save your plan first to keep them.",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    window.document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.document.removeEventListener("click", leave, true);
    };
  }, [dirty]);
  async function copyText(text: string) {
    try {
      if (!navigator.clipboard) throw new Error();
      await navigator.clipboard.writeText(text);
      setMessage("Text copied. Review all claims before using it.");
    } catch {
      setMessage(
        "Clipboard is unavailable. Select the text in its field and copy it manually.",
      );
    }
  }
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
    if (operation.current) return;
    operation.current = true;
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
      pendingPlanId.current = null;
      pendingDraftId.current = null;
      setTab("Storyboard");
      setMessage(
        ai
          ? "AI-generated plan ready. Verify all facts and save it to your campaign."
          : "Sample template ready — no AI was called. Edit it for your real project and save.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Planning failed.");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function persist(next: PlanDocument, outputMedia = media) {
    if (
      document &&
      ((brief.activity || "general") !==
        (document.brief.activity || "general") ||
        JSON.stringify([...(brief.verifiedActivities || [])].sort()) !==
          JSON.stringify(
            [...(document.brief.verifiedActivities || [])].sort(),
          ) ||
        brief.period !== document.brief.period ||
        brief.style !== document.brief.style ||
        brief.length !== document.brief.length ||
        [...brief.platforms].sort().join() !==
          [...document.brief.platforms].sort().join())
    )
      throw new Error(
        "Category, verified activities, calendar, style, length or platform preferences changed. Generate a new plan to apply them, or restore the saved preferences before saving.",
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
    pendingPlanId.current ||= crypto.randomUUID();
    const query = saved
      ? client
          .from("cobs_posts")
          .update(values)
          .eq("id", saved.id)
          .eq("updated_at", saved.updated_at || "")
      : client.from("cobs_posts").insert({
          ...values,
          id: pendingPlanId.current,
          created_by: session.user.id,
        });
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
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      await persist({ ...document, brief });
      setMessage("Production plan and checklist saved to the campaign.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      operation.current = false;
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
    pendingPlanId.current = null;
    pendingDraftId.current = null;
    setTab("Storyboard");
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
    if (operation.current) return;
    operation.current = true;
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
      pendingDraftId.current ||= crypto.randomUUID();
      const { data, error } = await client
        .from("cobs_posts")
        .insert({
          id: pendingDraftId.current,
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
      operation.current = false;
      setBusy(false);
    }
  }
  const selectedAsset = assets.find((a) => a.id === media);
  return (
    <div className="creative-workspace" aria-busy={busy}>
      <section className="creative-hero">
        <span className="creative-eyebrow">
          COBS BUILDMASTERS LTD · PRODUCTION STUDIO
        </span>
        <h2>AI Creative Director</h2>
        <p>
          Turn a marketing idea into a practical filming plan, shot checklist
          and content calendar.
        </p>
      </section>
      {(busy || message) && (
        <p
          role="status"
          className={`creative-notice ${busy ? "is-loading" : /could not|failed|invalid|exceeds|not configured|rejected|quota|unavailable|expired/i.test(message) ? "is-error" : /saved|created|copied|ready/i.test(message) ? "is-success" : ""}`}
        >
          {busy ? "Creating your plan…" : message}
        </p>
      )}
      <nav
        className="studio-navigation"
        aria-label="Creative Director sections"
      >
        {sectionNames.map((section, i) => (
          <button
            type="button"
            key={section}
            aria-current={tab === section ? "page" : undefined}
            onClick={() => setTab(section)}
          >
            <StudioIcon name={sectionIcons[i]} />
            <span>{section}</span>
          </button>
        ))}
      </nav>
      {plans.length > 0 && (
        <section className="creative-card studio-plan-library">
          {" "}
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
        </section>
      )}
      <fieldset
        disabled={busy}
        className="creative-layout premium-layout"
        aria-label="Production workspace"
      >
        <aside
          className="creative-card creative-brief"
          hidden={tab !== "Production brief"}
        >
          <div className="studio-section-heading">
            <div>
              <span className="creative-eyebrow">01 / DEFINE THE STORY</span>
              <h3>Your production brief</h3>
              <p>
                Tell us what is real, who it is for and what the content should
                achieve.
              </p>
            </div>
            <StudioIcon name="brief" />
          </div>
          <div className="brief-grid">
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
              <button
                type="button"
                onClick={() => navigate("Campaign Planner")}
              >
                Create a campaign
              </button>
            )}
            <label>
              Production category
              <select
                value={brief.activity || "general"}
                onChange={(e) =>
                  changeBrief({
                    activity: e.target.value as Brief["activity"],
                    verifiedActivities: [],
                  })
                }
              >
                {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ["product", "Product or service"],
                ["audience", "Target audience"],
                ["objective", "Content objective"],
                ["footage", "Available footage or equipment"],
                ["instructions", "Specific filming instructions"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea
                  maxLength={240}
                  value={brief[key] || ""}
                  onChange={(e) => changeBrief({ [key]: e.target.value })}
                />
              </label>
            ))}
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
                {["Professional", "Educational", "Behind the scenes"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
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
          </div>
          <fieldset className="verified-activities">
            <legend>Verified activities available to film</legend>
            <p>
              Choose only activities genuinely performed or available. No choice
              implies completion, quality certification or stock availability.
            </p>
            <div>
              {(VERIFIED_ACTIVITIES[brief.activity || "general"] || []).map(
                (activity) => (
                  <label className="creative-check" key={activity}>
                    <input
                      type="checkbox"
                      checked={
                        brief.verifiedActivities?.includes(activity) || false
                      }
                      onChange={(e) =>
                        changeBrief({
                          verifiedActivities: e.target.checked
                            ? [...(brief.verifiedActivities || []), activity]
                            : (brief.verifiedActivities || []).filter(
                                (value) => value !== activity,
                              ),
                        })
                      }
                    />
                    {activity}
                  </label>
                ),
              )}
            </div>
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
              aria-describedby="creative-ai-help"
              disabled={busy || configured !== true}
              onClick={() => void generate(true)}
            >
              {busy ? "Working…" : "Generate live AI plan"}
            </button>
          </div>
          <p id="creative-ai-help" className="creative-small">
            {configured === true
              ? "AI requests use your configured API quota."
              : "AI generation unavailable. Use a sample plan."}
          </p>
          <p className="creative-small">
            Sample plans use an editable template, never live AI. No image or
            video generation services are used. Check facts, consent and site
            safety before production.
          </p>
        </aside>
        <section
          className="creative-card creative-output"
          hidden={tab === "Production brief"}
        >
          {tab === "Creative dashboard" && (
            <ProductionDashboard
              brief={document?.brief || brief}
              document={document}
              campaign={campaigns.find((c) => c.id === campaign)?.name || ""}
              dirty={dirty}
              savedAt={saved?.updated_at}
              output={output}
              navigate={setTab}
            />
          )}
          {!document && tab !== "Creative dashboard" ? (
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
              <button type="button" onClick={() => setTab("Production brief")}>
                Open production brief
              </button>
            </div>
          ) : document ? (
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
              {tab === "Production workflow" && (
                <section className="workflow-panel">
                  <h3>Production workflow</h3>
                  <ol className="creative-workflow">
                    {[...WORK_STAGES, "Owner Review", "Approved Content"].map(
                      (s) => (
                        <li
                          className={
                            workflowStage(document, output) === s
                              ? "current"
                              : ""
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
                    Editing Queue is a manual production handoff. Owner Review
                    and Approved Content reflect the linked post’s actual
                    approval status.
                  </p>
                  <p>
                    Review draft: {output ? output.status : "Not created"}.
                    Editing Queue is a manual handoff; no editing engine is
                    connected.
                  </p>
                  <dl className="workflow-evidence">
                    <div>
                      <dt>Brief & filming plan</dt>
                      <dd>
                        Prepared in this plan ·{" "}
                        {saved ? "saved to campaign" : "not saved yet"}
                      </dd>
                    </div>
                    <div>
                      <dt>Capture</dt>
                      <dd>
                        {document.checked.length} of{" "}
                        {document.plan.shots.length} shots recorded
                      </dd>
                    </div>
                    <div>
                      <dt>Original media</dt>
                      <dd>
                        {saved?.media_id
                          ? "Attached to saved plan"
                          : media
                            ? "Selected, not saved"
                            : "No saved attachment"}
                      </dd>
                    </div>
                    <div>
                      <dt>Owner decision</dt>
                      <dd>
                        {output?.status === "Rejected"
                          ? "Rejected — revise and resubmit"
                          : output?.approved_at &&
                              ["Approved", "Scheduled"].includes(output.status)
                            ? "Owner approval recorded"
                            : output?.status === "Pending approval"
                              ? "Awaiting owner review"
                              : "No current owner approval"}
                      </dd>
                    </div>
                  </dl>
                  {document.outputPostId && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !dirty ||
                          window.confirm(
                            "Leave Creative Studio? Save changes first to keep them.",
                          )
                        )
                          navigate("Content Calendar");
                      }}
                    >
                      Open content review draft
                    </button>
                  )}
                </section>
              )}
              {(tab === "Storyboard" || tab === "Filming checklist") && (
                <VisualStoryboard
                  document={document}
                  checklist={tab === "Filming checklist"}
                  update={changePlan}
                  check={(index, checked) =>
                    changeDocument({
                      checked: checked
                        ? [
                            ...document.checked.filter((n) => n !== index),
                            index,
                          ]
                        : document.checked.filter((n) => n !== index),
                    })
                  }
                />
              )}
              {tab === "Storyboard" && (
                <details className="studio-direction">
                  <summary>Overall filming direction & platform notes</summary>
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
                  <ul>
                    {document.plan.safety.map((value, i) => (
                      <li key={i}>{value}</li>
                    ))}
                  </ul>
                  {document.plan.platforms.map((p) => (
                    <p key={p.platform}>
                      <b>
                        {p.platform} ? {p.format}
                      </b>
                      <br />
                      {p.requirements}
                    </p>
                  ))}
                </details>
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
                          <th>Objective & evidence</th>
                          <th>Draft status</th>
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
                            <td>
                              <label>
                                Objective
                                <input
                                  maxLength={180}
                                  value={day.objective || ""}
                                  placeholder={
                                    document.brief.objective ||
                                    "Owner to define"
                                  }
                                  onChange={(e) =>
                                    changePlan({
                                      calendar: document.plan.calendar.map(
                                        (value, n) =>
                                          n === i
                                            ? {
                                                ...value,
                                                objective: e.target.value,
                                              }
                                            : value,
                                      ),
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Required evidence
                                <input
                                  maxLength={180}
                                  value={day.evidence || ""}
                                  placeholder="Genuine footage and verified facts"
                                  onChange={(e) =>
                                    changePlan({
                                      calendar: document.plan.calendar.map(
                                        (value, n) =>
                                          n === i
                                            ? {
                                                ...value,
                                                evidence: e.target.value,
                                              }
                                            : value,
                                      ),
                                    })
                                  }
                                />
                              </label>
                            </td>
                            <td>
                              <span className="studio-pill">
                                Planning suggestion
                              </span>
                              <p>No individual draft linked to this date.</p>
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
                  <div className="studio-section-heading">
                    <div>
                      <span className="creative-eyebrow">
                        WORDS WITH PURPOSE
                      </span>
                      <h3>Script & caption studio</h3>
                      <p>
                        Edit the message, preview it, then copy or save. All
                        claims require owner verification.
                      </p>
                    </div>
                  </div>
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
                      <label>
                        Presenter talking points
                        <textarea
                          maxLength={180}
                          value={script.talkingPoints || ""}
                          placeholder="Introduce the genuine activity; explain what is visible; invite enquiries."
                          onChange={(e) =>
                            changePlan({
                              scripts: document.plan.scripts.map((value, n) =>
                                n === i
                                  ? { ...value, talkingPoints: e.target.value }
                                  : value,
                              ),
                            })
                          }
                        />
                      </label>
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
                          <button
                            type="button"
                            className="studio-copy"
                            onClick={() => void copyText(script[key])}
                          >
                            Copy {key}
                          </button>
                        </label>
                      ))}
                      <details className="script-preview">
                        <summary>Preview this script</summary>
                        <h4>{script.hook}</h4>
                        <p>{script.voiceover}</p>
                        <p>{script.caption}</p>
                        <p>{script.description}</p>
                        <p>{script.cta}</p>
                        <p>{script.hashtags}</p>
                      </details>
                      <button
                        type="button"
                        disabled={busy || Boolean(document.outputPostId)}
                        onClick={() => void createDraft(i)}
                      >
                        Create review draft
                      </button>
                    </article>
                  ))}
                  <details className="scene-script-notes">
                    <summary>Scene voice-over & on-screen text</summary>
                    <p>
                      Manual scene notes remain attached to the filming plan.
                      Adapt the script to the actual footage; no automatic
                      timing or video edit is implied.
                    </p>
                    {document.plan.shots.map((shot, i) => (
                      <article key={i}>
                        <h4>
                          Scene {i + 1}: {shot.scene}
                        </h4>
                        {(
                          [
                            ["narration", "Scene voice-over"],
                            ["screenText", "On-screen text"],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key}>
                            {label}
                            <textarea
                              maxLength={180}
                              value={shot[key] || ""}
                              onChange={(e) =>
                                changePlan({
                                  shots: document.plan.shots.map((value, n) =>
                                    n === i
                                      ? { ...value, [key]: e.target.value }
                                      : value,
                                  ),
                                })
                              }
                            />
                            <button
                              type="button"
                              className="studio-copy"
                              onClick={() => void copyText(shot[key] || "")}
                            >
                              Copy {label.toLowerCase()}
                            </button>
                          </label>
                        ))}
                      </article>
                    ))}
                  </details>
                  {document.outputPostId && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !dirty ||
                          window.confirm(
                            "Leave Creative Studio? Save your plan first to keep changes.",
                          )
                        )
                          navigate("Content Calendar");
                      }}
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
                  {selectedAsset && (
                    <div className="media-attachment-info">
                      <strong>{selectedAsset.original_name}</strong>
                      <span>
                        {selectedAsset.mime_type} ·{" "}
                        {(selectedAsset.size_bytes / 1024).toFixed(1)} KB
                      </span>
                      <p>
                        {saved?.media_id === selectedAsset.id
                          ? "Attached to saved production plan"
                          : "Selected — save plan to attach"}
                      </p>
                    </div>
                  )}
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
          ) : null}
        </section>
      </fieldset>
      {document && tab === "Filming checklist" && (
        <div className="capture-savebar">
          <span>
            <b>
              {document.checked.length} / {document.plan.shots.length} recorded
            </b>
            <small>
              {dirty ? "Unsaved checklist changes" : "Checklist saved"}
            </small>
          </span>
          <button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save checklist progress"}
          </button>
        </div>
      )}
      <details className="creative-card">
        <summary>Quick post generator · existing tools</summary>
        {children}
      </details>
    </div>
  );
}
