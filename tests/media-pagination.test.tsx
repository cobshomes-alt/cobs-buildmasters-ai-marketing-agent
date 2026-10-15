// @vitest-environment jsdom
import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MediaLibrary from "../app/components/media-library";
test("media library pages preview cards and searching returns to first page", async () => {
  const assets = Array.from({ length: 13 }, (_, i) => ({
    id: String(i),
    storage_path: "unused",
    original_name: `Fixture image ${i + 1}`,
    mime_type: "image/png",
    size_bytes: 68,
    project: "",
    product: "",
    campaign_id: null,
  }));
  render(
    <MediaLibrary
      client={{} as any}
      assets={assets}
      campaigns={[]}
      refresh={async () => {}}
      notify={vi.fn()}
    />,
  );
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(12);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Next media page" }));
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
  expect(
    screen.getByRole("heading", { name: "Fixture image 13" }),
  ).toBeTruthy();
  await user.type(
    screen.getByRole("textbox", { name: "Find media" }),
    "image 1",
  );
  expect(screen.getByRole("heading", { name: "Fixture image 1" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Next media page" })).toBeNull();
});
