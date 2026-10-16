"use client";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Asset } from "./media-library";
import type { EditBrief, EditingPlan } from "../../lib/automatic-editing";
import {
  validatePlanTimeline,
  instructionHints,
} from "../../lib/automatic-editing";
import type { TimelineDocument } from "../../lib/timeline";

export default function AutomaticEditingDirector({
  client,
  assets,
  disabled,
  onApply,
  onBusy,
}: {
  client: SupabaseClient;
  assets: Asset[];
  disabled: boolean;
  onApply: (doc: TimelineDocument) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [brief, setBrief] = useState<EditBrief>({
    instructions:
      "Create a professional promotion from my selected originals, with captions and our original logo.",
    mediaIds: [],
    priorityIds: [],
    platforms: ["Instagram", "TikTok"],
    duration: 30,
    aspect: "9:16",
    style: "professional",
    companyInfo: "",
    narration: "",
    captions: true,
    branding: true,
    starts: {},
  });
  const [plan, setPlan] = useState<EditingPlan | null>(null),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function change(patch: Partial<EditBrief>) {
    setBrief((b) => ({ ...b, ...patch }));
    setPlan(null);
    setError("");
  }
  async function generate(nextBrief: EditBrief = brief) {
    if (busy) return;
    setBusy(true);
    onBusy(true);
    setError("");
    setPlan(null);
    try {
      const { data } = await client.auth.getSession();
      const response = await fetch("/api/studio/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token || ""}`,
        },
        body: JSON.stringify(nextBrief),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Planning failed.");
      validatePlanTimeline(result.plan.timeline, result.plan.media);
      setPlan(result.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planning failed.");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section
      className="automatic-director glass-panel"
      aria-label="Automatic Editing Director"
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">COBS / EDITING DIRECTOR</span>
          <h3>Turn your brief into a first cut.</h3>
        </div>
        <span>Free rule-based planning</span>
      </div>
      <p>
        Measured originals. An editable proposal. No paid AI calls or visual
        scene analysis. Controls below determine the edit; your instructions
        remain the creative brief.
      </p>
      <fieldset disabled={disabled || busy}>
        <label>
          Marketing instructions
          <textarea
            value={brief.instructions}
            maxLength={2000}
            onChange={(e) => change({ instructions: e.target.value })}
          />
        </label>
        <button onClick={() => change(instructionHints(brief.instructions))}>
          Use supported instruction hints
        </button>
        <p className="muted">
          Extract duration, named platforms, aspect, style, captions and logo
          preferences from your brief, then review the controls. Footage
          contents are not interpreted.
        </p>
        <div className="director-options">
          <label>
            Cinematic preset
            <select
              value={brief.cinematicPreset || "none"}
              onChange={(e) =>
                change({
                  cinematicPreset: e.target
                    .value as EditBrief["cinematicPreset"],
                })
              }
            >
              <option value="art-of-building">
                COBS — The Art of Building
              </option>
              <option value="none">Clean hard cuts</option>
              <option value="gentle">Gentle zoom &amp; soft crossfades</option>
              <option value="story">
                Branded intro, cinematic movement &amp; closing title
              </option>
            </select>
          </label>
          <label>
            Target duration (seconds)
            <input
              type="number"
              min={1}
              max={60}
              step={0.04}
              value={brief.duration}
              onChange={(e) => change({ duration: Number(e.target.value) })}
            />
          </label>
          <label>
            Export aspect
            <select
              value={brief.aspect}
              onChange={(e) =>
                change({ aspect: e.target.value as EditBrief["aspect"] })
              }
            >
              {["9:16", "16:9", "1:1", "4:5"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Creative style
            <select
              value={brief.style}
              onChange={(e) =>
                change({ style: e.target.value as EditBrief["style"] })
              }
            >
              <option value="professional">Professional · fit originals</option>
              <option value="energetic">Energetic · fill frame</option>
              <option value="educational">Educational · fit originals</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Intended platforms</legend>
          <div className="director-options">
            {["Instagram", "TikTok", "Facebook", "YouTube"].map((p) => (
              <label className="check-label" key={p}>
                <input
                  type="checkbox"
                  checked={brief.platforms.includes(p)}
                  onChange={(e) =>
                    change({
                      platforms: e.target.checked
                        ? [...brief.platforms, p]
                        : brief.platforms.filter((v) => v !== p),
                    })
                  }
                />
                {p}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>
            Select originals · up to six · selection order becomes scene order
          </legend>
          <div className="director-media-list">
            {assets
              .filter((a) => !a.deletion_pending)
              .map((a) => (
                <div className="director-media" key={a.id}>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      aria-label={`Use ${a.original_name}`}
                      checked={brief.mediaIds.includes(a.id)}
                      disabled={
                        !brief.mediaIds.includes(a.id) &&
                        brief.mediaIds.length >= 6
                      }
                      onChange={(e) =>
                        change(
                          e.target.checked
                            ? { mediaIds: [...brief.mediaIds, a.id] }
                            : {
                                mediaIds: brief.mediaIds.filter(
                                  (id) => id !== a.id,
                                ),
                                priorityIds: brief.priorityIds.filter(
                                  (id) => id !== a.id,
                                ),
                                starts: Object.fromEntries(
                                  Object.entries(brief.starts).filter(
                                    ([id]) => id !== a.id,
                                  ),
                                ),
                              },
                        )
                      }
                    />
                    {a.original_name}
                  </label>
                  <small>
                    {a.mime_type} · {(a.size_bytes / 1048576).toFixed(2)} MiB ·{" "}
                    {[a.project, a.product].filter(Boolean).join(" / ") ||
                      "No owner labels"}
                  </small>
                  {brief.mediaIds.includes(a.id) && (
                    <div className="director-options">
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={brief.priorityIds.includes(a.id)}
                          onChange={(e) =>
                            change({
                              priorityIds: e.target.checked
                                ? [...brief.priorityIds, a.id]
                                : brief.priorityIds.filter((id) => id !== a.id),
                            })
                          }
                        />
                        Priority: place first
                      </label>
                      {a.mime_type.startsWith("video/") && (
                        <label>
                          Trim start for {a.original_name}
                          <input
                            type="number"
                            min={0}
                            max={570}
                            step={0.04}
                            value={brief.starts[a.id] || 0}
                            onChange={(e) =>
                              change({
                                starts: {
                                  ...brief.starts,
                                  [a.id]: Number(e.target.value),
                                },
                              })
                            }
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
          {!assets.length && <p>Add originals in Media Library first.</p>}
        </fieldset>
        <div className="director-options">
          <label className="check-label">
            <input
              type="checkbox"
              checked={brief.captions}
              onChange={(e) => change({ captions: e.target.checked })}
            />
            Editable brand captions
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={brief.branding}
              onChange={(e) => change({ branding: e.target.checked })}
            />
            Original company logo
          </label>
        </div>
        <details>
          <summary>Optional production notes</summary>
          <label>
            Verified company information
            <textarea
              maxLength={1000}
              value={brief.companyInfo}
              onChange={(e) => change({ companyInfo: e.target.value })}
            />
          </label>
          <label>
            Preferred narration (notes only; no speech generated)
            <textarea
              maxLength={1000}
              value={brief.narration}
              onChange={(e) => change({ narration: e.target.value })}
            />
          </label>
        </details>
        <p className="muted">
          Clean cuts or bounded cinematic presets. Separate licensed music or
          recorded narration can be added in the timeline. No audio generation
          or scene-content inference is performed.
        </p>
        <button
          className="gold-button"
          disabled={!brief.mediaIds.length}
          onClick={() => void generate()}
        >
          {busy ? "Inspecting originals…" : "Generate rule-based editing plan"}
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {plan && (
        <div className="director-review" aria-label="Editing plan review">
          <h4>Review your proposed cut · {plan.totalDuration}s</h4>
          <label>
            Owner feedback for regeneration
            <textarea
              maxLength={1000}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </label>
          <button
            disabled={busy || disabled || !feedback.trim()}
            onClick={() => {
              const next = {
                ...brief,
                ...instructionHints(feedback),
                feedback,
              };
              setBrief(next);
              void generate(next);
            }}
          >
            Regenerate reviewed proposal
          </button>
          <p className="muted">
            Feedback applies supported duration/platform/framing/preset hints.
            Other notes are retained for owner review, not interpreted as visual
            facts. The current timeline is unchanged until you apply the new
            proposal.
          </p>
          <p>
            {plan.preset} · {plan.branding}
          </p>
          <p>{plan.audio}</p>
          <ol>
            {plan.scenes.map((s, i) => {
              const f = plan.media.find((m) => m.id === s.mediaId)!;
              return (
                <li key={s.mediaId}>
                  <strong>
                    {s.purpose}: {f.name}
                  </strong>
                  <p>
                    {f.mime} · {f.width}×{f.height} · {f.orientation} ·{" "}
                    {f.duration === null
                      ? "Still image"
                      : `${f.duration.toFixed(2)}s original`}{" "}
                    · {f.audio ? "Audio present" : "No audio"} · Thumbnail:{" "}
                    {f.thumbnail}
                  </p>
                  <p>
                    {f.mime.startsWith("video/")
                      ? `${s.start.toFixed(2)}–${s.end.toFixed(2)}s trim`
                      : `${s.duration.toFixed(2)}s display`}{" "}
                    · {s.transition === "cut" ? "Hard cut" : "Soft crossfade"} ·
                    Caption: {s.caption || "Off"}
                  </p>
                  <small>
                    Scene {i + 1} · Asset {s.mediaId}
                  </small>
                </li>
              );
            })}
          </ol>
          {plan.limitations.map((s) => (
            <p className="muted" key={s}>
              {s}
            </p>
          ))}
          <button
            className="gold-button"
            disabled={disabled || busy}
            onClick={() => onApply(plan.timeline)}
          >
            Use plan as editable timeline
          </button>
          <p>
            No rendering, saving or publication occurs until you take the next
            action.
          </p>
        </div>
      )}
    </section>
  );
}
