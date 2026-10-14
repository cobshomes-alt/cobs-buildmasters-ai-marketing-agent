export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
export const MEDIA_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
} as const;
export type MediaType = keyof typeof MEDIA_TYPES;
export function validateMedia(name: unknown, type: unknown, size: unknown) {
  if (typeof name !== "string" || !name.trim() || name.length > 200)
    return "Choose a file with a name of at most 200 characters.";
  if (typeof type !== "string" || !Object.hasOwn(MEDIA_TYPES, type))
    return "Use JPEG, PNG, WebP, MP4 or MOV files.";
  if (
    typeof size !== "number" ||
    !Number.isInteger(size) ||
    size <= 0 ||
    size > MAX_MEDIA_BYTES
  )
    return "Media must be between 1 byte and 50 MB.";
  return null;
}
export function matchesSignature(bytes: Uint8Array, type: string) {
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (type === "image/webp")
    return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if (type === "video/mp4" || type === "video/quicktime")
    return ascii(4, 8) === "ftyp" && bytes.length >= 12;
  return false;
}
