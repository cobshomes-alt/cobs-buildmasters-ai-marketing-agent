// @vitest-environment jsdom
import { test, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { OwnerLogin, ProductNavigation } from "../app/components/product-shell";
afterEach(cleanup);
test("login supports password visibility and blocks duplicate submissions until completion", async () => {
  let resolve!: () => void;
  const submit = vi.fn(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  render(
    <OwnerLogin
      mode="signIn"
      email="owner@example.test"
      password="synthetic-only"
      notice=""
      connected={false}
      available
      onEmail={() => {}}
      onPassword={() => {}}
      onSubmit={submit}
      onMode={() => {}}
      onResend={() => {}}
      onRetry={() => {}}
      onSignOut={() => {}}
    />,
  );
  const input = screen.getByLabelText("Password");
  expect(input.getAttribute("type")).toBe("password");
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(input.getAttribute("type")).toBe("text");
  fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(input.getAttribute("type")).toBe("password");
  const form = input.closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(submit).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
  expect(
    screen.getByRole("button", { name: "Sign in" }).hasAttribute("disabled"),
  ).toBe(false);
});
test("new navigation preserves internal section identifiers and explicit editor modes", () => {
  const navigate = vi.fn();
  render(
    <ProductNavigation active="Overview" entry="choose" navigate={navigate} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Create with AI" }));
  expect(navigate).toHaveBeenCalledWith("Media Studio", "automatic");
  fireEvent.click(screen.getByRole("button", { name: "Edit Myself" }));
  expect(navigate).toHaveBeenCalledWith("Media Studio", "manual");
  fireEvent.click(screen.getByRole("button", { name: "Plan Content" }));
  expect(navigate).toHaveBeenCalledWith("Creative Studio", undefined);
  expect(
    screen.getByRole("button", { name: "Home" }).getAttribute("aria-current"),
  ).toBe("page");
});
