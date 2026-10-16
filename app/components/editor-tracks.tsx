"use client";
import type { TimelineDocument, TimelineClip } from "../../lib/timeline";
export type EditorTool =
  | "Media"
  | "Audio"
  | "Text"
  | "Captions"
  | "Effects"
  | "Transitions"
  | "Filters"
  | "Graphics"
  | "Templates";
export function TimelineTracks({
  doc,
  selected,
  zoom,
  time,
  onSelect,
  onReorder,
  onAdd,
}: {
  doc: TimelineDocument;
  selected: string;
  zoom: number;
  time: number;
  onSelect: (c: TimelineClip, t: number, tool?: EditorTool) => void;
  onReorder: (from: string, to: string) => void;
  onAdd: (id: string) => void;
}) {
  let cursor = 0;
  const starts = doc.clips.map((c) => {
    const s = cursor;
    cursor += c.recipe.duration - (c.transition?.duration || 0);
    return s;
  });
  const total = cursor;
  const row = (name: string, children: React.ReactNode) => (
    <div className="editor-track-row">
      <span className="track-label">{name}</span>
      <div
        className="editor-track-content"
        style={{ width: Math.max(560, total * zoom) }}
      >
        {children}
      </div>
    </div>
  );
  const overlay = (
    c: TimelineClip,
    i: number,
    tool: EditorTool,
    text: string,
    start = 0,
    end = c.recipe.duration,
  ) => (
    <button
      key={c.id + tool + start}
      className={`track-overlay overlay-${tool.toLowerCase()}`}
      style={{
        left: (starts[i] + start) * zoom,
        width: Math.max(12, (end - start) * zoom),
      }}
      onClick={() => onSelect(c, starts[i] + start, tool)}
      title={text}
      aria-label={`Edit ${tool.toLowerCase()} for ${c.label}`}
    >
      {text}
    </button>
  );
  return (
    <div className="editor-timeline-scroll">
      <div
        className="editor-tracks"
        style={{ minWidth: Math.max(650, total * zoom + 90) }}
      >
        {row(
          "Seconds",
          <div className="editor-ruler">
            {Array.from({ length: Math.ceil(total / 5) + 1 }, (_, i) => (
              <button
                key={i}
                style={{ left: i * 5 * zoom }}
                aria-label={`Seek to ${i * 5} seconds`}
                onClick={() => {
                  const c = doc.clips.find(
                    (c, j) => starts[j] + c.recipe.duration > i * 5,
                  );
                  if (c) onSelect(c, i * 5);
                }}
              >
                {i * 5}s
              </button>
            ))}
          </div>,
        )}
        {row(
          "Video / Photos",
          <div
            className="editor-primary-track"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("application/cobs-media");
              if (id) onAdd(id);
            }}
          >
            {doc.clips.map((c, i) => (
              <button
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/cobs-clip", c.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const id = e.dataTransfer.getData("application/cobs-clip");
                  if (id) onReorder(id, c.id);
                  else {
                    const media = e.dataTransfer.getData(
                      "application/cobs-media",
                    );
                    if (media) onAdd(media);
                  }
                }}
                className={`timeline-item ${selected === c.id ? "is-selected" : ""}`}
                key={c.id}
                style={{
                  width: c.recipe.duration * zoom,
                  marginLeft: i
                    ? -(doc.clips[i - 1].transition?.duration || 0) * zoom
                    : 0,
                }}
                onClick={() => onSelect(c, starts[i])}
                aria-label={`Select clip ${i + 1}: ${c.label}`}
              >
                <span>
                  {c.kind === "video" ? "▶" : "▧"} {i + 1}
                </span>
                <strong>{c.label}</strong>
                <small>
                  {c.recipe.duration.toFixed(1)}s ·{" "}
                  {(c.transition?.type || "cut").toUpperCase()}
                </small>
              </button>
            ))}
          </div>,
        )}
        {row(
          "Titles",
          doc.clips.map((c, i) =>
            c.recipe.text ? overlay(c, i, "Text", c.recipe.text) : null,
          ),
        )}
        {row(
          "Captions",
          doc.clips.flatMap((c, i) =>
            c.recipe.captions?.length
              ? c.recipe.captions.map((cue) =>
                  overlay(c, i, "Captions", cue.text, cue.start, cue.end),
                )
              : c.recipe.subtitle
                ? [overlay(c, i, "Captions", c.recipe.subtitle)]
                : [],
          ),
        )}
        {row(
          "Source volume",
          doc.clips.map((c, i) =>
            c.kind === "video" && c.recipe.volume > 0
              ? overlay(c, i, "Audio", "Volume enabled; requires source audio")
              : null,
          ),
        )}
        {(["music", "narration"] as const).map((kind) => (
          <div key={kind}>
            {row(
              kind === "music" ? "Music" : "Voice-over",
              doc.audioTracks
                ?.filter((t) => t.kind === kind)
                .map((t) => (
                  <button
                    key={t.id}
                    className="track-overlay overlay-audio"
                    style={{
                      left: t.offset * zoom,
                      width: Math.max(12, (total - t.offset) * zoom),
                    }}
                    onClick={() => {
                      if (doc.clips[0]) onSelect(doc.clips[0], time, "Audio");
                    }}
                    title={
                      t.loop
                        ? "Loops through the remaining timeline"
                        : "Available playback window; source audio may end sooner"
                    }
                    aria-label={`Edit ${kind} track`}
                  >
                    {kind} · level {t.volume.toFixed(1)}
                    {t.loop ? " · loop" : ""}
                  </button>
                )),
            )}
          </div>
        ))}
        {row(
          "Overlays",
          doc.clips.map((c, i) =>
            c.effects?.layer
              ? overlay(c, i, "Graphics", "Image / video overlay")
              : null,
          ),
        )}
        <div
          className="editor-track-playhead"
          style={{ left: 90 + time * zoom }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
