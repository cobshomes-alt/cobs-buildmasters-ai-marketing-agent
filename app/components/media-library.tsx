"use client";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateMedia } from "../../lib/media";

export type Asset = {
  id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  project: string;
  product: string;
  campaign_id: string | null;
  deletion_pending?: boolean;
  url?: string;
};
type Props = {
  client: SupabaseClient;
  assets: Asset[];
  campaigns: { id: string; name: string }[];
  refresh: () => Promise<void>;
  notify: (text: string) => void;
};
export default function MediaLibrary({
  client,
  assets,
  campaigns,
  refresh,
  notify,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [project, setProject] = useState("");
  const [product, setProduct] = useState("");
  const [campaign, setCampaign] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState(0);
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
    if (!response.ok)
      throw new Error(result.error || "Media operation failed.");
    return result;
  }
  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    const invalid = validateMedia(file.name, file.type, file.size);
    if (invalid) {
      notify(invalid);
      return;
    }
    setBusy(true);
    let path: string | undefined;
    let registered = false;
    try {
      notify("Uploading original media. Keep this page open…");
      const prepared = await api({
        action: "prepare",
        name: file.name,
        type: file.type,
        size: file.size,
      });
      path = prepared.path;
      const result = await client.storage
        .from("cobs-media")
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: file.type,
        });
      if (result.error) throw result.error;
      await api({
        action: "complete",
        path,
        name: file.name,
        type: file.type,
        size: file.size,
        project,
        product,
        campaign_id: campaign,
      });
      registered = true;
      setFile(null);
      setFileKey((value) => value + 1);
      await refresh();
      notify("Original media saved to your private library.");
    } catch (error) {
      let message = error instanceof Error ? error.message : "Upload failed.";
      if (path && !registered) {
        try {
          await api({ action: "discard", path });
        } catch {
          message += ` Cleanup could not be confirmed for ${path}. Refresh the library before retrying; a saved record may already exist.`;
        }
      }
      notify(message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(asset: Asset) {
    if (
      !window.confirm(
        `Remove ${asset.original_name}? Attached media must first be removed from its drafts.`,
      )
    )
      return;
    setBusy(true);
    try {
      const response = await client
        .from("cobs_posts")
        .select("id")
        .eq("media_id", asset.id)
        .limit(1);
      if (response.error) throw response.error;
      if (response.data.length)
        throw new Error(
          "This media is attached to content. Edit that content to remove or replace the attachment first. Its approval will reset.",
        );
      const reserved = await client
        .from("cobs_media_assets")
        .update({ deletion_pending: true })
        .eq("id", asset.id)
        .select("id")
        .single();
      if (reserved.error)
        throw new Error(
          "Media could not be reserved for removal. It may have been attached on another device. Refresh and retry.",
        );
      const removed = await client.storage
        .from("cobs-media")
        .remove([asset.storage_path]);
      if (removed.error) throw removed.error;
      const deleted = await client
        .from("cobs_media_assets")
        .delete()
        .eq("id", asset.id);
      if (deleted.error)
        throw new Error(
          "Storage object removed but library record remains. Contact the administrator to reconcile this record.",
        );
      await refresh();
      notify("Media removed from storage and library.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Media removal failed.");
    } finally {
      setBusy(false);
    }
  }
  async function organise(asset: Asset) {
    setBusy(true);
    const result = await client
      .from("cobs_media_assets")
      .update({ project, product, campaign_id: campaign || null })
      .eq("id", asset.id);
    if (result.error)
      notify("Organisation could not be saved: " + result.error.message);
    else {
      await refresh();
      notify("Project, product and campaign labels updated.");
    }
    setBusy(false);
  }
  const visible = assets.filter((asset) =>
    [
      asset.original_name,
      asset.project,
      asset.product,
      campaigns.find((c) => c.id === asset.campaign_id)?.name || "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <article className="surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR ORIGINALS, ORGANISED</p>
            <h2>Project media library</h2>
          </div>
          <span className="badge">{assets.length} assets</span>
        </div>
        <p>
          Construction progress, factory production and property development.
          Private originals, up to 50 MB each.
        </p>
        <form onSubmit={upload}>
          <div className="form-grid">
            <label>
              Original photo or video
              <input
                key={fileKey}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <label>
              Project
              <input
                maxLength={120}
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="e.g. Adenta development"
              />
            </label>
            <label>
              Product
              <input
                maxLength={120}
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="e.g. Concrete blocks"
              />
            </label>
            <label>
              Campaign
              <select
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
              >
                <option value="">Unassigned</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button disabled={busy || !file}>
            {busy ? "Working…" : "Upload to private library"}
          </button>
        </form>
        <p className="muted">
          To replace media, upload the new original and select it when editing
          the post. The post returns to Draft for a fresh approval.
        </p>
      </article>
      <article className="surface">
        <label>
          Find media
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search filename, project, product or campaign"
          />
        </label>
        {visible.length === 0 ? (
          <div className="empty-state">
            <h3>No media found</h3>
            <p>Upload your first original or try another search.</p>
          </div>
        ) : (
          <div className="media-grid">
            {visible.map((asset) => (
              <article className="media-card" key={asset.id}>
                {asset.url ? (
                  asset.mime_type.startsWith("video/") ? (
                    <video
                      controls
                      preload="metadata"
                      src={asset.url}
                      aria-label={asset.original_name}
                    />
                  ) : (
                    <img
                      loading="lazy"
                      src={asset.url}
                      alt={asset.original_name}
                    />
                  )
                ) : (
                  <div className="empty-state">
                    Preview unavailable. Refresh to retry.
                  </div>
                )}
                <div className="media-details">
                  <h3>{asset.original_name}</h3>
                  {asset.url && (
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open original ↗
                    </a>
                  )}
                  <p>
                    {asset.project || "No project"} ·{" "}
                    {asset.product || "No product"}
                  </p>
                  <p className="muted">
                    {(asset.size_bytes / 1024 / 1024).toFixed(1)} MB ·{" "}
                    {campaigns.find((c) => c.id === asset.campaign_id)?.name ||
                      "Unassigned"}
                  </p>
                  <div className="actions">
                    <button
                      disabled={busy}
                      type="button"
                      onClick={() => void organise(asset)}
                    >
                      Apply labels above
                    </button>
                    <button
                      disabled={busy}
                      className="danger"
                      type="button"
                      onClick={() => void remove(asset)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </article>
    </>
  );
}
