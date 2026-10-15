import { test, expect } from "vitest";
import {
  defaultRecipe,
  validateRecipe,
  encodeEdit,
  decodeEdit,
  isEditingRecord,
} from "../lib/studio-model.mjs";
test("editing recipes round-trip, reject malformed values and reserve internal records", () => {
  const r = defaultRecipe();
  expect(decodeEdit(encodeEdit(r))).toEqual(r);
  expect(isEditingRecord({ body: encodeEdit(r) })).toBe(true);
  expect(decodeEdit("[COBS_EDIT_PROJECT_V1]\n{}")).toBeNull();
  for (const patch of [
    { aspect: "100:1" },
    { start: -1 },
    { duration: 31 },
    { brightness: NaN },
    { position: 2 },
    { volume: 3 },
    { text: "x\ncommand" },
    { subtitle: "x".repeat(121) },
    { fade: 3, duration: 2 },
  ])
    expect(validateRecipe({ ...r, ...patch })).toBeTruthy();
});
