import type { Recipe } from "./studio-model.mjs";
import type { Effects, Transition, AudioTrack } from "./cinematic-model.mjs";
export type SequenceRecipe = {
  version: 2 | 3 | 4 | 5;
  audioTracks?: AudioTrack[];
  clips: {
    mediaId: string;
    kind: "image" | "video";
    recipe: Recipe;
    effects?: Effects;
    transition?: Transition;
  }[];
};
export const SEQUENCE_LIMITS: Readonly<{
  clips: number;
  sources: number;
  seconds: number;
  bytes: number;
}>;
export function validateSequence(value: unknown): string | null;
export function sequenceSnapshot(
  clips: SequenceRecipe["clips"],
  audioTracks?: AudioTrack[],
): SequenceRecipe;
