// @vitest-environment jsdom
import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import TimedCaptions from "../app/components/timed-captions";
import {
  defaultRecipe,
  validateRecipe,
  decodeEdit,
  encodeEdit,
  type Recipe,
} from "../lib/studio-model.mjs";
import {
  newTimeline,
  newClip,
  splitClip,
  validateTimeline,
} from "../lib/timeline";
import { sequenceSnapshot } from "../lib/sequence-model.mjs";
afterEach(cleanup);
test("legacy static recipes remain valid and timed cues reject malformed/overlapping ranges", () => {
  const legacy = { ...defaultRecipe(), subtitle: "Original static subtitle" };
  delete legacy.captions;
  expect(decodeEdit(encodeEdit(legacy))).toEqual(legacy);
  for (const captions of [
    [{ start: -1, end: 2, text: "x" }],
    [{ start: 0, end: 16, text: "x" }],
    [{ start: 1, end: 1, text: "x" }],
    [{ start: NaN, end: 2, text: "x" }],
    [{ start: 0, end: 1, text: "" }],
    [{ start: 0, end: 1, text: "x\nfilter" }],
    [
      { start: 0, end: 2, text: "first" },
      { start: 1, end: 3, text: "overlap" },
    ],
    Array.from({ length: 13 }, (_, i) => ({ start: i, end: i + 1, text: "x" })),
  ])
    expect(validateRecipe({ ...defaultRecipe(), captions })).toBeTruthy();
  expect(
    validateRecipe({ ...legacy, captions: [{ start: 0, end: 1, text: "x" }] }),
  ).toMatch(/not both/);
});
test("splitting redistributes clip-relative captions without modifying the original", () => {
  const clip = newClip({
    id: "11111111-1111-4111-8111-111111111111",
    mime_type: "video/mp4",
    original_name: "Synthetic",
  });
  clip.recipe.captions = [
    { start: 1, end: 3, text: "Across split" },
    { start: 3.5, end: 4.5, text: "Later" },
  ];
  const document = { ...newTimeline(), clips: [clip] },
    split = splitClip(document, clip.id, 2);
  expect(split.clips[0].recipe.captions).toEqual([
    { start: 1, end: 2, text: "Across split" },
  ]);
  expect(split.clips[1].recipe.captions).toEqual([
    { start: 0, end: 1, text: "Across split" },
    { start: 1.5, end: 2.5, text: "Later" },
  ]);
  expect(document.clips[0].recipe.captions![0].end).toBe(3);
  expect(validateTimeline(split)).toBeNull();
});
test("snapshot sanitization strips unexpected fields inside caption cues", () => {
  const recipe = {
    ...defaultRecipe(),
    captions: [
      { start: 0, end: 1, text: "Synthetic", secret: "never-persist" },
    ],
  };
  expect(
    JSON.stringify(
      sequenceSnapshot([
        {
          mediaId: "11111111-1111-4111-8111-111111111111",
          kind: "image",
          recipe,
        },
      ]),
    ),
  ).not.toContain("never-persist");
  expect(
    sequenceSnapshot([
      {
        mediaId: "11111111-1111-4111-8111-111111111111",
        kind: "image",
        recipe,
      },
    ]).version,
  ).toBe(3);
});
function Editor({ staticText = "" }: { staticText?: string }) {
  const [recipe, setRecipe] = useState<Recipe>({
    ...defaultRecipe(),
    duration: 3,
    subtitle: staticText,
  });
  return (
    <TimedCaptions
      recipe={recipe}
      onChange={(patch) => setRecipe((r) => ({ ...r, ...patch }))}
    />
  );
}
test("manual caption editing creates/removes real timed values and reports invalid timing", async () => {
  const user = userEvent.setup();
  render(<Editor />);
  await user.click(screen.getByRole("button", { name: "Add timed caption" }));
  await user.type(screen.getByLabelText("Caption 1 text"), "Synthetic caption");
  await user.clear(screen.getByLabelText("Caption 1 end (seconds)"));
  await user.type(screen.getByLabelText("Caption 1 end (seconds)"), "4");
  expect(screen.getByRole("status").textContent).toMatch(/within the clip/);
  await user.click(screen.getByRole("button", { name: "Remove caption 1" }));
  expect(screen.queryByLabelText("Caption 1 text")).toBeNull();
});
test("static subtitle is preserved and blocks adding overlapping timed text", () => {
  render(<Editor staticText="Keep existing subtitle" />);
  expect(
    (
      screen.getByRole("button", {
        name: "Add timed caption",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
