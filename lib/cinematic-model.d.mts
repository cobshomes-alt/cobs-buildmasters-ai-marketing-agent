export type Motion = {
  fromScale: number;
  toScale: number;
  fromX: number;
  toX: number;
  fromY: number;
  toY: number;
};
export type Layer = {
  mediaId: string;
  kind: "image" | "video";
  start: number;
  x: number;
  y: number;
  width: number;
};
export type Effects = {
  grade?: "art-of-building";
  speed?: number;
  logoEnding?: boolean;
  motion?: Motion;
  template?: "plain" | "lower-third" | "intro" | "outro";
  animateText?: boolean;
  layer?: Layer;
};
export type Transition = {
  type: "cut" | "fade" | "dissolve";
  duration: number;
};
export type AudioTrack = {
  id: string;
  kind: "music" | "narration";
  volume: number;
  offset: number;
  fade: number;
  loop: boolean;
};
export const uuid: RegExp;
export function validateEffects(
  c: {
    recipe: { duration: number; watermark?: boolean };
    kind?: "image" | "video";
    effects?: Effects;
    transition?: Transition;
  },
  last?: boolean,
): string | null;
export function validateTracks(t: unknown): string | null;
export function sequenceDuration(
  clips: { recipe: { duration: number }; transition?: Transition }[],
): number;
export function visualSources(
  clips: { mediaId: string; effects?: Effects }[],
): string[];
