"use client";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimelineClip } from "../../lib/timeline";
import type { AudioTrack, Motion } from "../../lib/cinematic-model.mjs";
import type { Asset } from "./media-library";
export function motionStyle(clip: TimelineClip, offset: number) {
  const m = clip.effects?.motion;
  if (!m) return {};
  const f = Math.min(1, Math.max(0, offset / clip.recipe.duration));
  return {
    transform: `scale(${m.fromScale + (m.toScale - m.fromScale) * f})`,
    transformOrigin: `${(m.fromX + (m.toX - m.fromX) * f) * 100}% ${(m.fromY + (m.toY - m.fromY) * f) * 100}%`,
  };
}
export function CinematicControls({
  clip,
  last,
  assets,
  onChange,
  view = "all",
}: {
  view?: string;
  clip: TimelineClip;
  last: boolean;
  assets: Asset[];
  onChange: (patch: Partial<TimelineClip>) => void;
}) {
  const e = clip.effects || {},
    m = e.motion;
  const set = (patch: Partial<NonNullable<TimelineClip["effects"]>>) =>
    onChange({ effects: { ...e, ...patch } });
  return (
    <section aria-label="Cinematic clip controls">
      <h4>Cinematic composition</h4>
      {(view === "all" || view === "Filters") && (
        <>
          <label>
            Colour preset
            <select
              value={e.grade || "none"}
              onChange={(ev) =>
                set({
                  grade:
                    ev.target.value === "art-of-building"
                      ? "art-of-building"
                      : undefined,
                })
              }
            >
              <option value="none">Original colours</option>
              <option value="art-of-building">
                COBS — The Art of Building
              </option>
            </select>
          </label>
        </>
      )}
      {(view === "all" || view === "Effects") && clip.kind === "video" && (
        <label>
          Playback speed
          <input
            type="number"
            min={0.5}
            max={2}
            step={0.1}
            value={e.speed || 1}
            onChange={(ev) => {
              const speed = ev.target.valueAsNumber;
              if (Number.isFinite(speed))
                set({ speed: Math.min(2, Math.max(0.5, speed)) });
            }}
          />
        </label>
      )}
      {(view === "all" || view === "Templates" || view === "Graphics") &&
        last && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={e.logoEnding || false}
              onChange={(ev) =>
                onChange({
                  effects: { ...e, logoEnding: ev.target.checked },
                  recipe: {
                    ...clip.recipe,
                    watermark: ev.target.checked || clip.recipe.watermark,
                  },
                })
              }
            />
            Fade in original logo ending
          </label>
        )}
      <p className="muted">
        Scene duration is output time; source footage used equals duration ×
        speed. Slow motion repeats frames, without optical-flow synthesis. Warm
        preview is approximate; the export applies the full grade. Choose shots
        and trim points manually. No automatic beat or visual scene analysis.
      </p>
      <button
        onClick={() => onChange({ effects: undefined, transition: undefined })}
      >
        Clear cinematic effects
      </button>
      {(view === "all" || view === "Transitions") && (
        <>
          <label>
            Outgoing transition
            <select
              value={clip.transition?.type || "cut"}
              disabled={last}
              onChange={(ev) =>
                onChange({
                  transition: {
                    type: ev.target.value as "cut" | "fade" | "dissolve",
                    duration:
                      ev.target.value === "cut"
                        ? 0
                        : Math.min(0.4, clip.recipe.duration / 2),
                  },
                })
              }
            >
              <option value="cut">Hard cut</option>
              <option value="fade">Crossfade</option>
              <option value="dissolve">Dissolve</option>
            </select>
          </label>
          {clip.transition && clip.transition.type !== "cut" && (
            <label>
              Transition seconds
              <input
                type="number"
                min={0.08}
                max={Math.min(1, clip.recipe.duration / 2)}
                step={0.04}
                value={clip.transition.duration}
                onChange={(ev) =>
                  onChange({
                    transition: {
                      ...clip.transition!,
                      duration: Number(ev.target.value),
                    },
                  })
                }
              />
            </label>
          )}
        </>
      )}
      {(view === "all" || view === "Templates" || view === "Text") && (
        <>
          <label>
            Title template
            <select
              value={e.template || "plain"}
              onChange={(ev) =>
                onChange({
                  effects: {
                    ...e,
                    template: ev.target.value as typeof e.template,
                  },
                  recipe: {
                    ...clip.recipe,
                    text:
                      clip.recipe.text ||
                      (ev.target.value === "outro"
                        ? "Contact COBS BUILDMASTERS LTD"
                        : "COBS BUILDMASTERS LTD"),
                  },
                })
              }
            >
              <option value="plain">Top title</option>
              <option value="lower-third">Branded lower third</option>
              <option value="intro">Centered intro</option>
              <option value="outro">Centered closing advertisement</option>
            </select>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={e.animateText || false}
              onChange={(ev) => set({ animateText: ev.target.checked })}
            />
            Fade in title
          </label>
        </>
      )}
      {(view === "all" || view === "Effects") && (
        <>
          <label className="check-label">
            <input
              type="checkbox"
              checked={!!m}
              onChange={(ev) =>
                set({
                  motion: ev.target.checked
                    ? {
                        fromScale: 1,
                        toScale: 1.15,
                        fromX: 0.5,
                        toX: 0.5,
                        fromY: 0.5,
                        toY: 0.5,
                      }
                    : undefined,
                })
              }
            />
            Two-keyframe zoom / pan
          </label>
          {m && (
            <div className="director-options">
              {(
                [
                  "fromScale",
                  "toScale",
                  "fromX",
                  "toX",
                  "fromY",
                  "toY",
                ] as (keyof Motion)[]
              ).map((k) => (
                <label key={k}>
                  {k}
                  <input
                    type="number"
                    step={0.05}
                    min={k.includes("Scale") ? 1 : 0}
                    max={k.includes("Scale") ? 1.8 : 1}
                    value={m[k]}
                    onChange={(ev) =>
                      set({ motion: { ...m, [k]: Number(ev.target.value) } })
                    }
                  />
                </label>
              ))}
            </div>
          )}
        </>
      )}
      {(view === "all" || view === "Graphics") && (
        <>
          <label>
            Picture-in-picture original
            <select
              value={e.layer?.mediaId || ""}
              onChange={(ev) => {
                const a = assets.find((a) => a.id === ev.target.value);
                set({
                  layer: a
                    ? {
                        mediaId: a.id,
                        kind: a.mime_type.startsWith("video/")
                          ? "video"
                          : "image",
                        start: 0,
                        x: 0.05,
                        y: 0.05,
                        width: 0.3,
                      }
                    : undefined,
                });
              }}
            >
              <option value="">No second visual layer</option>
              {assets
                .filter((a) => !a.deletion_pending)
                .map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.original_name}
                  </option>
                ))}
            </select>
          </label>
          {e.layer && (
            <div className="director-options">
              {(["start", "x", "y", "width"] as const).map((k) => (
                <label key={k}>
                  Layer {k}
                  <input
                    type="number"
                    min={k === "width" ? 0.15 : 0}
                    max={
                      k === "start"
                        ? 570
                        : k === "width"
                          ? 0.45
                          : k === "y"
                            ? 0.55
                            : 1 - e.layer!.width
                    }
                    step={0.05}
                    value={e.layer![k]}
                    onChange={(ev) =>
                      set({
                        layer: { ...e.layer!, [k]: Number(ev.target.value) },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          )}
        </>
      )}
      <p className="muted">
        Two linear motion keyframes; one muted picture-in-picture layer, plus
        titles/captions/logo. Crossfades shorten the final duration. Preview
        shows framing and text; final audio/transition timing is verified in the
        export. Cinematic edits are unsaved until a future schema extension is
        approved.
      </p>
    </section>
  );
}
export function AudioTracks({
  client,
  tracks,
  onChange,
  onBusy,
}: {
  client: SupabaseClient;
  tracks: AudioTrack[];
  onChange: (tracks: AudioTrack[]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(kind: AudioTrack["kind"], file: File) {
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      if (file.size > 10 * 1024 * 1024) throw Error("Use audio under 10 MiB.");
      const { data } = await client.auth.getSession();
      const response = await fetch("/api/studio/audio", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session?.access_token || ""}`,
          "Content-Type": file.name.toLowerCase().endsWith(".mp3")
            ? "audio/mpeg"
            : "audio/wav",
          "X-Audio-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Audio upload failed.");
      onChange([
        ...tracks.filter((t) => t.kind !== kind),
        {
          id: result.id,
          kind,
          volume: kind === "music" ? 0.2 : 1,
          offset: 0,
          fade: 0.4,
          loop: kind === "music",
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audio upload failed.");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="glass-panel" aria-label="Separate audio tracks">
      <h3>Music &amp; narration</h3>
      <p>
        Use only audio you own or have permission to use. Local, owner-protected
        WAV/MP3 capture; 10 MiB per file. Handles expire after 24 hours. No
        speech generation or paid provider is called.
      </p>
      <fieldset disabled={busy}>
        {(["music", "narration"] as const).map((kind) => {
          const t = tracks.find((t) => t.kind === kind);
          return (
            <div key={kind}>
              <label>
                {kind === "music"
                  ? "Background music original"
                  : "Recorded voice-over original"}
                <input
                  type="file"
                  accept=".mp3,.wav,audio/mpeg,audio/wav"
                  onChange={(ev) => {
                    const f = ev.target.files?.[0];
                    if (f) void upload(kind, f);
                  }}
                />
              </label>
              {t && (
                <>
                  <p>
                    {kind} ready locally · {t.id}
                  </p>
                  <div className="director-options">
                    {(["volume", "offset", "fade"] as const).map((k) => (
                      <label key={k}>
                        {kind} {k}
                        <input
                          type="number"
                          min={0}
                          max={k === "volume" ? 2 : k === "offset" ? 59 : 3}
                          step={0.1}
                          value={t[k]}
                          onChange={(ev) =>
                            onChange(
                              tracks.map((a) =>
                                a.id === t.id
                                  ? { ...a, [k]: Number(ev.target.value) }
                                  : a,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                  {kind === "music" && (
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={t.loop}
                        onChange={(ev) =>
                          onChange(
                            tracks.map((a) =>
                              a.id === t.id
                                ? { ...a, loop: ev.target.checked }
                                : a,
                            ),
                          )
                        }
                      />
                      Loop music
                    </label>
                  )}
                  <button
                    onClick={() =>
                      onChange(tracks.filter((a) => a.id !== t.id))
                    }
                  >
                    Detach {kind}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </fieldset>
      {busy && <p role="status">Inspecting local audio…</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
