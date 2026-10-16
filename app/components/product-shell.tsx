"use client";
import { useState, useRef, type FormEvent } from "react";
import BrandLogo from "./brand-logo";
export const SECTION_LABELS: Record<string, string> = {
  Overview: "Home",
  "Creative Studio": "Plan Content",
  "Media Studio": "Editing Studio",
  "Content Calendar": "My Posts",
  "Campaign Planner": "Projects",
  "Media Library": "Media Library",
  Approvals: "Owner Review",
  Scheduler: "Scheduled Posts",
  Leads: "Customer Enquiries",
  "Marketing Operations": "Tasks & Analytics",
  "Publishing Centre": "Publishing Centre",
  Settings: "Settings",
};
export type StudioEntry = "choose" | "automatic" | "manual" | "photo";
export function ProductNavigation({
  active,
  entry,
  navigate,
}: {
  active: string;
  entry: StudioEntry;
  navigate: (s: string, entry?: StudioEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const item = (
    id: string,
    label: string,
    icon: string,
    mode?: StudioEntry,
  ) => (
    <button
      key={label}
      data-workspace-section={id}
      type="button"
      aria-current={
        active === id && (!mode || entry === mode) ? "page" : undefined
      }
      onClick={() => {
        navigate(id, mode);
        setOpen(false);
      }}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
  return (
    <aside className="product-sidebar">
      <div className="product-brand">
        <BrandLogo placement="sidebar" />
        <span>YOUR MARKETING WORKSPACE</span>
      </div>
      <button
        className="mobile-menu"
        aria-expanded={open}
        aria-controls="product-navigation"
        onClick={() => setOpen(!open)}
      >
        Menu <span aria-hidden="true">☰</span>
      </button>
      <nav
        id="product-navigation"
        className={open ? "is-open" : ""}
        aria-label="Workspace sections"
      >
        <p className="nav-group-label">Create something great</p>
        {item("Overview", "Home", "⌂")}
        {item("Media Studio", "Create with AI", "✦", "automatic")}
        {item("Media Studio", "Edit Myself", "▣", "manual")}
        {item("Creative Studio", "Plan Content", "☷")}
        {item("Content Calendar", "My Posts", "▤")}
        <p className="nav-group-label">Your workspace</p>
        {item("Campaign Planner", "Projects", "▦")}
        {item("Media Library", "Media Library", "▧")}
        <details className="business-tools">
          <summary>Business tools</summary>
          {item("Approvals", "Owner Review", "✓")}
          {item("Publishing Centre", "Publishing Centre", "↗")}
          {item("Scheduler", "Scheduled Posts", "◷")}
          {item("Leads", "Customer Enquiries", "☏")}
          {item("Marketing Operations", "Tasks & Analytics", "◫")}
        </details>
        {item("Settings", "Settings", "⚙")}
      </nav>
      <div className="sidebar-footnote">
        Built for the work
        <br />
        <strong>you’re proud of.</strong>
      </div>
    </aside>
  );
}
export function OwnerLogin({
  mode,
  email,
  password,
  notice,
  connected,
  available,
  onEmail,
  onPassword,
  onSubmit,
  onMode,
  onResend,
  onRetry,
  onSignOut,
}: {
  mode: "signIn" | "signUp";
  email: string;
  password: string;
  notice: string;
  connected: boolean;
  available: boolean;
  onEmail: (s: string) => void;
  onPassword: (s: string) => void;
  onSubmit: (e: FormEvent) => Promise<void>;
  onMode: () => void;
  onResend: () => void;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submitting = useRef(false);
  const friendly = /supabase|environment variables|database migrations/i.test(
    notice,
  )
    ? "Your workspace is temporarily unavailable. Please retry or contact your administrator."
    : notice;
  return (
    <main className="login-page">
      <section className="login-story" aria-label="COBS marketing workspace">
        <BrandLogo placement="auth" />
        <p className="eyebrow">COBS BUILDMASTERS LTD</p>
        <h2>
          Good work.
          <br />
          Great stories.
        </h2>
        <p>
          Bring your projects to life.
          <br />
          Plan, create and share with confidence.
        </p>
        <div className="architectural-lines" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <span className="login-signature">
          BUILT WITH PURPOSE. SHARED WITH PRIDE.
        </span>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap">
          <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
          <h1>
            {mode === "signIn"
              ? "Sign in to your workspace"
              : "Create the owner account"}
          </h1>
          <p className="login-intro">
            {mode === "signIn"
              ? "Welcome back. Let’s create something worth sharing."
              : "Use your authorised owner email to get started."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting.current) return;
              submitting.current = true;
              setBusy(true);
              setError("");
              try {
                await onSubmit(e);
              } catch {
                setError(
                  "We couldn’t sign you in. Check your connection and try again.",
                );
              } finally {
                submitting.current = false;
                setBusy(false);
              }
            }}
          >
            <label htmlFor="owner-email">Email address</label>
            <input
              id="owner-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              placeholder="you@company.com"
            />
            <label htmlFor="owner-password">Password</label>
            <div className="password-field">
              <input
                id="owner-password"
                type={show ? "text" : "password"}
                autoComplete={
                  mode === "signIn" ? "current-password" : "new-password"
                }
                minLength={6}
                required
                value={password}
                onChange={(e) => onPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                aria-pressed={show}
                onClick={() => setShow(!show)}
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
            <button
              className="primary-action login-submit"
              type="submit"
              disabled={busy || !available}
            >
              {busy
                ? "Please wait…"
                : mode === "signIn"
                  ? "Sign in"
                  : "Create account"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          {(error || friendly) && (
            <p role="status" aria-live="polite" className="login-notice">
              {error || friendly}
            </p>
          )}
          <details className="login-help">
            <summary>Need help signing in?</summary>
            {mode === "signIn" && (
              <button type="button" onClick={onResend}>
                Resend confirmation email
              </button>
            )}
            <button type="button" onClick={onMode}>
              {mode === "signIn"
                ? "First time here? Create your owner account"
                : "Already have an account? Sign in"}
            </button>
            {connected && (
              <div className="actions">
                <button onClick={onRetry}>Retry workspace</button>
                <button onClick={onSignOut}>Sign out</button>
              </div>
            )}
          </details>
          <p className="login-privacy">
            Private access. Your originals stay yours.
            <br />
            Nothing is published without your approval.
          </p>
        </div>
      </section>
    </main>
  );
}
