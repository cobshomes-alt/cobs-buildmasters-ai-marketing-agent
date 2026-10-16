// @vitest-environment jsdom
import { test, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import SequenceExport from "../app/components/sequence-export";
import { newTimeline, newClip } from "../lib/timeline";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test("cinematic export is disabled with an honest blocker until worker capability 4 is verified", async () => {
  const doc = newTimeline();
  doc.clips = [
    {
      ...newClip({
        id: crypto.randomUUID(),
        original_name: "Synthetic.png",
        mime_type: "image/png",
      }),
      effects: { animateText: true },
    },
  ];
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "mock-only" } },
      }),
    },
  };
  let ready = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        ready: true,
        workerOnline: true,
        sequenceReady: true,
        timedCaptionsReady: true,
        cinematicReady: ready,
        jobs: [],
      }),
    ),
  );
  render(
    <SequenceExport
      client={client as never}
      document={doc}
      onBusy={() => {}}
    />,
  );
  await screen.findByText(
    "Start the version 4 worker for cinematic effects and separate audio.",
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Export combined MP4",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  cleanup();
  ready = true;
  render(
    <SequenceExport
      client={client as never}
      document={doc}
      onBusy={() => {}}
    />,
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Export combined MP4",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
});

test("construction export waits for capability 5 even when legacy cinematic rendering is ready", async () => {
  const doc = newTimeline();
  doc.clips = [
    {
      ...newClip({
        id: crypto.randomUUID(),
        original_name: "Synthetic.png",
        mime_type: "image/png",
      }),
      effects: { grade: "art-of-building" },
    },
  ];
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "mock-only" } },
      }),
    },
  };
  let ready = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        ready: true,
        workerOnline: true,
        sequenceReady: true,
        timedCaptionsReady: true,
        cinematicReady: true,
        constructionReady: ready,
        jobs: [],
      }),
    ),
  );
  const show = () =>
    render(
      <SequenceExport
        client={client as never}
        document={doc}
        onBusy={() => {}}
      />,
    );
  show();
  await screen.findByText(
    "Start the version 5 worker for construction grading, speed and logo endings.",
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Export combined MP4",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  cleanup();
  ready = true;
  show();
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Export combined MP4",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
});
