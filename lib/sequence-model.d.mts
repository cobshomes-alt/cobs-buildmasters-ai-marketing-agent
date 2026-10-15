import type { Recipe } from "./studio-model.mjs";
export type SequenceRecipe = {
  version: 2 | 3;
  clips: { mediaId: string; kind: "image" | "video"; recipe: Recipe }[];
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
): SequenceRecipe;
