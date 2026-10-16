"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Asset } from "./media-library";
import {
  defaultRecipe,
  decodeEdit,
  encodeEdit,
  isEditingRecord,
  validateRecipe,
  DIMENSIONS,
  type Recipe,
} from "../../lib/studio-model.mjs";
import type { RenderJob } from "../../lib/render-worker.mjs";
import ProductionWorkspace from "./production-workspace";
import type { StudioEntry } from "./product-shell";
export default function MediaStudio(
  props: React.ComponentProps<typeof SingleSourceStudio> & {
    onAssets: (assets: Asset[]) => void;
    entry?: StudioEntry;
    onEntryChange?: (mode: StudioEntry) => void;
    onNavigate?: (s: string) => void;
  },
) {
  const [mode, setMode] = useState<StudioEntry>(props.entry || "choose"),
    [dirty, setDirty] = useState(false),
    [photoVisited, setPhotoVisited] = useState(props.entry === "photo");
  useEffect(() => {
    setMode(props.entry || "choose");
    if (props.entry === "photo") setPhotoVisited(true);
  }, [props.entry]);
  const choose = (next: StudioEntry) => {
    if (
      mode === "photo" &&
      next !== mode &&
      dirty &&
      !window.confirm(
        "Keep your downloaded work before leaving this editor. Continue?",
      )
    )
      return;
    if (next === "photo") setPhotoVisited(true);
    setMode(next);
    props.onEntryChange?.(next);
  };
  return (
    <div className="premium-media-suite">
      <nav className="studio-mode-switch" aria-label="Editor modes">
        <button
          aria-current={mode === "automatic" ? "page" : undefined}
          onClick={() => choose("automatic")}
        >
          Create with AI
        </button>
        <button
          aria-current={mode === "manual" ? "page" : undefined}
          onClick={() => choose("manual")}
        >
          Edit Myself
        </button>
        <button
          aria-current={mode === "photo" ? "page" : undefined}
          onClick={() => choose("photo")}
        >
          Photo editor
        </button>
        <button className="mode-help" onClick={() => choose("choose")}>
          Choose a mode
        </button>
      </nav>
      {mode === "choose" && (
        <section
          className="studio-choice"
          aria-label="Choose your editing mode"
        >
          <p className="eyebrow">YOUR FOOTAGE. YOUR STORY.</p>
          <h2>How would you like to create?</h2>
          <p>
            Start with a plan, or take the controls. You can switch at any time.
          </p>
          <div className="creation-actions">
            <button
              className="creation-action action-0"
              onClick={() => choose("automatic")}
            >
              <span className="creation-icon" aria-hidden="true">
                ✦
              </span>
              <div>
                <h3>Create with AI</h3>
                <p>
                  Describe your video. Review an automatic plan, then make it
                  your own.
                </p>
                <small>
                  Rule-based planning available. Visual AI not connected.
                </small>
              </div>
            </button>
            <button
              className="creation-action"
              onClick={() => choose("manual")}
            >
              <span className="creation-icon" aria-hidden="true">
                ▣
              </span>
              <div>
                <h3>Edit Myself</h3>
                <p>Arrange your clips, add music and shape every moment.</p>
                <small>Your originals are never overwritten.</small>
              </div>
            </button>
          </div>
        </section>
      )}
      <div hidden={mode !== "automatic" && mode !== "manual"}>
        <ProductionWorkspace
          client={props.client}
          assets={props.assets}
          campaigns={props.campaigns}
          onAssets={props.onAssets}
          onDirty={setDirty}
          planningMode={mode === "automatic"}
          onManual={() => choose("manual")}
          onNavigate={props.onNavigate}
        />
      </div>
      {photoVisited && (
        <div hidden={mode !== "photo"}>
          <SingleSourceStudio {...props} />
        </div>
      )}
    </div>
  );
}
type Project = {
  id: string;
  title: string;
  body: string;
  status: "Draft" | "Pending approval" | "Approved" | "Scheduled" | "Rejected";
  source: "manual" | "ai" | "starter";
  media_id?: string | null;
  campaign_id?: string | null;
  updated_at?: string;
};
function SingleSourceStudio({
  client,
  assets,
  posts,
  campaigns,
  onSaved,
}: {
  client: SupabaseClient;
  assets: Asset[];
  posts: Project[];
  campaigns: { id: string; name: string }[];
  onSaved: (p: Project) => void;
}) {
  const [recipe, setRecipe] = useState(defaultRecipe),
    [title, setTitle] = useState(""),
    [media, setMedia] = useState(""),
    [campaign, setCampaign] = useState(""),
    [project, setProject] = useState<Project | null>(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [jobs, setJobs] = useState<RenderJob[]>([]),
    [ready, setReady] = useState(false),
    [online, setOnline] = useState(false);
  const lock = useRef(false),
    newId = useRef<string | null>(null),
    video = useRef<HTMLVideoElement>(null);
  const asset = assets.find((a) => a.id === media),
    isVideo = asset?.mime_type.startsWith("video/");
  const projects = posts.filter(isEditingRecord);
  const change = (update: Partial<Recipe>) => {
    setRecipe((r) => ({ ...r, ...update }));
    setDirty(true);
  };
  const api = useCallback(
    async (payload?: object, download?: string) => {
      const { data } = await client.auth.getSession();
      const response = await fetch(
        `/api/studio${download ? `?download=${encodeURIComponent(download)}` : ""}`,
        {
          method: payload ? "POST" : "GET",
          headers: {
            Authorization: `Bearer ${data.session?.access_token || ""}`,
            ...(payload ? { "Content-Type": "application/json" } : {}),
          },
          ...(payload ? { body: JSON.stringify(payload) } : {}),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Studio operation failed.");
      }
      return download ? response.blob() : response.json();
    },
    [client],
  );
  useEffect(() => {
    let live = true;
    const poll = async () => {
      try {
        const result = await api();
        if (live) {
          setReady(result.ready);
          setOnline(result.workerOnline === true);
          setJobs(result.jobs);
        }
      } catch {
        if (live) {
          setReady(false);
          setMessage(
            "Render service could not be reached. Saved projects are unaffected.",
          );
        }
      }
    };
    void poll();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, 5000);
    return () => {
      live = false;
      clearInterval(interval);
    };
  }, [api]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const leave = (e: MouseEvent) => {
      const target =
        e.target instanceof Element ? e.target.closest("button") : null;
      if (
        target &&
        ((target.closest('nav[aria-label="Workspace sections"]') &&
          target.getAttribute("data-workspace-section") !== "Media Studio") ||
          (busy && target.closest('nav[aria-label="Editor modes"]')) ||
          ["Refresh", "Refresh workspace", "Sign out"].includes(
            target.textContent?.trim() || "",
          )) &&
        (busy ||
          !window.confirm("Leave Media Studio and discard unsaved edits?"))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty, busy]);
  function open(id: string) {
    if (busy || (dirty && !window.confirm("Discard unsaved edits?"))) return;
    const selected = projects.find((p) => p.id === id);
    if (!selected) {
      setProject(null);
      setTitle("");
      setMedia("");
      setCampaign("");
      setRecipe(defaultRecipe());
      newId.current = null;
      setDirty(false);
      return;
    }
    const decoded = decodeEdit(selected.body);
    if (!decoded) {
      setMessage(
        "This project recipe is unsupported or damaged. The stored record has been preserved.",
      );
      return;
    }
    setProject(selected);
    setTitle(selected.title);
    setMedia(selected.media_id || "");
    setCampaign(selected.campaign_id || "");
    setRecipe(decoded);
    setDirty(false);
    newId.current = null;
    setMessage("Saved editing project reopened.");
  }
  async function save() {
    if (lock.current) return;
    const error = validateRecipe(recipe);
    if (
      error ||
      !title.trim() ||
      title.length > 180 ||
      !asset ||
      asset.deletion_pending
    ) {
      setMessage(error || "Enter a title and choose an available original.");
      return;
    }
    if (project && !project.updated_at) {
      setMessage(
        "Refresh before editing this project: its revision is missing.",
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const { data: auth } = await client.auth.getSession();
      if (!auth.session)
        throw new Error("Sign in before saving an editing project.");
      const values = {
        title: title.trim(),
        body: encodeEdit(recipe),
        media_id: media,
        campaign_id: campaign || null,
        status: "Draft",
        source: "manual",
      };
      newId.current ??= crypto.randomUUID();
      const result = project
        ? await client
            .from("cobs_posts")
            .update(values)
            .eq("id", project.id)
            .eq("updated_at", project.updated_at)
            .select("*")
            .maybeSingle()
        : await client
            .from("cobs_posts")
            .insert({
              ...values,
              id: newId.current,
              created_by: auth.session.user.id,
            })
            .select("*")
            .single();
      if (result.error || !result.data)
        throw new Error(
          "Save was not confirmed. Another device may have changed this project. Refresh before retrying; uncertain new saves retain the same ID to avoid duplicates.",
        );
      setProject(result.data);
      onSaved(result.data);
      setDirty(false);
      setMessage(
        "Editing recipe saved to Supabase. Original media is unchanged.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function action(payload: object) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await api(payload);
      if (result.job)
        setJobs((current) => [
          result.job,
          ...current.filter((j) => j.id !== result.job.id),
        ]);
      setMessage(
        "Job state confirmed. Keep the local worker running; the browser can close after source transfer is accepted.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export failed.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function download(job: RenderJob) {
    try {
      const blob = await api(undefined, job.id),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `cobs-export-${job.id}.${job.kind === "image" ? "png" : "mp4"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Download failed.");
    }
  }
  const [width, height] = DIMENSIONS[recipe.aspect];
  return (
    <section
      className="media-studio"
      aria-label="Photo and video editing studio"
    >
      <header className="studio-banner">
        <span className="eyebrow">COBS PRODUCTION STUDIO</span>
        <h2>Photo &amp; Video Studio</h2>
        <p>Original footage. Intentional edits. Real files.</p>
        <span className="badge">Single-source editor · No AI credits</span>
      </header>
      <p className="surface">
        Edit one photo or short video and download a PNG or MP4. Social content
        still requires owner review. See Settings for export availability.
      </p>
      {message && (
        <div role="status" aria-live="polite">
          {message}
        </div>
      )}
      <div className="editor-grid">
        <div className="surface editor-controls">
          <fieldset className="editor-form" disabled={busy}>
            <h3>Project &amp; original</h3>
            <label>
              Saved editing project
              <select
                value={project?.id || ""}
                onChange={(e) => open(e.target.value)}
                disabled={busy}
              >
                <option value="">New editing project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Project title
              <input
                maxLength={180}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                disabled={busy}
              />
            </label>
            <label>
              Campaign
              <select
                value={campaign}
                onChange={(e) => {
                  setCampaign(e.target.value);
                  setDirty(true);
                }}
                disabled={busy}
              >
                <option value="">No campaign</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Original media
              <select
                value={media}
                onChange={(e) => {
                  setMedia(e.target.value);
                  setDirty(true);
                }}
                disabled={busy}
              >
                <option value="">Choose from private Media Library</option>
                {assets
                  .filter((a) => !a.deletion_pending)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.original_name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Aspect ratio
              <select
                value={recipe.aspect}
                onChange={(e) =>
                  change({ aspect: e.target.value as Recipe["aspect"] })
                }
              >
                <option>9:16</option>
                <option>16:9</option>
                <option>1:1</option>
                <option>4:5</option>
              </select>
            </label>
            <label>
              Image fit
              <select
                value={recipe.fit}
                onChange={(e) =>
                  change({ fit: e.target.value as Recipe["fit"] })
                }
              >
                <option value="contain">Fit entire original</option>
                <option value="cover">Fill frame (export crop)</option>
              </select>
            </label>
            {recipe.fit === "cover" && (
              <label>
                Crop position
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={recipe.position}
                  onChange={(e) => change({ position: Number(e.target.value) })}
                />
              </label>
            )}
            <fieldset disabled={busy}>
              <legend>Colour &amp; audio</legend>
              {(["brightness", "contrast", "saturation", "volume"] as const)
                .filter((key) => isVideo || key !== "volume")
                .map((key) => (
                  <label key={key}>
                    {key}
                    <input
                      type="range"
                      min={
                        key === "brightness"
                          ? -0.3
                          : key === "contrast"
                            ? 0.5
                            : 0
                      }
                      max={
                        key === "brightness"
                          ? 0.3
                          : key === "contrast"
                            ? 1.5
                            : 2
                      }
                      step={0.05}
                      value={recipe[key]}
                      onChange={(e) =>
                        change({ [key]: Number(e.target.value) })
                      }
                    />
                    <output>{recipe[key].toFixed(2)}</output>
                  </label>
                ))}
            </fieldset>
            {isVideo && (
              <div className="form-grid">
                <label>
                  Trim start (seconds)
                  <input
                    type="number"
                    min={0}
                    max={570}
                    step={0.1}
                    value={recipe.start}
                    onChange={(e) => change({ start: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Clip duration (seconds)
                  <input
                    type="number"
                    min={1}
                    max={30}
                    step={0.1}
                    value={recipe.duration}
                    onChange={(e) =>
                      change({ duration: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Audio fade (seconds)
                  <input
                    type="number"
                    min={0}
                    max={Math.min(3, recipe.duration / 2)}
                    step={0.1}
                    value={recipe.fade}
                    onChange={(e) => change({ fade: Number(e.target.value) })}
                  />
                </label>
              </div>
            )}
            <label>
              Branded headline
              <input
                maxLength={120}
                value={recipe.text}
                onChange={(e) => change({ text: e.target.value })}
              />
            </label>
            <label>
              Static subtitle (entire clip)
              <input
                maxLength={120}
                value={recipe.subtitle}
                onChange={(e) => change({ subtitle: e.target.value })}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={recipe.watermark}
                onChange={(e) => change({ watermark: e.target.checked })}
              />
              Include original COBS logo, unchanged
            </label>
            <button onClick={() => void save()} disabled={busy}>
              {busy ? "Working…" : "Save editing project"}
            </button>
          </fieldset>
        </div>
        <div>
          <article className="surface">
            <h3>Composition preview</h3>
            <p className="muted">
              Approximate browser composition. Downloaded FFmpeg output is
              authoritative. Native player shows original audio; fades are
              export-only.
            </p>
            <div
              className="edit-preview"
              style={{
                aspectRatio: `${width}/${height}`,
                maxWidth: `${(560 * width) / height}px`,
              }}
            >
              {asset?.url ? (
                isVideo ? (
                  <video
                    key={asset.id}
                    ref={video}
                    src={asset.url}
                    controls
                    preload="metadata"
                    style={{
                      objectFit: recipe.fit,
                      objectPosition: `${recipe.position * 100}% ${recipe.position * 100}%`,
                      filter: `brightness(${1 + recipe.brightness}) contrast(${recipe.contrast}) saturate(${recipe.saturation})`,
                    }}
                    onTimeUpdate={() => {
                      if (
                        video.current &&
                        video.current.currentTime >
                          recipe.start + recipe.duration
                      )
                        video.current.pause();
                    }}
                  />
                ) : (
                  <img
                    src={asset.url}
                    alt={asset.original_name}
                    style={{
                      objectFit: recipe.fit,
                      objectPosition: `${recipe.position * 100}% ${recipe.position * 100}%`,
                      filter: `brightness(${1 + recipe.brightness}) contrast(${recipe.contrast}) saturate(${recipe.saturation})`,
                    }}
                  />
                )
              ) : (
                <p>Choose an original from Media Library.</p>
              )}
              {recipe.text && (
                <span className="edit-headline">{recipe.text}</span>
              )}
              {recipe.subtitle && (
                <span className="edit-subtitle">{recipe.subtitle}</span>
              )}
              {recipe.watermark && (
                <img
                  className="edit-logo"
                  src="/branding/cobs-buildmasters-logo.jpeg"
                  alt="Original COBS logo"
                />
              )}
            </div>
            {isVideo && (
              <>
                <p className="edit-timeline">
                  Original → {recipe.start.toFixed(1)}s ━━━{" "}
                  {(recipe.start + recipe.duration).toFixed(1)}s → Export{" "}
                  {recipe.duration.toFixed(1)}s
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (video.current) {
                      video.current.currentTime = recipe.start;
                      video.current.volume = Math.min(1, recipe.volume);
                      void video.current
                        .play()
                        .catch(() =>
                          setMessage("Use the native video play control."),
                        );
                    }
                  }}
                >
                  Play selected range
                </button>
              </>
            )}
          </article>
          <article className="surface">
            <h3>Real export queue</h3>
            <p>
              {ready
                ? online
                  ? "Local worker connected."
                  : "Local worker is offline. Start it before exporting."
                : "Local rendering unavailable. See the implementation report for setup."}
            </p>
            <p>
              Outputs: {width} × {height}, PNG or MP4. Private download for 24
              hours; upload the exported file as a new Media Library asset to
              retain it permanently. No automatic approval or publication.
            </p>
            <button
              disabled={busy || dirty || !project || !ready || !online}
              onClick={() =>
                void action({
                  action: "render",
                  projectId: project?.id,
                  updatedAt: project?.updated_at,
                })
              }
            >
              Render saved project
            </button>
            {dirty && <p>Save changes before rendering.</p>}
            <ol className="render-history">
              {jobs.map((job) => (
                <li key={job.id}>
                  <strong>
                    {job.kind.toUpperCase()} · {job.state}
                  </strong>
                  <small>
                    Job {job.id} · attempts {job.attempts}
                  </small>
                  {job.error && <p>{job.error}</p>}
                  <details>
                    <summary>Job history</summary>
                    {job.history.map((e, i) => (
                      <p key={i}>
                        {new Date(e.at).toLocaleString()} · {e.state}
                      </p>
                    ))}
                  </details>
                  {job.state === "completed" && (
                    <button onClick={() => void download(job)}>
                      Download verified export
                    </button>
                  )}
                  {["receiving", "pending", "processing"].includes(
                    job.state,
                  ) && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void action({ action: "cancel", id: job.id })
                      }
                    >
                      Cancel export
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </article>
        </div>
      </div>
    </section>
  );
}
