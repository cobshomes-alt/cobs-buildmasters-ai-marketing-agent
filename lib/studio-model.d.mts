export type Recipe = {
  version: 1;
  aspect: "9:16" | "16:9" | "1:1" | "4:5";
  fit: "contain" | "cover";
  position: number;
  start: number;
  duration: number;
  brightness: number;
  contrast: number;
  saturation: number;
  volume: number;
  fade: number;
  watermark: boolean;
  text: string;
  subtitle: string;
  captions?: { start: number; end: number; text: string }[];
};
export const EDIT_PREFIX: string;
export const DIMENSIONS: Record<Recipe["aspect"], [number, number]>;
export function defaultRecipe(): Recipe;
export function validateRecipe(r: unknown): string | null;
export function sliceCaptions(
  recipe: Recipe,
  from: number,
  to: number,
): NonNullable<Recipe["captions"]>;
export function encodeEdit(r: Recipe): string;
export function decodeEdit(body: string): Recipe | null;
export function isEditingRecord(post: { body: string }): boolean;
