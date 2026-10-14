"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

import Overview from "./components/overview";
import PostAttachment from "./components/post-attachment";
import MediaLibrary, { type Asset } from "./components/media-library";

type Status =
  "Draft" | "Pending approval" | "Approved" | "Scheduled" | "Rejected";
type Post = {
  id: string;
  title: string;
  body: string;
  status: Status;
  source: "ai" | "starter" | "manual";
  created_at?: string;
  media_id?: string | null;
  campaign_id?: string | null;
  updated_at?: string;
};
type Campaign = { id: string; name: string; created_at?: string };
const modules = [
  "Overview",
  "Campaign Planner",
  "Content Calendar",
  "Creative Studio",
  "Media Library",
  "Approvals",
  "Scheduler",
  "Leads",
  "Settings",
];
const card = {
  background: "#fff",
  borderRadius: 10,
  padding: 22,
  boxShadow: "0 8px 32px #102f5b08",
  border: "1px solid #e3e8ef",
};
const button = {
  background: "#17345c",
  color: "#fff",
  border: 0,
  borderRadius: 7,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};
const input = {
  display: "block",
  width: "100%",
  margin: "8px 0 14px",
  padding: 10,
  boxSizing: "border-box" as const,
};

export default function Page() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return url && key ? createClient(url, key) : null;
  }, []);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState("Overview");
  const [notice, setNotice] = useState("Sign in to open the secure workspace.");
  const [posts, setPosts] = useState<Post[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [title, setTitle] = useState(
    "Build stronger with COBS concrete blocks",
  );
  const [body, setBody] = useState(
    "Quality concrete blocks and fast floors for your next construction project.",
  );
  const [topic, setTopic] = useState("concrete blocks and fast floors");
  const [campaign, setCampaign] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [mediaId, setMediaId] = useState("");
  const [postCampaign, setPostCampaign] = useState("");
  const [editing, setEditing] = useState<Post | null>(null);
  const [saving, setSaving] = useState(false);
  const workspaceRequest = useRef(0);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setNotice("Supabase environment variables need attention.");
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const loadWorkspace = useCallback(async () => {
    if (!supabase || !session) return;
    const requestId = ++workspaceRequest.current;
    setNotice("Loading secure workspace…");
    setRole(null);
    const [profileResult, postResult, campaignResult, mediaResult] =
      await Promise.all([
        supabase
          .from("cobs_profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle(),
        supabase
          .from("cobs_posts")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("cobs_campaigns")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("cobs_media_assets")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
    if (requestId !== workspaceRequest.current) return;
    if (profileResult.error || profileResult.data?.role !== "owner") {
      setRole(null);
      setNotice("This account is not authorised for the COBS owner workspace.");
      return;
    }
    if (postResult.error || campaignResult.error || mediaResult.error) {
      setNotice(
        "Workspace data could not be loaded. Check Supabase connectivity and apply both database migrations, then retry.",
      );
      return;
    }
    const media = await Promise.all(
      (mediaResult.data || []).map(async (asset: Asset) => {
        const signed = await supabase.storage
          .from("cobs-media")
          .createSignedUrl(asset.storage_path, 3600);
        return { ...asset, url: signed.data?.signedUrl };
      }),
    );
    if (requestId !== workspaceRequest.current) return;
    setAssets(media);
    setRole("owner");
    setPosts((postResult.data || []) as Post[]);
    setCampaigns((campaignResult.data || []) as Campaign[]);
    setNotice("Secure Supabase workspace connected.");
  }, [supabase, session]);

  useEffect(() => {
    if (session) void loadWorkspace();
    else {
      setRole(null);
      setPosts([]);
      setCampaigns([]);
      setAssets([]);
      setEditing(null);
      setMediaId("");
      setPostCampaign("");
    }
    return () => {
      workspaceRequest.current++;
    };
  }, [session, loadWorkspace]);

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setNotice(
      authMode === "signIn"
        ? "Signing in…"
        : "Creating your secure owner account…",
    );
    const result =
      authMode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          });
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    setPassword("");
    setNotice(
      authMode === "signUp"
        ? "Account created. Check your email to confirm it, then sign in."
        : "Signed in. Loading workspace…",
    );
  };

  const resendConfirmation = async () => {
    if (!supabase || !email.trim()) {
      setNotice("Enter your email address first, then resend confirmation.");
      return;
    }
    setNotice("Sending a fresh confirmation email…");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setNotice(
      error
        ? error.message
        : "A fresh confirmation email has been sent. Open the newest email link on this device.",
    );
  };

  const saveDraft = async (
    nextTitle = title,
    nextBody = body,
    source: Post["source"] = "manual",
  ) => {
    if (!supabase || !session || role !== "owner") {
      setNotice("Sign in as the COBS owner before saving content.");
      return;
    }
    if (saving) return false;
    if (
      !nextTitle.trim() ||
      nextTitle.length > 240 ||
      !nextBody.trim() ||
      nextBody.length > 10000
    ) {
      setNotice(
        "Enter a title (up to 240 characters) and copy (up to 10,000 characters).",
      );
      return false;
    }
    setSaving(true);
    try {
      const values = {
        title: nextTitle.trim(),
        body: nextBody.trim(),
        source: editing ? editing.source : source,
        media_id: mediaId || null,
        campaign_id: postCampaign || null,
      };
      const query = editing
        ? supabase
            .from("cobs_posts")
            .update(values)
            .eq("id", editing.id)
            .eq("updated_at", editing.updated_at)
        : supabase
            .from("cobs_posts")
            .insert({ ...values, created_by: session.user.id });
      const { data, error } = await query.select().single();
      if (error) {
        setNotice(
          "Draft could not be saved. It may have changed on another device. Refresh before retrying. " +
            error.message,
        );
        return false;
      }
      setPosts((items) =>
        editing
          ? items.map((post) =>
              post.id === editing.id ? (data as Post) : post,
            )
          : [data as Post, ...items],
      );
      setEditing(null);
      setActive("Content Calendar");
      setNotice(
        "Content saved securely. Changed content requires a fresh owner approval.",
      );
      return true;
    } catch {
      setNotice(
        "Could not reach the database. Your draft has not been confirmed saved.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: Status) => {
    if (!supabase || role !== "owner") return;
    const update: { status: Status; scheduled_at?: string } = { status };
    if (status === "Scheduled") update.scheduled_at = new Date().toISOString();
    const current = posts.find((post) => post.id === id);
    if (!current) return;
    const { data, error } = await supabase
      .from("cobs_posts")
      .update(update)
      .eq("id", id)
      .eq("updated_at", current.updated_at)
      .select()
      .single();
    if (error) {
      setNotice("Post status could not be updated: " + error.message);
      return;
    }
    setPosts((items) =>
      items.map((post) => (post.id === id ? (data as Post) : post)),
    );
    setNotice(
      status === "Scheduled"
        ? "Post marked for manual publishing. Meta is not connected yet."
        : "Post status updated.",
    );
  };

  const generate = async () => {
    setGenerating(true);
    setNotice("Generating your COBS post…");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          topic,
          platform: "Facebook and Instagram",
          objective: "brand visibility",
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        title?: string;
        body?: string;
        source?: "ai";
        error?: string;
      };
      if (
        !response.ok ||
        result.source !== "ai" ||
        !result.title ||
        !result.body
      ) {
        setNotice(
          result.error ||
            "AI generation failed. No draft was saved; use a sample caption if needed.",
        );
        return;
      }
      setTitle(result.title);
      setBody(result.body);
      const saved = await saveDraft(result.title, result.body, "ai");
      if (saved) setNotice("AI post generated and saved as a draft.");
    } catch {
      setNotice(
        "AI generation could not reach the provider. No draft was saved.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const createSampleCaption = async () => {
    const saved = await saveDraft(
      "Sample COBS construction caption",
      "Build with confidence with COBS Buildmasters. Ask us about dependable concrete blocks, fast floors and construction support for your next project. Call 0594599327 or 0503466178. #COBSBuildmasters #ConstructionGhana",
      "starter",
    );
    if (saved)
      setNotice("Sample caption saved as a draft. It was not generated by AI.");
  };

  const addCampaign = async () => {
    if (!supabase || !session || !campaign.trim()) return;
    const { data, error } = await supabase
      .from("cobs_campaigns")
      .insert({ name: campaign.trim(), created_by: session.user.id })
      .select()
      .single();
    if (error) {
      setNotice("Campaign could not be saved: " + error.message);
      return;
    }
    setCampaigns((items) => [data as Campaign, ...items]);
    setCampaign("");
    setNotice("Campaign added securely.");
  };

  const addLead = async () => {
    if (!supabase || !session || !leadName.trim()) return;
    const { error } = await supabase.from("cobs_leads").insert({
      name: leadName.trim(),
      phone: leadPhone.trim() || null,
      created_by: session.user.id,
    });
    if (error) {
      setNotice("Lead could not be saved: " + error.message);
      return;
    }
    setLeadName("");
    setLeadPhone("");
    setNotice("Lead saved securely.");
  };

  if (!session || role !== "owner")
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f4f6f8",
          fontFamily: "Arial, sans-serif",
          color: "#17345c",
          padding: 20,
        }}
      >
        <section style={{ ...card, width: "min(430px, 100%)" }}>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 3 }}>
            COBS
          </div>
          <p style={{ color: "#b18b4a", fontWeight: 700, letterSpacing: 1.2 }}>
            BUILDMASTERS MARKETING AGENT
          </p>
          <h1>
            {authMode === "signIn"
              ? "Sign in to your workspace"
              : "Create the owner account"}
          </h1>
          <p>
            {authMode === "signIn"
              ? "Use the authorised COBS owner email to open the private workspace."
              : "Use cobshomes@gmail.com. You will be asked to confirm the email before signing in."}
          </p>
          <form onSubmit={submitAuth}>
            <label>
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={input}
              />
            </label>
            <label>
              Password
              <input
                required
                minLength={6}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={input}
              />
            </label>
            <button type="submit" style={button}>
              {authMode === "signIn" ? "Sign in" : "Create account"}
            </button>
          </form>
          {authMode === "signIn" && (
            <button
              type="button"
              onClick={() => void resendConfirmation()}
              style={{
                border: 0,
                background: "none",
                color: "#17345c",
                marginTop: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Resend confirmation email
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              setAuthMode(authMode === "signIn" ? "signUp" : "signIn")
            }
            style={{
              border: 0,
              background: "none",
              color: "#17345c",
              marginTop: 16,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {authMode === "signIn"
              ? "First time here? Create your owner account"
              : "Already have an account? Sign in"}
          </button>
          {session && (
            <div className="auth-actions">
              <button type="button" onClick={() => void loadWorkspace()}>
                Retry workspace
              </button>
              <button
                type="button"
                onClick={() => void supabase?.auth.signOut()}
              >
                Sign out
              </button>
            </div>
          )}
          <p
            role="status"
            aria-live="polite"
            style={{ color: "#536273", marginTop: 18 }}
          >
            ● {notice}
          </p>
        </section>
      </main>
    );

  const drafts = posts.filter((p) => p.status === "Draft"),
    pending = posts.filter((p) => p.status === "Pending approval"),
    approved = posts.filter((p) => p.status === "Approved"),
    scheduled = posts.filter((p) => p.status === "Scheduled");
  const panel = () => {
    if (active === "Media Library" && supabase)
      return (
        <MediaLibrary
          client={supabase}
          assets={assets}
          campaigns={campaigns}
          refresh={loadWorkspace}
          notify={setNotice}
        />
      );
    if (active === "Overview")
      return (
        <Overview
          counts={{
            drafts: drafts.length,
            pending: pending.length,
            approved: approved.length,
            ready: scheduled.length,
            media: assets.length,
            campaigns: campaigns.length,
          }}
          recent={posts}
          navigate={setActive}
        />
      );
    if (active === "Creative Studio")
      return (
        <article style={card}>
          <h2>AI Content Generator</h2>
          <p>Describe the product, service or campaign you want to promote.</p>
          <label>
            Topic
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              style={input}
            />
          </label>
          <button
            type="button"
            disabled={generating}
            onClick={generate}
            style={{ ...button, opacity: generating ? 0.65 : 1 }}
          >
            {generating ? "Generating…" : "Generate AI post"}
          </button>
          <button
            type="button"
            onClick={() => void createSampleCaption()}
            style={{ ...button, marginLeft: 8, background: "#617187" }}
          >
            Create sample caption
          </button>
          <p style={{ color: "#617187" }}>
            AI output is labelled AI generated. Sample captions are clearly
            labelled and are never presented as AI output.
          </p>
        </article>
      );
    if (active === "Content Calendar")
      return (
        <article style={card}>
          <h2>{editing ? "Edit content" : "Content Calendar"}</h2>
          {editing && (
            <p>
              Saving changes resets approval.{" "}
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setMediaId("");
                  setPostCampaign("");
                }}
              >
                Cancel editing
              </button>
            </p>
          )}
          <label>
            Post title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={input}
            />
          </label>
          <label>
            Post copy
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ ...input, minHeight: 110 }}
            />
          </label>
          <div className="form-grid">
            <label>
              Attach original media
              <select
                value={mediaId}
                onChange={(e) => setMediaId(e.target.value)}
              >
                <option value="">No attachment</option>
                {assets
                  .filter((asset) => !asset.deletion_pending)
                  .map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.original_name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Campaign
              <select
                value={postCampaign}
                onChange={(e) => setPostCampaign(e.target.value)}
              >
                <option value="">Unassigned</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            disabled={saving}
            type="button"
            onClick={() => void saveDraft()}
            style={button}
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Save as draft"}
          </button>
          <div style={{ marginTop: 24 }}>
            {posts.length === 0 ? (
              <p>No content yet. Create a draft or use Creative Studio.</p>
            ) : (
              posts.map((post) => (
                <article
                  key={post.id}
                  style={{ borderTop: "1px solid #dce3ea", padding: "16px 0" }}
                >
                  <strong>{post.title}</strong>
                  <p style={{ whiteSpace: "pre-wrap" }}>{post.body}</p>
                  <PostAttachment
                    asset={assets.find((asset) => asset.id === post.media_id)}
                  />
                  <p className="muted">
                    {assets.find((a) => a.id === post.media_id)
                      ?.original_name || "No media attached"}{" "}
                    ·{" "}
                    {campaigns.find((c) => c.id === post.campaign_id)?.name ||
                      "No campaign"}
                  </p>
                  <small>
                    Status: {post.status} ·{" "}
                    {post.source === "ai"
                      ? "AI generated"
                      : post.source === "starter"
                        ? "Starter draft"
                        : "Manual"}
                  </small>
                  <div className="actions" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(post);
                        setTitle(post.title);
                        setBody(post.body);
                        setMediaId(post.media_id || "");
                        setPostCampaign(post.campaign_id || "");
                      }}
                    >
                      Edit content
                    </button>
                    {(post.status === "Draft" ||
                      post.status === "Rejected") && (
                      <button
                        type="button"
                        onClick={() =>
                          void updateStatus(post.id, "Pending approval")
                        }
                        style={button}
                      >
                        Send for approval
                      </button>
                    )}
                    {post.status === "Approved" && (
                      <button
                        type="button"
                        onClick={() => void updateStatus(post.id, "Scheduled")}
                        style={button}
                      >
                        Mark ready to publish
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </article>
      );
    if (active === "Approvals")
      return (
        <article style={card}>
          <h2>Owner Approval Centre</h2>
          {pending.length === 0 ? (
            <p>No posts are waiting for approval.</p>
          ) : (
            pending.map((post) => (
              <article
                key={post.id}
                style={{ borderTop: "1px solid #dce3ea", padding: "16px 0" }}
              >
                <strong>{post.title}</strong>
                <p style={{ whiteSpace: "pre-wrap" }}>{post.body}</p>
                <PostAttachment
                  asset={assets.find((asset) => asset.id === post.media_id)}
                />
                <button
                  type="button"
                  onClick={() => void updateStatus(post.id, "Approved")}
                  style={button}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void updateStatus(post.id, "Rejected")}
                  style={{ ...button, marginLeft: 8, background: "#8f3131" }}
                >
                  Return for revision
                </button>
              </article>
            ))
          )}
        </article>
      );
    if (active === "Campaign Planner")
      return (
        <article style={card}>
          <h2>Campaign Planner</h2>
          <label>
            Campaign name
            <input
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              style={input}
            />
          </label>
          <button
            type="button"
            onClick={() => void addCampaign()}
            style={button}
          >
            Add campaign
          </button>
          {campaigns.map((item) => (
            <p
              key={item.id}
              style={{ borderTop: "1px solid #dce3ea", paddingTop: 12 }}
            >
              <strong>{item.name}</strong>
            </p>
          ))}
        </article>
      );
    if (active === "Scheduler")
      return (
        <article style={card}>
          <h2>Publishing Readiness</h2>
          {approved.length ? (
            approved.map((post) => (
              <p key={post.id}>
                <strong>{post.title}</strong> is approved and can be marked
                ready in Content Calendar.
              </p>
            ))
          ) : (
            <p>Approve a post first to make it publishing-ready.</p>
          )}
          <p>
            {scheduled.length} post(s) marked ready. Meta is not connected, so
            no social post is published automatically.
          </p>
        </article>
      );
    if (active === "Leads")
      return (
        <article style={card}>
          <h2>Lead Register</h2>
          <label>
            Name
            <input
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              style={input}
            />
          </label>
          <label>
            Phone
            <input
              value={leadPhone}
              onChange={(e) => setLeadPhone(e.target.value)}
              style={input}
            />
          </label>
          <button type="button" onClick={() => void addLead()} style={button}>
            Save lead
          </button>
        </article>
      );
    return (
      <article style={card}>
        <h2>Settings</h2>
        <p>
          Workspace data uses Supabase authentication and owner access policies.
          Live integration requires the configured Supabase project and both
          migrations. AI generation requires a server-side OpenAI key with
          existing account access. Meta/Facebook/Instagram are not connected, so
          publishing remains manual.
        </p>
      </article>
    );
  };
  return (
    <main
      className="dashboard"
      style={{
        fontFamily: "Arial, sans-serif",
        minHeight: "100vh",
        background: "#f4f6f8",
        color: "#17345c",
      }}
    >
      <aside
        className="sidebar"
        style={{
          position: "fixed",
          inset: "0 auto 0 0",
          width: 250,
          background: "#102f5b",
          padding: 28,
          color: "white",
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 3 }}>
          COBS
        </div>
        <div style={{ fontSize: 13, letterSpacing: 2 }}>BUILDMASTERS LTD</div>
        <div
          style={{
            marginTop: 18,
            color: "#d9bc7b",
            fontSize: 11,
            letterSpacing: 1.5,
          }}
        >
          MARKETING AGENT
        </div>
        <nav aria-label="Workspace sections" style={{ marginTop: 34 }}>
          {modules.map((item) => (
            <button
              key={item}
              aria-current={active === item ? "page" : undefined}
              type="button"
              onClick={() => {
                setActive(item);
                if (item === "Creative Studio") {
                  setEditing(null);
                  setMediaId("");
                  setPostCampaign("");
                }
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                border: 0,
                margin: "4px 0",
                padding: "10px 12px",
                borderRadius: 6,
                cursor: "pointer",
                color: "#e0e9f5",
                background: active === item ? "#295182" : "transparent",
                fontSize: 15,
              }}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>
      <section
        className="workspace"
        style={{ marginLeft: 250, padding: 44, maxWidth: 1300 }}
      >
        <header
          className="workspace-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div>
            <p
              style={{
                color: "#b18b4a",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 1.4,
              }}
            >
              SECURE OWNER WORKSPACE
            </p>
            <h1 style={{ fontSize: 34, margin: "5px 0" }}>{active}</h1>
            <p className="muted">
              Build your brand with the same care as your projects.
            </p>
          </div>
          <div>
            <span style={{ fontSize: 13, marginRight: 12 }}>
              {session.user.email}
            </span>
            <button
              type="button"
              onClick={() => void loadWorkspace()}
              style={button}
            >
              Refresh
            </button>{" "}
            <button
              type="button"
              onClick={() => void supabase?.auth.signOut()}
              style={button}
            >
              Sign out
            </button>
          </div>
        </header>
        <div
          role="status"
          aria-live="polite"
          style={{
            background: "white",
            borderLeft: "4px solid #19865c",
            padding: 16,
            borderRadius: 5,
            margin: "25px 0",
          }}
        >
          ● {notice}
        </div>
        {panel()}
      </section>
    </main>
  );
}
