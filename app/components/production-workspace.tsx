"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Asset } from "./media-library";
import BatchUpload from "./batch-upload";
import SequenceExport from "./sequence-export";
import TimedCaptions from "./timed-captions";
import AutomaticEditingDirector from "./automatic-editing-director";
import {
  clipAt,
  moveClip,
  newClip,
  newTimeline,
  splitClip,
  timelineDuration,
  validateTimeline,
  type TimelineDocument,
} from "../../lib/timeline";
import {
  DIMENSIONS,
  validateRecipe,
  type Recipe,
} from "../../lib/studio-model.mjs";
export default function ProductionWorkspace({
  client,
  assets,
  campaigns,
  onAssets,
  onDirty,
}: {
  client: SupabaseClient;
  assets: Asset[];
  campaigns: { id: string; name: string }[];
  onAssets: (a: Asset[]) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [doc, setDoc] = useState<TimelineDocument>(newTimeline),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState(""),
    [past, setPast] = useState<TimelineDocument[]>([]),
    [future, setFuture] = useState<TimelineDocument[]>([]),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [cloud, setCloud] = useState(false),
    [library, setLibrary] = useState<{ id: string; title: string }[]>([]),
    [filter, setFilter] = useState(""),
    [folder, setFolder] = useState("all"),
    [assetPage, setAssetPage] = useState(0),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [zoom, setZoom] = useState(16),
    [uploading, setUploading] = useState(false),
    [exporting, setExporting] = useState(false),
    [planning, setPlanning] = useState(false);
  const frame = useRef<HTMLDivElement>(null),
    player = useRef<HTMLVideoElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    lock = useRef(false);
  const duration = timelineDuration(doc),
    current = clipAt(doc, time),
    clip = doc.clips.find((c) => c.id === selected),
    asset = current && assets.find((a) => a.id === current.clip.mediaId);
  const request = useCallback(
    async (payload?: object) => {
      const { data } = await client.auth.getSession();
      const result = await fetch("/api/edit-projects", {
        method: payload ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${data.session?.access_token || ""}`,
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      });
      const json = await result.json();
      if (!result.ok) throw new Error(json.error || "Project request failed.");
      return json;
    },
    [client],
  );
  useEffect(() => {
    let mounted = true;
    request()
      .then((result) => {
        if (mounted) {
          setCloud(true);
          setLibrary(result.projects);
        }
      })
      .catch((e) => {
        if (mounted) setMessage(e.message);
      });
    return () => {
      mounted = false;
    };
  }, [request]);
  useEffect(
    () => onDirty(dirty || busy || uploading || exporting || planning),
    [dirty, busy, uploading, exporting, planning, onDirty],
  );
  useEffect(() => {
    if (!dirty && !busy && !uploading && !exporting && !planning) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const leave = (e: MouseEvent) => {
      const b = e.target instanceof Element ? e.target.closest("button") : null;
      if (
        b &&
        ((b.closest('nav[aria-label="Workspace sections"]') &&
          b.textContent?.trim() !== "Media Studio") ||
          ["Refresh", "Sign out"].includes(b.textContent?.trim() || "")) &&
        (busy ||
          uploading ||
          exporting ||
          planning ||
          !window.confirm(
            "Leave the production workspace? Unsaved timeline changes will be lost.",
          ))
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
  }, [dirty, busy, uploading, exporting, planning]);
  useEffect(() => {
    if (!playing) return;
    let id = 0,
      previous = 0;
    const started = performance.now(),
      initial = time;
    const animate = (now: number) => {
      const next = initial + (now - started) / 1000;
      if (next >= duration) {
        setTime(duration);
        setPlaying(false);
        return;
      }
      if (now - previous >= 50) {
        setTime(next);
        previous = now;
      }
      id = requestAnimationFrame(animate);
    };
    id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [playing, duration]); // time deliberately captured at playback start
  useEffect(() => {
    const video = player.current;
    if (!video || !current) return;
    const sourceTime = current.clip.recipe.start + current.offset;
    if (Math.abs(video.currentTime - sourceTime) > 0.35)
      video.currentTime = sourceTime;
    video.volume = Math.min(1, current.clip.recipe.volume);
    if (playing && video.paused)
      void video.play().catch(() => {
        setPlaying(false);
        setMessage(
          "Preview playback was blocked or this original is unavailable. Use the native media control or refresh signed media access.",
        );
      });
    else if (!playing) video.pause();
  }, [time, playing, current?.clip.id]);
  function edit(next: TimelineDocument, allowCaptionDraft = false) {
    if (lock.current) return;
    const error = validateTimeline(next);
    if (error && !allowCaptionDraft) {
      setMessage(error);
      return;
    }
    setPast((p) => [...p.slice(-39), doc]);
    setFuture([]);
    setDoc(next);
    setDirty(true);
    setPlaying(false);
    setTime((t) => Math.min(t, timelineDuration(next)));
  }
  function properties(patch: Partial<Recipe>) {
    if (!clip) return;
    edit(
      {
        ...doc,
        clips: doc.clips.map((c) =>
          c.id === clip.id ? { ...c, recipe: { ...c.recipe, ...patch } } : c,
        ),
      },
      patch.captions !== undefined,
    );
  }
  function add(a: Asset) {
    if (a.deletion_pending) return;
    const next = newClip(a);
    next.recipe.aspect = doc.aspect;
    edit({ ...doc, clips: [...doc.clips, next] });
    setSelected(next.id);
  }
  function history(direction: "undo" | "redo") {
    if (lock.current) return;
    const source = direction === "undo" ? past : future,
      next = source.at(-1);
    if (!next) return;
    if (direction === "undo") {
      setPast(source.slice(0, -1));
      setFuture((f) => [...f, doc]);
    } else {
      setFuture(source.slice(0, -1));
      setPast((p) => [...p, doc]);
    }
    setDoc(next);
    setDirty(true);
    setPlaying(false);
    setTime(0);
  }
  async function save() {
    if (lock.current) return;
    const invalid = validateTimeline(doc);
    if (invalid) {
      setMessage(invalid);
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const result = await request({ action: "save", document: doc, revision });
      setRevision(result.project.revision);
      setDirty(false);
      setLibrary((l) => [
        { id: doc.id, title: doc.title },
        ...l.filter((p) => p.id !== doc.id),
      ]);
      setMessage(
        `Production saved to Supabase · revision ${result.project.revision}. Original files unchanged.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function open(id: string) {
    if (
      lock.current ||
      !id ||
      (dirty &&
        !window.confirm(
          "Discard unsaved timeline edits and open this saved production?",
        ))
    )
      return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await request({ action: "open", id });
      if (validateTimeline(result.document))
        throw new Error("Unsupported project.");
      setDoc(result.document);
      setRevision(result.revision);
      setSelected(result.document.clips[0]?.id || "");
      setDirty(false);
      setPast([]);
      setFuture([]);
      setTime(0);
      setPlaying(false);
      setMessage("Complete timeline reopened from Supabase.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Open failed.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const folders = [...new Set(assets.map((a) => a.project).filter(Boolean))];
  const visible = assets.filter(
    (a) =>
      !a.deletion_pending &&
      (folder === "all" ||
        (folder === "project" && doc.clips.some((c) => c.mediaId === a.id)) ||
        a.project === folder) &&
      a.original_name.toLowerCase().includes(filter.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(visible.length / 12)),
    page = Math.min(assetPage, pages - 1),
    [w, h] = DIMENSIONS[doc.aspect];
  return (
    <section
      className="production-workspace"
      aria-label="Multi-asset production workspace"
    >
      <header className="production-topbar">
        <div>
          <span className="eyebrow">COBS / PRODUCTION SUITE</span>
          <h2>Shape the story.</h2>
          <p>Real originals. One considered production.</p>
        </div>
        <div className="production-status">
          <span className="live-dot" />
          Manual timeline ·{" "}
          {dirty
            ? "Unsaved edits"
            : revision
              ? `Saved v${revision}`
              : "New production"}
          <button
            onClick={() => void save()}
            disabled={busy || !cloud || Boolean(validateTimeline(doc))}
          >
            {busy ? "Saving…" : "Save production"}
          </button>
          <button
            disabled={busy || uploading}
            onClick={() => {
              if (
                dirty &&
                !window.confirm(
                  "Discard unsaved edits and start a new production?",
                )
              )
                return;
              setDoc(newTimeline());
              setRevision(0);
              setPast([]);
              setFuture([]);
              setSelected("");
              setTime(0);
              setPlaying(false);
              setDirty(false);
              setMessage(
                "New unsaved production. Existing projects and originals are preserved.",
              );
            }}
          >
            New production
          </button>
        </div>
      </header>
      {message && (
        <div className="production-notice" role="status">
          {message}
        </div>
      )}
      {!cloud && (
        <p className="schema-pending">
          Project saving is unavailable. Timeline changes remain unsaved. Use
          Photo &amp; single-source exports for available downloads.
        </p>
      )}
      <AutomaticEditingDirector
        client={client}
        assets={assets}
        disabled={busy || uploading || exporting}
        onBusy={setPlanning}
        onApply={(proposed) => {
          if (lock.current || busy || uploading || exporting) return;
          if (
            doc.clips.length &&
            !window.confirm(
              "Replace the current timeline with this unsaved proposal? Existing saved projects and originals remain unchanged. Undo restores your current timeline.",
            )
          )
            return;
          edit({ ...proposed, campaignId: doc.campaignId });
          setRevision(0);
          setSelected(proposed.clips[0]?.id || "");
          setTime(0);
          setMessage(
            "Rule-based plan applied as unsaved edits. Review every scene before exporting; publication still requires owner approval.",
          );
        }}
      />
      <div className="production-grid">
        <aside className="production-assets glass-panel">
          <div className="panel-heading">
            <h3>Media &amp; assets</h3>
            <span>{assets.length} originals</span>
          </div>
          <button
            className="gold-button"
            onClick={() => dialog.current?.showModal()}
          >
            ＋ Import originals
          </button>
          <label>
            Find original
            <input
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setAssetPage(0);
              }}
              placeholder="Search your private library"
            />
          </label>
          <label>
            Media collection
            <select
              value={folder}
              onChange={(e) => {
                setFolder(e.target.value);
                setAssetPage(0);
              }}
            >
              <option value="all">All originals</option>
              <option value="project">In this timeline</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <div className="production-asset-grid">
            {visible.slice(page * 12, page * 12 + 12).map((a) => (
              <button
                key={a.id}
                className="production-asset"
                onClick={() => add(a)}
                disabled={busy || doc.clips.length >= 40}
                aria-label={`Add ${a.original_name} to timeline`}
              >
                {a.url ? (
                  a.mime_type.startsWith("video/") ? (
                    <video src={a.url} preload="metadata" muted playsInline />
                  ) : (
                    <img loading="lazy" src={a.url} alt="" />
                  )
                ) : (
                  <span className="asset-placeholder">
                    {a.mime_type.startsWith("video/") ? "▶" : "▧"}
                  </span>
                )}
                <span>{a.original_name}</span>
                <small>
                  {a.mime_type.startsWith("video/") ? "VIDEO" : "PHOTO"} ·{" "}
                  {(a.size_bytes / 1024 / 1024).toFixed(1)} MB
                </small>
              </button>
            ))}
          </div>
          {!visible.length && (
            <div className="production-empty">
              <span>▧</span>
              <h3>Your story starts here</h3>
              <p>
                Import original photos and footage, or choose another
                collection. No sample company media is shown.
              </p>
            </div>
          )}
          {pages > 1 && (
            <nav className="actions" aria-label="Production asset pages">
              <button disabled={!page} onClick={() => setAssetPage(page - 1)}>
                Previous
              </button>
              <span>
                {page + 1}/{pages}
              </span>
              <button
                disabled={page === pages - 1}
                onClick={() => setAssetPage(page + 1)}
              >
                Next
              </button>
            </nav>
          )}
          <div className="brand-asset">
            <img
              src="/branding/cobs-buildmasters-logo.jpeg"
              alt="Original COBS logo"
            />
            <div>
              <strong>Company identity</strong>
              <small>Original logo · watermark toggle per clip</small>
            </div>
          </div>
          <p className="muted">
            Audio imports and editing templates arrive in a later milestone.
            Only working source types are selectable.
          </p>
        </aside>
        <main className="production-centre">
          <div className="glass-panel production-viewer">
            <div className="panel-heading">
              <h3>Sequence preview</h3>
              <span>
                {w} × {h} · {doc.aspect}
              </span>
            </div>
            <div
              className="production-frame"
              ref={frame}
              style={{
                aspectRatio: `${w}/${h}`,
                maxWidth: `${(420 * w) / h}px`,
              }}
            >
              {asset?.url && current ? (
                current.clip.kind === "video" ? (
                  <video
                    ref={player}
                    key={current.clip.id}
                    src={asset.url}
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={() => {
                      if (player.current)
                        player.current.currentTime =
                          current.clip.recipe.start + current.offset;
                    }}
                    style={{
                      objectFit: current.clip.recipe.fit,
                      objectPosition: `${current.clip.recipe.position * 100}% ${current.clip.recipe.position * 100}%`,
                      filter: `brightness(${1 + current.clip.recipe.brightness}) contrast(${current.clip.recipe.contrast}) saturate(${current.clip.recipe.saturation})`,
                    }}
                  />
                ) : (
                  <img
                    src={asset.url}
                    alt={asset.original_name}
                    style={{
                      objectFit: current.clip.recipe.fit,
                      objectPosition: `${current.clip.recipe.position * 100}% ${current.clip.recipe.position * 100}%`,
                      filter: `brightness(${1 + current.clip.recipe.brightness}) contrast(${current.clip.recipe.contrast}) saturate(${current.clip.recipe.saturation})`,
                    }}
                  />
                )
              ) : (
                <div className="viewer-empty">
                  <span>▷</span>
                  <h3>
                    {current
                      ? "Original preview unavailable"
                      : "Your production canvas"}
                  </h3>
                  <p>
                    {current
                      ? "Refresh private media access before previewing."
                      : "Add footage or a photograph from the media panel."}
                  </p>
                </div>
              )}
              {current?.clip.recipe.text && (
                <span className="edit-headline">
                  {current.clip.recipe.text}
                </span>
              )}
              {current?.clip.recipe.subtitle && (
                <span className="edit-subtitle">
                  {current.clip.recipe.subtitle}
                </span>
              )}
              {(current?.clip.recipe.captions || [])
                .filter(
                  (c) =>
                    current &&
                    current.offset >= c.start &&
                    current.offset < c.end,
                )
                .map((c, i) => (
                  <span
                    className="edit-subtitle"
                    key={i}
                    style={{
                      bottom: current
                        ? `${(180 / DIMENSIONS[current.clip.recipe.aspect][1]) * 100}%`
                        : undefined,
                    }}
                  >
                    {c.text}
                  </span>
                ))}
              {current?.clip.recipe.watermark && (
                <img
                  className="sequence-logo"
                  src="/branding/cobs-buildmasters-logo.jpeg"
                  alt="Original watermark"
                />
              )}
            </div>
            <div className="transport">
              <button
                disabled={!duration}
                onClick={() => {
                  if (time >= duration) setTime(0);
                  setPlaying((p) => !p);
                }}
                aria-label={playing ? "Pause sequence" : "Play sequence"}
              >
                {playing ? "Ⅱ" : "▶"}
              </button>
              <output>
                {time.toFixed(1)} / {duration.toFixed(1)}s
              </output>
              <input
                aria-label="Sequence playhead"
                type="range"
                min={0}
                max={Math.max(duration, 0.1)}
                step={0.1}
                value={time}
                onChange={(e) => {
                  setPlaying(false);
                  setTime(Number(e.target.value));
                }}
              />
              <button
                onClick={() =>
                  void frame.current
                    ?.requestFullscreen()
                    .catch(() =>
                      setMessage("Fullscreen is unavailable in this browser."),
                    )
                }
              >
                Fullscreen
              </button>
            </div>
            <p className="preview-disclaimer">
              Interactive hard-cut composition preview. Browser colour/text may
              differ from FFmpeg; audio fades are export-only. Multi-source
              export is not yet enabled.
            </p>
          </div>
          <section
            className="glass-panel production-timeline"
            aria-label="Editing timeline"
          >
            <div className="panel-heading">
              <div>
                <h3>Timeline</h3>
                <span>
                  {doc.clips.length}/40 clips · {duration.toFixed(1)}s ·
                  five-minute limit
                </span>
              </div>
              <div className="actions">
                <button
                  disabled={!past.length || busy}
                  onClick={() => history("undo")}
                >
                  Undo
                </button>
                <button
                  disabled={!future.length || busy}
                  onClick={() => history("redo")}
                >
                  Redo
                </button>
              </div>
            </div>
            <label className="timeline-zoom">
              Timeline zoom
              <input
                type="range"
                min={8}
                max={32}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
            <div className="timeline-scroll">
              <div
                className="timeline-track"
                style={{ minWidth: Math.max(500, duration * zoom) }}
              >
                <div className="timeline-ruler">
                  {Array.from(
                    { length: Math.ceil(duration / 5) + 1 },
                    (_, i) => (
                      <span key={i} style={{ left: i * 5 * zoom }}>
                        {i * 5}s
                      </span>
                    ),
                  )}
                </div>
                <div className="timeline-items">
                  {doc.clips.map((c, index) => (
                    <button
                      className={`timeline-item ${selected === c.id ? "is-selected" : ""}`}
                      key={c.id}
                      style={{ width: c.recipe.duration * zoom }}
                      onClick={() => {
                        setSelected(c.id);
                        setPlaying(false);
                        setTime(
                          doc.clips
                            .slice(0, index)
                            .reduce((s, c) => s + c.recipe.duration, 0),
                        );
                      }}
                      aria-label={`Select clip ${index + 1}: ${c.label}`}
                    >
                      <span>
                        {c.kind === "video" ? "▶" : "▧"} {index + 1}
                      </span>
                      <strong>{c.label}</strong>
                      <small>{c.recipe.duration.toFixed(1)}s · CUT</small>
                    </button>
                  ))}
                </div>
                <div
                  className="timeline-playhead"
                  style={{ left: time * zoom }}
                />
              </div>
            </div>
            {!doc.clips.length && (
              <p className="muted">
                Click an original above to add it. Removing a timeline item
                never deletes its original.
              </p>
            )}
            <div className="timeline-lanes">
              <span>
                TITLES{" "}
                <b>
                  {doc.clips.filter((c) => c.recipe.text).length} clip overlays
                </b>
              </span>
              <span>
                SUBTITLES <b>Static or timed captions per clip</b>
              </span>
              <span>
                AUDIO <b>Original clip audio; separate tracks pending</b>
              </span>
            </div>
          </section>
          <SequenceExport
            client={client}
            document={doc}
            onBusy={setExporting}
          />
        </main>
        <aside className="production-properties glass-panel">
          <h3>Production settings</h3>
          <fieldset disabled={busy}>
            <label>
              Production title
              <input
                maxLength={180}
                value={doc.title}
                onChange={(e) => edit({ ...doc, title: e.target.value })}
              />
            </label>
            <label>
              Saved production
              <select value="" onChange={(e) => void open(e.target.value)}>
                <option value="">Open a saved production</option>
                {library.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Production campaign
              <select
                value={doc.campaignId || ""}
                onChange={(e) =>
                  edit({ ...doc, campaignId: e.target.value || null })
                }
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
              Sequence aspect
              <select
                value={doc.aspect}
                onChange={(e) =>
                  edit({
                    ...doc,
                    aspect: e.target.value as Recipe["aspect"],
                    clips: doc.clips.map((c) => ({
                      ...c,
                      recipe: {
                        ...c.recipe,
                        aspect: e.target.value as Recipe["aspect"],
                      },
                    })),
                  })
                }
              >
                {Object.keys(DIMENSIONS).map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            {clip ? (
              <>
                <div className="panel-heading">
                  <h3>Selected clip</h3>
                  <span>{clip.kind.toUpperCase()}</span>
                </div>
                <p className="selected-name">{clip.label}</p>
                <label>
                  Replace selected media
                  <select
                    value={clip.mediaId}
                    onChange={(e) => {
                      const replacement = assets.find(
                        (a) => a.id === e.target.value && !a.deletion_pending,
                      );
                      if (!replacement) return;
                      edit({
                        ...doc,
                        clips: doc.clips.map((c) =>
                          c.id === clip.id
                            ? {
                                ...c,
                                mediaId: replacement.id,
                                kind: replacement.mime_type.startsWith("video/")
                                  ? "video"
                                  : "image",
                                label: replacement.original_name.slice(0, 200),
                                recipe: { ...c.recipe, start: 0 },
                              }
                            : c,
                        ),
                      });
                    }}
                  >
                    {assets
                      .filter((a) => !a.deletion_pending)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.original_name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="actions">
                  <button
                    disabled={doc.clips[0]?.id === clip.id}
                    onClick={() => edit(moveClip(doc, clip.id, -1))}
                  >
                    Move earlier
                  </button>
                  <button
                    disabled={doc.clips.at(-1)?.id === clip.id}
                    onClick={() => edit(moveClip(doc, clip.id, 1))}
                  >
                    Move later
                  </button>
                  <button
                    onClick={() => {
                      edit({
                        ...doc,
                        clips: doc.clips.filter((c) => c.id !== clip.id),
                      });
                      setSelected("");
                    }}
                  >
                    Remove clip
                  </button>
                </div>
                {clip.kind === "video" && (
                  <label>
                    Clip trim start
                    <input
                      type="number"
                      min={0}
                      max={570}
                      step={0.1}
                      value={clip.recipe.start}
                      onChange={(e) =>
                        properties({ start: Number(e.target.value) })
                      }
                    />
                  </label>
                )}
                <label>
                  Clip display duration
                  <input
                    type="number"
                    min={1}
                    max={30}
                    step={0.1}
                    value={clip.recipe.duration}
                    onChange={(e) =>
                      properties({
                        duration: Number(e.target.value),
                        fade: Math.min(
                          clip.recipe.fade,
                          Number(e.target.value) / 2,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  disabled={
                    clip.recipe.duration < 2 ||
                    Boolean(validateRecipe(clip.recipe))
                  }
                  onClick={() =>
                    edit(splitClip(doc, clip.id, clip.recipe.duration / 2))
                  }
                >
                  Split at midpoint
                </button>
                <label>
                  Clip fit
                  <select
                    value={clip.recipe.fit}
                    onChange={(e) =>
                      properties({ fit: e.target.value as Recipe["fit"] })
                    }
                  >
                    <option value="contain">Fit entire original</option>
                    <option value="cover">Fill / crop</option>
                  </select>
                </label>
                {(
                  [
                    "position",
                    "brightness",
                    "contrast",
                    "saturation",
                    ...(clip.kind === "video" ? ["volume"] : []),
                  ] as (keyof Recipe)[]
                ).map((key) => (
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
                            : key === "saturation"
                              ? 2
                              : key === "fade"
                                ? Math.min(3, clip.recipe.duration / 2)
                                : 1
                      }
                      step={0.05}
                      value={Number(clip.recipe[key])}
                      onChange={(e) =>
                        properties({ [key]: Number(e.target.value) })
                      }
                    />
                    <output>{Number(clip.recipe[key]).toFixed(2)}</output>
                  </label>
                ))}
                <label>
                  Clip title overlay
                  <input
                    maxLength={120}
                    value={clip.recipe.text}
                    onChange={(e) => properties({ text: e.target.value })}
                  />
                </label>
                <label>
                  Clip static subtitle
                  <input
                    maxLength={120}
                    value={clip.recipe.subtitle}
                    disabled={Boolean(clip.recipe.captions?.length)}
                    onChange={(e) => properties({ subtitle: e.target.value })}
                  />
                </label>
                <TimedCaptions recipe={clip.recipe} onChange={properties} />
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={clip.recipe.watermark}
                    onChange={(e) =>
                      properties({ watermark: e.target.checked })
                    }
                  />
                  Original COBS watermark
                </label>
                <p className="muted">
                  Hard cuts only in this milestone. Scale, rotation, white
                  balance, opacity and transition controls are pending rather
                  than decorative.
                </p>
              </>
            ) : (
              <div className="production-empty">
                <h3>Make it intentional</h3>
                <p>
                  Select a timeline clip to trim, arrange and refine its
                  composition.
                </p>
              </div>
            )}
          </fieldset>
        </aside>
      </div>
      <dialog
        className="import-dialog"
        aria-label="Import original media"
        ref={dialog}
        onCancel={(e) => {
          if (uploading) e.preventDefault();
        }}
      >
        <div className="panel-heading">
          <div>
            <span className="eyebrow">PRIVATE ORIGINALS</span>
            <h2>Bring your story in</h2>
          </div>
          <button disabled={uploading} onClick={() => dialog.current?.close()}>
            Close import
          </button>
        </div>
        <BatchUpload
          client={client}
          onUploaded={onAssets}
          project={doc.title}
          campaignId={doc.campaignId || ""}
          onBusy={setUploading}
        />
      </dialog>
    </section>
  );
}
