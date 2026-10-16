"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sequenceSnapshot } from "../../lib/sequence-model.mjs";
import type { TimelineDocument } from "../../lib/timeline";
import type { RenderJob } from "../../lib/render-worker.mjs";

export default function SequenceExport({
  client,
  document: doc,
  onBusy,
}: {
  client: SupabaseClient;
  document: TimelineDocument;
  onBusy: (value: boolean) => void;
}) {
  const [jobs, setJobs] = useState<RenderJob[]>([]),
    [ready, setReady] = useState(false),
    [captionsReady, setCaptionsReady] = useState(false),
    [constructionReady, setConstructionReady] = useState(false),
    [cinematicReady, setCinematicReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  const [preview, setPreview] = useState("");
  const previewUrl = useRef("");
  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );
  useEffect(() => {
    setMessage("");
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = "";
    setPreview("");
  }, [doc]);
  const api = useCallback(
    async (path: string, payload?: unknown) => {
      const { data } = await client.auth.getSession();
      const response = await fetch(path, {
        method: payload ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${data.session?.access_token || ""}`,
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export request failed.");
      }
      return response;
    },
    [client],
  );
  const poll = useCallback(async () => {
    try {
      const result = await (await api("/api/studio")).json();
      return {
        ready:
          result.ready === true &&
          result.workerOnline === true &&
          result.sequenceReady === true,
        jobs: result.jobs as RenderJob[],
        captionsReady: result.timedCaptionsReady === true,
        constructionReady: result.constructionReady === true,
        cinematicReady: result.cinematicReady === true,
      };
    } catch {
      return {
        ready: false,
        captionsReady: false,
        constructionReady: false,
        cinematicReady: false,
        jobs: [] as RenderJob[],
      };
    }
  }, [api]);
  useEffect(() => {
    let live = true;
    const refresh = async () => {
      const result = await poll();
      if (live) {
        setReady(result.ready);
        setCaptionsReady(result.captionsReady);
        setCinematicReady(result.cinematicReady);
        setConstructionReady(result.constructionReady);
        setJobs(result.jobs);
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [poll]);
  let invalid = "";
  const needsConstruction = doc.clips.some(
    (c) =>
      c.effects?.grade ||
      c.effects?.speed !== undefined ||
      c.effects?.logoEnding !== undefined,
  );
  const needsCaptions = doc.clips.some((c) => c.recipe.captions?.length);
  const needsCinematic =
    doc.clips.some((c) => c.effects || c.transition) ||
    !!doc.audioTracks?.length;
  try {
    sequenceSnapshot(doc.clips, doc.audioTracks);
  } catch (e) {
    invalid = e instanceof Error ? e.message : "Invalid timeline.";
  }
  async function perform(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export failed.");
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section
      className="glass-panel export-boundary"
      aria-label="Combined video export"
    >
      <h3>Export your sequence</h3>
      <p>
        MP4 with supported transitions, motion, layered visuals and audio. Up to
        12 clips, 6 originals, 60 seconds and 50 MiB of source files.
      </p>
      <p className="muted">
        Exports capture the current timeline; they do not save your project or
        approve content. Downloads expire after 24 hours.
      </p>
      <button
        className="gold-button"
        disabled={
          busy ||
          !ready ||
          Boolean(invalid) ||
          (needsCaptions && !captionsReady) ||
          (needsCinematic && !cinematicReady) ||
          (needsConstruction && !constructionReady)
        }
        aria-describedby="sequence-export-help"
        onClick={() =>
          void perform(async () => {
            const result = await (
              await api("/api/studio/sequence", doc)
            ).json();
            setMessage(
              result.duplicate
                ? "This snapshot already has an export job."
                : "Export queued. Keep the local worker running.",
            );
            const next = await poll();
            setJobs(next.jobs);
          })
        }
      >
        Export combined MP4
      </button>
      <p id="sequence-export-help" className="muted">
        {invalid ||
          (!ready
            ? "Local render worker unavailable. See Settings."
            : needsCaptions && !captionsReady
              ? "Start the updated worker for timed captions."
              : needsConstruction && !constructionReady
                ? "Start the version 5 worker for construction grading, speed and logo endings."
                : needsCinematic && !cinematicReady
                  ? "Start the version 4 worker for cinematic effects and separate audio."
                  : "Ready to render locally; no AI credits used.")}
      </p>
      {message && <p role="status">{message}</p>}
      {preview && (
        <section
          className="finished-preview"
          aria-label="Finished video preview"
        >
          <h4>Finished export preview</h4>
          <video
            src={preview}
            controls
            playsInline
            onError={() =>
              setMessage(
                "This export could not be played. Download it to inspect it, or retry the export.",
              )
            }
          />
          <button
            onClick={() => {
              URL.revokeObjectURL(previewUrl.current);
              previewUrl.current = "";
              setPreview("");
            }}
          >
            Close finished preview
          </button>
        </section>
      )}
      <details open={jobs.some((j) => j.state === "completed")}>
        <summary>Private export jobs ({jobs.length})</summary>
        {jobs.map((job) => (
          <article key={job.id}>
            <p>
              <strong>{job.kind === "video" ? "MP4" : "PNG"}</strong> ·{" "}
              {job.state} · {new Date(job.created).toLocaleString()}
            </p>
            {job.error && <p>{job.error}</p>}
            {job.state === "completed" && job.kind === "video" && (
              <>
                {" "}
                <button
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      const blob = await (
                        await api(
                          `/api/studio?download=${encodeURIComponent(job.id)}`,
                        )
                      ).blob();
                      if (previewUrl.current)
                        URL.revokeObjectURL(previewUrl.current);
                      previewUrl.current = URL.createObjectURL(blob);
                      setPreview(previewUrl.current);
                    })
                  }
                >
                  Preview finished MP4
                </button>
              </>
            )}
            {job.state === "completed" && (
              <button
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    const blob = await (
                        await api(
                          `/api/studio?download=${encodeURIComponent(job.id)}`,
                        )
                      ).blob(),
                      url = URL.createObjectURL(blob),
                      a = document.createElement("a");
                    a.href = url;
                    a.download = `cobs-export-${job.id}.${job.kind === "video" ? "mp4" : "png"}`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  })
                }
              >
                Download {job.kind === "video" ? "MP4" : "PNG"}
              </button>
            )}
            {["receiving", "pending", "processing"].includes(job.state) && (
              <button
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await api("/api/studio", { action: "cancel", id: job.id });
                    const next = await poll();
                    setJobs(next.jobs);
                    setMessage("Cancellation requested.");
                  })
                }
              >
                Cancel export
              </button>
            )}
          </article>
        ))}
      </details>
    </section>
  );
}
