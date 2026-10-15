"use client";
import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Asset } from "./media-library";
import { validateMedia } from "../../lib/media";
type Item = {
  key: string;
  file: File;
  phase: "queued" | "uploading" | "registering" | "saved" | "failed";
  error?: string;
  path?: string;
  uploaded?: boolean;
};
export default function BatchUpload({
  client,
  onUploaded,
  project = "",
  campaignId = "",
  onBusy,
}: {
  client: SupabaseClient;
  onUploaded: (assets: Asset[]) => void;
  project?: string;
  campaignId?: string;
  onBusy?: (busy: boolean) => void;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const pending = useRef<Item[]>([]),
    lock = useRef(false),
    stop = useRef(false);
  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );
  useEffect(() => onBusy?.(busy), [busy, onBusy]);
  useEffect(() => {
    if (!busy) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const leave = (e: MouseEvent) => {
      const target =
        e.target instanceof Element ? e.target.closest("button") : null;
      if (
        target &&
        (target.closest('nav[aria-label="Workspace sections"]') ||
          target.closest('nav[aria-label="Editor modes"]') ||
          ["Refresh", "Sign out"].includes(target.textContent?.trim() || ""))
      ) {
        e.preventDefault();
        e.stopPropagation();
        setNotice(
          "Pause the batch and wait for the active file before leaving.",
        );
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [busy]);
  function update(item: Item, patch: Partial<Item>) {
    Object.assign(item, patch);
    setItems([...pending.current]);
  }
  function choose(files: FileList | File[]) {
    if (lock.current) return;
    const next = [...pending.current];
    let duplicate = 0;
    for (const file of Array.from(files)) {
      const key = JSON.stringify([
        file.name,
        file.size,
        file.type,
        file.lastModified,
      ]);
      if (next.some((i) => i.key === key)) {
        duplicate++;
        continue;
      }
      const error = validateMedia(file.name, file.type, file.size);
      next.push({
        key,
        file,
        phase: error ? "failed" : "queued",
        error: error || undefined,
      });
    }
    if (
      next.length > 40 ||
      next.reduce((sum, i) => sum + i.file.size, 0) > 500 * 1024 * 1024
    ) {
      setNotice(
        "Select at most 40 files and 500 MB total per batch; each original is limited to 50 MB.",
      );
      return;
    }
    pending.current = next;
    setItems(next);
    setNotice(
      duplicate
        ? `${duplicate} repeated selections skipped (filename, size, type and modified time; not a content hash).`
        : "Originals upload sequentially. Completed files are never re-uploaded by Retry.",
    );
  }
  async function api(payload: object) {
    const { data } = await client.auth.getSession();
    const response = await fetch("/api/media", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token || ""}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Media request failed.");
    return result;
  }
  async function run() {
    if (lock.current) return;
    lock.current = true;
    stop.current = false;
    setBusy(true);
    const saved: Asset[] = [];
    try {
      for (const item of pending.current) {
        if (stop.current) break;
        if (
          item.phase === "saved" ||
          validateMedia(item.file.name, item.file.type, item.file.size)
        )
          continue;
        try {
          if (item.path) {
            const existing = await client
              .from("cobs_media_assets")
              .select("*")
              .eq("storage_path", item.path)
              .maybeSingle();
            if (existing.error)
              throw new Error(
                "Could not reconcile the previous upload. Retry after connectivity is restored.",
              );
            if (existing.data) {
              saved.push(existing.data);
              update(item, { phase: "saved", error: undefined });
              continue;
            }
          }
          if (!item.uploaded) {
            update(item, { phase: "uploading", error: undefined });
            if (!item.path) {
              const prepared = await api({
                action: "prepare",
                name: item.file.name,
                type: item.file.type,
                size: item.file.size,
              });
              item.path = prepared.path;
              const result = await client.storage
                .from("cobs-media")
                .uploadToSignedUrl(prepared.path, prepared.token, item.file, {
                  contentType: item.file.type,
                });
              if (result.error)
                throw new Error(
                  "Transfer was not confirmed. Retry will inspect this same private object before sending anything again.",
                );
            } else {
              const info = await client.storage
                .from("cobs-media")
                .info(item.path);
              if (
                info.error ||
                Number(info.data?.size) !== item.file.size ||
                info.data?.contentType !== item.file.type
              )
                throw new Error(
                  `Transfer remains uncertain for ${item.path}. No duplicate object was created. Use administrator recovery before starting a new upload.`,
                );
            }
            item.uploaded = true;
          }
          update(item, { phase: "registering" });
          const result = await api({
            action: "complete",
            path: item.path,
            name: item.file.name,
            type: item.file.type,
            size: item.file.size,
            project,
            product: "",
            campaign_id: campaignId,
          });
          saved.push(result.asset);
          update(item, { phase: "saved" });
        } catch (e) {
          update(item, {
            phase: "failed",
            error: e instanceof Error ? e.message : "Upload failed.",
          });
        }
      }
      const previews = await Promise.all(
        saved.map(async (asset) => {
          try {
            const signed = await client.storage
              .from("cobs-media")
              .createSignedUrl(asset.storage_path, 3600);
            return { ...asset, url: signed.data?.signedUrl };
          } catch {
            return asset;
          }
        }),
      );
      if (previews.length) onUploaded(previews);
      setNotice(
        stop.current
          ? "Batch paused after the current file. Saved originals remain intact."
          : "Batch finished. Review any failed files; no objects are automatically deleted.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const completed = items.filter((i) => i.phase === "saved").length;
  return (
    <section
      className="batch-upload"
      aria-label="Multiple original uploads"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        choose(e.dataTransfer.files);
      }}
    >
      <label className="upload-drop">
        Drop your original photos &amp; videos here
        <input
          type="file"
          multiple
          disabled={busy}
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          onChange={(e) => {
            if (e.target.files) choose(e.target.files);
            e.target.value = "";
          }}
        />
        <span>Choose multiple files · JPEG / PNG / WebP / MP4 / MOV</span>
      </label>
      <p className="muted">
        Private originals · 50 MB each · Sequential transfer · No automatic
        deletion
      </p>
      {items.length > 0 && (
        <>
          <progress
            aria-label="Files saved"
            value={completed}
            max={items.length}
          />
          <p>
            {completed} / {items.length} originals saved (file count, not byte
            progress)
          </p>
          <ol className="batch-files">
            {items.map((i) => (
              <li key={i.key}>
                <strong>{i.file.name}</strong>
                <small>
                  {i.file.type || "Unknown type"} ·{" "}
                  {(i.file.size / 1024 / 1024).toFixed(2)} MB · {i.phase}
                </small>
                {i.error && <p role="alert">{i.error}</p>}
              </li>
            ))}
          </ol>
          <div className="actions">
            <button
              disabled={
                busy ||
                items.every(
                  (i) =>
                    i.phase === "saved" ||
                    !!validateMedia(i.file.name, i.file.type, i.file.size),
                )
              }
              onClick={() => void run()}
            >
              Upload / retry unsaved files
            </button>
            <button
              disabled={!busy}
              onClick={() => {
                stop.current = true;
                setNotice(
                  "Pausing after the active file completes; no partial originals are deleted.",
                );
              }}
            >
              Pause after current file
            </button>
            <button
              disabled={busy}
              onClick={() => {
                pending.current = pending.current.filter(
                  (i) => i.phase !== "saved",
                );
                setItems([...pending.current]);
              }}
            >
              Clear saved items from list
            </button>
          </div>
        </>
      )}
      <p role="status">{notice}</p>
    </section>
  );
}
