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
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const lock = useRef(false);
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
      };
    } catch {
      return { ready: false, captionsReady: false, jobs: [] as RenderJob[] };
    }
  }, [api]);
  useEffect(() => {
    let live = true;
    const refresh = async () => {
      const result = await poll();
      if (live) {
        setReady(result.ready);
        setCaptionsReady(result.captionsReady);
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
  const needsCaptions = doc.clips.some((c) => c.recipe.captions?.length);
  try {
    sequenceSnapshot(doc.clips);
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
        MP4 with hard cuts, clip edits and original audio. Up to 12 clips, 6
        originals, 60 seconds and 50 MiB of source files.
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
          (needsCaptions && !captionsReady)
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
              : "Ready to render locally; no AI credits used.")}
      </p>
      {message && <p role="status">{message}</p>}
      <details>
        <summary>Private export jobs ({jobs.length})</summary>
        {jobs.map((job) => (
          <article key={job.id}>
            <p>
              <strong>{job.kind === "video" ? "MP4" : "PNG"}</strong> ·{" "}
              {job.state} · {new Date(job.created).toLocaleString()}
            </p>
            {job.error && <p>{job.error}</p>}
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
