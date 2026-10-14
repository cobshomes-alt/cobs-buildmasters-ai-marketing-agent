import type { Asset } from "./media-library";

export default function PostAttachment({ asset }: { asset?: Asset }) {
  if (!asset) return null;
  return (
    <figure className="post-attachment">
      {asset.url ? (
        asset.mime_type.startsWith("video/") ? (
          <video
            src={asset.url}
            controls
            preload="metadata"
            aria-label={asset.original_name}
          />
        ) : (
          <img src={asset.url} alt={asset.original_name} loading="lazy" />
        )
      ) : (
        <p>
          Preview unavailable. Refresh the workspace to renew private media
          links.
        </p>
      )}
      <figcaption>{asset.original_name}</figcaption>
    </figure>
  );
}
