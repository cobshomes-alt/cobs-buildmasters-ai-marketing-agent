// @vitest-environment jsdom
import { test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BatchUpload from "../app/components/batch-upload";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test("multiple originals upload sequentially, skip duplicate selections and report confirmed saved files", async () => {
  let active = 0,
    max = 0;
  const upload = vi.fn(async () => {
    active++;
    max = Math.max(max, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    return { error: null };
  });
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "fake" } } }),
    },
    storage: {
      from: () => ({
        uploadToSignedUrl: upload,
        createSignedUrl: async () => ({
          data: { signedUrl: "https://example.invalid/preview" },
        }),
      }),
    },
  } as any;
  let count = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, options: any) => {
      const input = JSON.parse(options.body);
      return Response.json(
        input.action === "prepare"
          ? { path: `owner/${++count}.png`, token: "fake" }
          : {
              asset: {
                id: String(count),
                storage_path: input.path,
                original_name: input.name,
              },
            },
      );
    }),
  );
  const done = vi.fn();
  render(<BatchUpload client={client} onUploaded={done} />);
  const user = userEvent.setup(),
    file = new File(["synthetic"], "Synthetic.png", {
      type: "image/png",
      lastModified: 1,
    }),
    second = new File(["synthetic"], "Synthetic2.png", {
      type: "image/png",
      lastModified: 2,
    });
  const input = screen.getByLabelText(/Drop your original/);
  await user.upload(input, [file, second]);
  await user.upload(input, [file]);
  expect(screen.getByText(/repeated selections skipped/)).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "Upload / retry unsaved files" }),
  );
  await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
  expect(upload).toHaveBeenCalledTimes(2);
  expect(max).toBe(1);
  expect(screen.getByText(/2 \/ 2 originals saved/)).toBeTruthy();
});
test("uncertain registration retry reconciles an existing object without another upload or deletion", async () => {
  let existing: any = null;
  const upload = vi.fn(async () => ({ error: null })),
    client = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "fake" } },
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: existing, error: null }),
          }),
        }),
      }),
      storage: {
        from: () => ({
          uploadToSignedUrl: upload,
          createSignedUrl: async () => ({
            data: { signedUrl: "https://example.invalid/preview" },
          }),
        }),
      },
    } as any;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, options: any) => {
      const input = JSON.parse(options.body);
      if (input.action === "prepare")
        return Response.json({ path: "owner/fixture.png", token: "fake" });
      existing = {
        id: "fixture",
        storage_path: input.path,
        original_name: input.name,
      };
      return Response.json(
        { error: "Response lost after registration" },
        { status: 502 },
      );
    }),
  );
  const done = vi.fn();
  render(<BatchUpload client={client} onUploaded={done} />);
  const user = userEvent.setup();
  await user.upload(
    screen.getByLabelText(/Drop your original/),
    new File(["synthetic"], "Synthetic.png", { type: "image/png" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Upload / retry unsaved files" }),
  );
  await screen.findByText("Response lost after registration");
  await user.click(
    screen.getByRole("button", { name: "Upload / retry unsaved files" }),
  );
  await waitFor(() =>
    expect(screen.getByText(/1 \/ 1 originals saved/)).toBeTruthy(),
  );
  expect(upload).toHaveBeenCalledTimes(1);
});
