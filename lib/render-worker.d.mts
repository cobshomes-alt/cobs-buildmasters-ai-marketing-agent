import type { DatabaseSync } from "node:sqlite";
import type { Recipe } from "./studio-model.mjs";
import type { SequenceRecipe } from "./sequence-model.mjs";
import type { Effects } from "./cinematic-model.mjs";
export function render(
  id: string,
  recipe: Recipe,
  kind: "image" | "video",
  token: string,
  options?: {
    input?: string;
    effects?: Effects;
    photoVideo?: boolean;
    silence?: boolean;
    layerInput?: string;
    timeout?: number;
    maxBytes?: number;
  },
): Promise<string>;
export type JobRow = {
  id: string;
  owner: string;
  key: string;
  state: string;
  recipe: string;
  kind: "image" | "video";
  created: number;
  updated: number;
  attempts: number;
  lease: string | null;
  error: string | null;
  bytes: number;
};
export type RenderJob = Pick<
  JobRow,
  "id" | "state" | "attempts" | "kind" | "created" | "updated" | "error"
> & { history: { at: number; state: string }[] };
export const ROOT: string;
export const MAX_BYTES: number;
export function limits(): { daily: number; monthlyBytes: number };
export function readiness(): boolean;
export function database(): DatabaseSync;
export function findJob(
  db: DatabaseSync,
  owner: string,
  id: string,
): JobRow | undefined;
export function publicJob(
  db: DatabaseSync,
  row: JobRow | undefined,
): RenderJob | null;
export function listJobs(db: DatabaseSync, owner: string): RenderJob[];
export function reserve(
  db: DatabaseSync,
  owner: string,
  key: string,
  recipe: Recipe | SequenceRecipe,
  kind: string,
  bytes: number,
): { row: JobRow; duplicate: boolean };
export function setState(
  db: DatabaseSync,
  id: string,
  state: string,
  error?: string | null,
  expected?: string | null,
): void;
export function inputPath(id: string): string;
export function sequenceInputPath(id: string, index: number): string;
export function outputPath(row: JobRow): string;
export function renderKey(
  owner: string,
  project: string,
  updated: string,
  body: string,
  path: string,
): string;
export function cancel(
  db: DatabaseSync,
  owner: string,
  id: string,
): RenderJob | null;
export function command(
  exe: string,
  args: string[],
  timeout?: number,
): Promise<string>;
export function probe(path: string): Promise<{
  streams: {
    codec_type: string;
    codec_name: string;
    width?: number;
    height?: number;
    nb_frames?: string;
  }[];
  format: { duration: string };
}>;
export function tick(db: DatabaseSync, workerToken: string): Promise<boolean>;
export function renderSequence(
  id: string,
  sequence: SequenceRecipe,
  token: string,
  allowed?: () => boolean,
): Promise<string>;
export function cleanup(db: DatabaseSync): void;
