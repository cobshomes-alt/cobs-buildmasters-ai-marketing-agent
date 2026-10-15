"use client";
import { useState } from "react";
import type { Asset } from "./media-library";
export const PREVIEW_PLATFORMS = [
  "Instagram Feed",
  "Instagram Reels",
  "Instagram Stories",
  "Facebook Feed",
  "Facebook Reels",
  "TikTok",
  "YouTube Shorts",
  "YouTube standard video",
  "X",
  "Snapchat",
  "Google Business Profile",
] as const;
export default function SocialPostPreview({
  body,
  title,
  asset,
}: {
  body: string;
  title: string;
  asset?: Asset;
}) {
  const [platform, setPlatform] = useState<string>("Instagram Feed");
  const [open, setOpen] = useState(false);
  const vertical = /Reels|Stories|TikTok|Shorts|Snapchat/.test(platform);
  const ratio = vertical
    ? "9/16"
    : platform === "YouTube standard video" || platform === "X"
      ? "16/9"
      : platform === "Google Business Profile"
        ? "4/3"
        : platform === "Facebook Feed"
          ? "4/5"
          : "1/1";
  return (
    <details
      className="social-preview"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Preview social post</summary>
      {open && (
        <>
          <p className="badge">
            Layout simulation · Unpublished · No connected account implied
          </p>
          <label>
            Preview platform
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              {PREVIEW_PLATFORMS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <article
            className={`social-device ${vertical ? "social-device--vertical" : ""}`}
          >
            <header>
              <img
                src="/branding/cobs-buildmasters-logo.jpeg"
                width={48}
                height={48}
                alt="COBS logo"
              />
              <div>
                <strong>COBS BUILDMASTERS LTD</strong>
                <small>{platform} · Draft preview</small>
              </div>
            </header>
            <h3>{title}</h3>
            {asset?.url ? (
              asset.mime_type.startsWith("video/") ? (
                <video
                  controls
                  preload="metadata"
                  src={asset.url}
                  style={{ aspectRatio: ratio }}
                />
              ) : (
                <img
                  loading="lazy"
                  src={asset.url}
                  alt={asset.original_name}
                  style={{ aspectRatio: ratio }}
                />
              )
            ) : (
              <p>No media attached.</p>
            )}
            <p className="social-caption">{body}</p>
          </article>
          <p className="muted">
            Caption and any call to action above are the saved draft text. This
            does not validate platform limits or connect an account. No
            engagement metrics are simulated.
          </p>
        </>
      )}
    </details>
  );
}
