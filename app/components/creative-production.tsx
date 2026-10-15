"use client";
import type {
  Brief,
  CreativePlan,
  PlanDocument,
} from "../../lib/creative-plan";
import { workflowStage } from "../../lib/creative-plan";
import { shotPresentation } from "../../lib/production-guidance";

export function StudioIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    brief: "M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h4",
    storyboard: "M3 5h18v14H3z M9 5v14 M15 5v14",
    checklist: "m3 6 2 2 3-4 M11 6h10 m-18 8 2 2 3-4 M11 14h10",
    script: "M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5",
    calendar: "M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18 M7 14h3 M14 14h3",
    media: "M3 4h18v16H3z m1 14 5-6 4 4 3-3 4 5 M8 8h.01",
    workflow: "M3 9h5v6H3z M16 9h5v6h-5z M8 12h8 m-3-3 3 3-3 3",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.brief} />
    </svg>
  );
}

export function ProductionDashboard({
  brief,
  document,
  campaign,
  dirty,
  savedAt,
  output,
  navigate,
}: {
  brief: Brief;
  document: PlanDocument | null;
  campaign: string;
  dirty: boolean;
  savedAt?: string;
  output?: { status: string; approved_at?: string | null };
  navigate: (section: string) => void;
}) {
  const total = document?.plan.shots.length || 0,
    complete = document?.checked.length || 0;
  const timestamp =
    savedAt && !Number.isNaN(Date.parse(savedAt))
      ? new Date(savedAt).toLocaleString()
      : null;
  return (
    <section className="production-dashboard">
      <div className="studio-section-heading">
        <div>
          <span className="creative-eyebrow">YOUR PRODUCTION AT A GLANCE</span>
          <h3>{campaign || "Start your next production"}</h3>
          <p>
            {brief.objective ||
              "Create factual, useful marketing content for COBS BUILDMASTERS LTD."}
          </p>
        </div>
        <button type="button" onClick={() => navigate("Production brief")}>
          Edit production brief
        </button>
      </div>
      <div className="production-metrics">
        <article>
          <span>Content direction</span>
          <strong>{brief.topic}</strong>
          <small>
            {brief.audience ||
              "Prospective construction and property customers"}
          </small>
        </article>
        <article>
          <span>Delivery format</span>
          <strong>{brief.length}</strong>
          <small>
            {brief.platforms.join(" · ") || "Choose platforms"}
            <br />
            {document
              ? [
                  ...new Set(
                    document.plan.platforms.map((platform) => platform.format),
                  ),
                ].join(" · ")
              : "Orientation guidance available after planning"}
          </small>
        </article>
        <article>
          <span>Filming progress</span>
          <strong>
            {complete}
            <em> / {total} shots</em>
          </strong>
          <progress
            value={complete}
            max={total || 1}
            aria-label="Filming progress"
          />
          <small>
            {total - complete} remaining ·{" "}
            {total ? "From this plan’s checklist" : "Generate a plan to begin"}
          </small>
        </article>
        <article>
          <span>Production stage</span>
          <strong>{document ? workflowStage(document, output) : "Idea"}</strong>
          <small>
            {dirty
              ? "Unsaved changes"
              : timestamp
                ? `Last saved ${timestamp}`
                : savedAt
                  ? "Saved to campaign"
                  : "Not saved yet"}
          </small>
        </article>
      </div>
      <div className="studio-quick-links">
        {[
          ["storyboard", "Storyboard", "Plan the sequence"],
          ["checklist", "Filming checklist", "Capture every shot"],
          ["script", "Scripts & captions", "Shape your message"],
          ["media", "Original media", "Use genuine footage"],
        ].map(([icon, section, description]) => (
          <button type="button" key={section} onClick={() => navigate(section)}>
            <StudioIcon name={icon} />
            <span>
              <b>{section}</b>
              <small>{description}</small>
            </span>
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      <div className="studio-evidence-note">
        <strong>Evidence before claims.</strong> Work with genuine COBS footage
        and confirmed information. Suggested dates are planning targets, not a
        publishing schedule.
      </div>
    </section>
  );
}

type StoryProps = {
  document: PlanDocument;
  checklist?: boolean;
  update: (plan: Partial<CreativePlan>) => void;
  check: (index: number, checked: boolean) => void;
};
export function VisualStoryboard({
  document,
  checklist = false,
  update,
  check,
}: StoryProps) {
  const { plan, checked } = document;
  return (
    <section>
      <div className="studio-section-heading">
        <div>
          <span className="creative-eyebrow">
            {checklist ? "ON-SITE CAPTURE MODE" : "YOUR STORY, SCENE BY SCENE"}
          </span>
          <h3>{checklist ? "Filming checklist" : "Visual storyboard"}</h3>
          <p>
            {checklist
              ? "Mark captured shots, note retakes and save your progress."
              : "A production guide using shot diagrams and text — no reference footage is invented."}
          </p>
        </div>
        <span className="studio-pill">
          {checked.length} / {plan.shots.length} recorded
        </span>
      </div>
      <progress
        className="studio-progress"
        value={checked.length}
        max={plan.shots.length}
        aria-label="Shot completion"
      />
      <div className="studio-safety-strip">
        <StudioIcon name="checklist" />
        <span>
          <b>Safety first:</b> approved filming locations, supervisor
          permission, site PPE and safe separation. Never stage dangerous
          demonstrations.
        </span>
      </div>
      {!checklist && (
        <ol className="story-order" aria-label="Recommended scene order">
          {plan.shots.map((shot, i) => (
            <li key={i}>
              <a href={`#scene-${i + 1}`}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {shot.scene}
              </a>
            </li>
          ))}
        </ol>
      )}
      <div className={checklist ? "shot-capture-list" : "storyboard-grid"}>
        {plan.shots.map((shot, i) => {
          const view = shotPresentation(shot, i, plan);
          return (
            <article
              className={`story-card ${checked.includes(i) ? "recorded" : ""}`}
              key={i}
              id={`scene-${i + 1}`}
            >
              <div className="story-card-top">
                <span className="scene-index">
                  SCENE {String(i + 1).padStart(2, "0")}
                </span>
                <span className="studio-pill">
                  {view.shotType} · {shot.seconds}s
                </span>
              </div>
              <div className="shot-diagram" aria-hidden="true">
                <span className="frame-corner top-left" />
                <span className="frame-corner top-right" />
                <StudioIcon name="storyboard" />
                <span className="diagram-label">
                  {view.shotType.toUpperCase()} · SHOT GUIDE
                </span>
                <span className="frame-corner bottom-left" />
                <span className="frame-corner bottom-right" />
              </div>
              <h4>{shot.scene}</h4>
              <p className="scene-purpose">{view.purpose}</p>
              <dl className="scene-facts">
                <div>
                  <dt>Camera</dt>
                  <dd>{shot.angle}</dd>
                </div>
                <div>
                  <dt>Movement</dt>
                  <dd>{shot.movement}</dd>
                </div>
                <div>
                  <dt>On screen / action</dt>
                  <dd>{view.onScreen}</dd>
                </div>
                <div>
                  <dt>Recording format</dt>
                  <dd>
                    {plan.platforms
                      .map((p) => `${p.platform}: ${p.format}`)
                      .join(" · ")}
                  </dd>
                </div>
              </dl>
              <label className="capture-toggle">
                <input
                  type="checkbox"
                  aria-label={`Record scene ${i + 1}: ${shot.scene}`}
                  checked={checked.includes(i)}
                  onChange={(e) => check(i, e.target.checked)}
                />
                <span>
                  {checked.includes(i) ? "Recorded" : "Mark as recorded"}
                </span>
              </label>
              {checklist && (
                <label>
                  Retake notes
                  <textarea
                    maxLength={180}
                    placeholder="Focus, framing, audio or another take needed?"
                    value={shot.retake || ""}
                    onChange={(e) =>
                      update({
                        shots: plan.shots.map((value, n) =>
                          n === i
                            ? { ...value, retake: e.target.value }
                            : value,
                        ),
                      })
                    }
                  />
                </label>
              )}
              <details className="scene-advanced">
                <summary>Direction & customisation</summary>
                <p>
                  <b>Worker / presenter:</b> {shot.demonstration}
                </p>
                <p>
                  <b>Lighting:</b> {view.lighting}
                </p>
                <p>
                  <b>Audio:</b> {view.audio}
                </p>
                <p>
                  <b>Orientation:</b> {view.orientation}
                </p>
                <p>
                  <b>Transition:</b> {shot.transition}
                </p>
                {(
                  [
                    ["scene", "Scene title", 160],
                    ["purpose", "Scene purpose", 180],
                    ["shotType", "Shot type", 180],
                    ["angle", "Camera angle", 160],
                    ["movement", "Camera movement", 160],
                    ["onScreen", "On-screen action", 180],
                    ["demonstration", "Presenter / worker direction", 240],
                    ["audio", "Audio direction", 180],
                    ["transition", "Transition", 100],
                  ] as const
                ).map(([key, label, max]) => (
                  <label key={key}>
                    {label}
                    <input
                      maxLength={max}
                      value={shot[key] || ""}
                      placeholder={
                        key in view
                          ? String(view[key as keyof typeof view])
                          : undefined
                      }
                      onChange={(e) =>
                        update({
                          shots: plan.shots.map((value, n) =>
                            n === i
                              ? { ...value, [key]: e.target.value }
                              : value,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  Raw recording duration (seconds)
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={shot.seconds}
                    onChange={(e) =>
                      update({
                        shots: plan.shots.map((value, n) =>
                          n === i
                            ? { ...value, seconds: Number(e.target.value) }
                            : value,
                        ),
                      })
                    }
                  />
                </label>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
