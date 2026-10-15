// @vitest-environment jsdom
// All integration responses here are simulated; no hosted calls are made.
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SystemStatus from "../app/components/system-status";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test("system details use only an authenticated configuration GET and label unavailable AI", async () => {
  const fetcher = vi.fn(async () => Response.json({ configured: false }));
  vi.stubGlobal("fetch", fetcher);
  render(<SystemStatus token="mock-owner-session" />);
  await screen.findByText(/Not configured; sample and manual/);
  expect(fetcher).toHaveBeenCalledWith(
    "/api/creative-director",
    expect.objectContaining({
      headers: { Authorization: "Bearer mock-owner-session" },
      signal: expect.any(AbortSignal),
    }),
  );
  expect(screen.getByText(/Combined exports support 12 clips/)).toBeTruthy();
});
test("a failed configuration check is reported without inventing availability", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "Unavailable" }, { status: 503 })),
  );
  render(<SystemStatus token="mock-owner-session" />);
  await screen.findByText(/Configuration could not be verified/);
});
