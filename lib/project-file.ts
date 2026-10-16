import { validateTimeline, type TimelineDocument } from "./timeline";
import { defaultRecipe } from "./studio-model.mjs";
import { visualSources } from "./cinematic-model.mjs";
export function projectFile(doc: TimelineDocument) {
  const value = {
    version: 1,
    id: doc.id,
    title: doc.title,
    campaignId: doc.campaignId,
    aspect: doc.aspect,
    clips: doc.clips.map((c) => ({
      id: c.id,
      mediaId: c.mediaId,
      kind: c.kind,
      label: c.label,
      recipe: Object.fromEntries(
        Object.keys(defaultRecipe()).map((k) => [
          k,
          k === "captions"
            ? c.recipe.captions?.map(({ start, end, text }) => ({
                start,
                end,
                text,
              }))
            : c.recipe[k as keyof typeof c.recipe],
        ]),
      ),
      ...(c.effects ? { effects: c.effects } : {}),
      ...(c.transition ? { transition: c.transition } : {}),
    })),
    ...(doc.audioTracks?.length ? { audioTracks: doc.audioTracks } : {}),
  };
  const invalid = validateTimeline(value);
  if (invalid) throw Error(invalid);
  return JSON.stringify(value, null, 2);
}
export function openProjectFile(
  raw: string,
  availableIds: string[],
): TimelineDocument {
  if (new TextEncoder().encode(raw).length > 512 * 1024)
    throw Error("Project file is too large.");
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Error("Choose a valid COBS project JSON file.");
  }
  const invalid = validateTimeline(value);
  if (invalid) throw Error(invalid);
  if (visualSources(value.clips).some((id) => !availableIds.includes(id)))
    throw Error(
      "Some originals are missing from your media library. Sign in to the original owner workspace or restore those originals first.",
    );
  return JSON.parse(projectFile(value));
}
