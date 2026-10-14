"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

type Status = "Draft" | "Pending approval" | "Approved" | "Scheduled" | "Rejected";
type Post = { id: string; title: string; body: string; status: Status; source: "ai" | "starter" | "manual"; created_at?: string };
type Campaign = { id: string; name: string; created_at?: string };
const modules = ["Overview", "Campaign Planner", "Content Calendar", "Creative Studio", "Approvals", "Scheduler", "Leads", "Settings"];
const card = { background: "#fff", borderRadius: 10, padding: 22, boxShadow: "0 1px 4px #cbd4df" };
const button = { background: "#17345c", color: "#fff", border: 0, borderRadius: 7, padding: "10px 14px", fontWeight: 700, cursor: "pointer" };
const input = { display: "block", width: "100%", margin: "8px 0 14px", padding: 10, boxSizing: "border-box" as const };

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
  const [title, setTitle] = useState("Build stronger with COBS concrete blocks");
  const [body, setBody] = useState("Quality concrete blocks and fast floors for your next construction project.");
  const [topic, setTopic] = useState("concrete blocks and fast floors");
  const [campaign, setCampaign] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!supabase) { setNotice("Supabase environment variables need attention."); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const loadWorkspace = async () => {
    if (!supabase || !session) return;
    setNotice("Loading secure workspace…");
    const [profileResult, postResult, campaignResult] = await Promise.all([
      supabase.from("cobs_profiles").select("role").eq("id", session.user.id).maybeSingle(),
      supabase.from("cobs_posts").select("*").order("created_at", { ascending: false }),
      supabase.from("cobs_campaigns").select("*").order("created_at", { ascending: false }),
    ]);
    if (profileResult.error || profileResult.data?.role !== "owner") {
      setRole(null); setNotice("This account is not authorised for the COBS owner workspace."); return;
    }
    if (postResult.error || campaignResult.error) { setNotice("Workspace data could not be loaded. Please refresh."); return; }
    setRole("owner"); setPosts((postResult.data || []) as Post[]); setCampaigns((campaignResult.data || []) as Campaign[]);
    setNotice("Secure Supabase workspace connected.");
  };

  useEffect(() => { if (session) void loadWorkspace(); else { setRole(null); setPosts([]); setCampaigns([]); } }, [session]);

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setNotice(authMode === "signIn" ? "Signing in…" : "Creating your secure owner account…");
    const result = authMode === "signIn"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    if (result.error) { setNotice(result.error.message); return; }
    setPassword("");
    setNotice(authMode === "signUp" ? "Account created. Check your email to confirm it, then sign in." : "Signed in. Loading workspace…");
  };

  const saveDraft = async (nextTitle = title, nextBody = body, source: Post["source"] = "manual") => {
    if (!supabase || !session || role !== "owner") { setNotice("Sign in as the COBS owner before saving content."); return; }
    const { data, error } = await supabase.from("cobs_posts").insert({ title: nextTitle.trim() || "Untitled COBS post", body: nextBody.trim() || "Add your campaign message here.", source, created_by: session.user.id }).select().single();
    if (error) { setNotice("Draft could not be saved: " + error.message); return; }
    setPosts((items) => [data as Post, ...items]); setActive("Content Calendar"); setNotice("Draft saved securely in Supabase.");
  };

  const updateStatus = async (id: string, status: Status) => {
    if (!supabase || role !== "owner") return;
    const update: { status: Status; scheduled_at?: string } = { status };
    if (status === "Scheduled") update.scheduled_at = new Date().toISOString();
    const { data, error } = await supabase.from("cobs_posts").update(update).eq("id", id).select().single();
    if (error) { setNotice("Post status could not be updated: " + error.message); return; }
    setPosts((items) => items.map((post) => post.id === id ? data as Post : post));
    setNotice(status === "Scheduled" ? "Post marked for manual publishing. Meta is not connected yet." : "Post status updated.");
  };

  const generate = async () => {
    setGenerating(true); setNotice("Generating your COBS post…");
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, platform: "Facebook and Instagram", objective: "brand visibility" }) });
      if (!response.ok) throw new Error();
      const result = await response.json() as { title: string; body: string; source: "ai" | "starter"; message?: string };
      setTitle(result.title); setBody(result.body); await saveDraft(result.title, result.body, result.source);
      if (result.source === "starter") setNotice(result.message || "Starter draft saved. AI generation needs available OpenAI credit.");
    } catch { setNotice("Generation could not start. Please try again."); }
    finally { setGenerating(false); }
  };

  const addCampaign = async () => {
    if (!supabase || !session || !campaign.trim()) return;
    const { data, error } = await supabase.from("cobs_campaigns").insert({ name: campaign.trim(), created_by: session.user.id }).select().single();
    if (error) { setNotice("Campaign could not be saved: " + error.message); return; }
    setCampaigns((items) => [data as Campaign, ...items]); setCampaign(""); setNotice("Campaign added securely.");
  };

  const addLead = async () => {
    if (!supabase || !session || !leadName.trim()) return;
    const { error } = await supabase.from("cobs_leads").insert({ name: leadName.trim(), phone: leadPhone.trim() || null, created_by: session.user.id });
    if (error) { setNotice("Lead could not be saved: " + error.message); return; }
    setLeadName(""); setLeadPhone(""); setNotice("Lead saved securely.");
  };

  if (!session || role !== "owner") return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f6f8", fontFamily: "Arial, sans-serif", color: "#17345c", padding: 20 }}><section style={{ ...card, width: "min(430px, 100%)" }}><div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 3 }}>COBS</div><p style={{ color: "#b18b4a", fontWeight: 700, letterSpacing: 1.2 }}>BUILDMASTERS MARKETING AGENT</p><h1>{authMode === "signIn" ? "Sign in to your workspace" : "Create the owner account"}</h1><p>{authMode === "signIn" ? "Use the authorised COBS owner email to open the private workspace." : "Use cobshomes@gmail.com. You will be asked to confirm the email before signing in."}</p><form onSubmit={submitAuth}><label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} /></label><label>Password<input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} /></label><button type="submit" style={button}>{authMode === "signIn" ? "Sign in" : "Create account"}</button></form><button type="button" onClick={() => setAuthMode(authMode === "signIn" ? "signUp" : "signIn")} style={{ border: 0, background: "none", color: "#17345c", marginTop: 16, cursor: "pointer", textDecoration: "underline" }}>{authMode === "signIn" ? "First time here? Create your owner account" : "Already have an account? Sign in"}</button><p role="status" style={{ color: "#536273", marginTop: 18 }}>● {notice}</p></section></main>;

  const drafts = posts.filter((p) => p.status === "Draft"), pending = posts.filter((p) => p.status === "Pending approval"), approved = posts.filter((p) => p.status === "Approved"), scheduled = posts.filter((p) => p.status === "Scheduled");
  const panel = () => {
    if (active === "Overview") return <><div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(140px,1fr))", gap: 16 }}>{[["Drafts", drafts.length], ["Awaiting approval", pending.length], ["Approved", approved.length], ["Scheduled", scheduled.length]].map(([label, value]) => <article key={String(label)} style={card}><div style={{ color: "#617187" }}>{label}</div><strong style={{ display: "block", fontSize: 32, marginTop: 10 }}>{value}</strong></article>)}</div><article style={{ ...card, marginTop: 18 }}><h2>Start creating content</h2><p>Every draft, campaign and lead is saved in the secure COBS Supabase workspace.</p><button type="button" onClick={() => setActive("Creative Studio")} style={button}>Open Creative Studio</button></article></>;
    if (active === "Creative Studio") return <article style={card}><h2>AI Content Generator</h2><p>Describe the product, service or campaign you want to promote.</p><label>Topic<input value={topic} onChange={(e) => setTopic(e.target.value)} style={input} /></label><button type="button" disabled={generating} onClick={generate} style={{ ...button, opacity: generating ? 0.65 : 1 }}>{generating ? "Generating…" : "Generate post idea"}</button><p style={{ color: "#617187" }}>Output is always saved as a draft for review. If OpenAI has no credit, a useful starter draft is created instead.</p></article>;
    if (active === "Content Calendar") return <article style={card}><h2>Content Calendar</h2><label>Post title<input value={title} onChange={(e) => setTitle(e.target.value)} style={input} /></label><label>Post copy<textarea value={body} onChange={(e) => setBody(e.target.value)} style={{ ...input, minHeight: 110 }} /></label><button type="button" onClick={() => void saveDraft()} style={button}>Save as draft</button><div style={{ marginTop: 24 }}>{posts.length === 0 ? <p>No content yet. Create a draft or use Creative Studio.</p> : posts.map((post) => <article key={post.id} style={{ borderTop: "1px solid #dce3ea", padding: "16px 0" }}><strong>{post.title}</strong><p>{post.body}</p><small>Status: {post.status} · {post.source === "ai" ? "AI generated" : post.source === "starter" ? "Starter draft" : "Manual"}</small><div style={{ marginTop: 10 }}>{post.status === "Draft" && <button type="button" onClick={() => void updateStatus(post.id, "Pending approval")} style={button}>Send for approval</button>}{post.status === "Approved" && <button type="button" onClick={() => void updateStatus(post.id, "Scheduled")} style={button}>Mark ready to publish</button>}</div></article>)}</div></article>;
    if (active === "Approvals") return <article style={card}><h2>Owner Approval Centre</h2>{pending.length === 0 ? <p>No posts are waiting for approval.</p> : pending.map((post) => <article key={post.id} style={{ borderTop: "1px solid #dce3ea", padding: "16px 0" }}><strong>{post.title}</strong><p>{post.body}</p><button type="button" onClick={() => void updateStatus(post.id, "Approved")} style={button}>Approve</button><button type="button" onClick={() => void updateStatus(post.id, "Rejected")} style={{ ...button, marginLeft: 8, background: "#8f3131" }}>Return for revision</button></article>)}</article>;
    if (active === "Campaign Planner") return <article style={card}><h2>Campaign Planner</h2><label>Campaign name<input value={campaign} onChange={(e) => setCampaign(e.target.value)} style={input} /></label><button type="button" onClick={() => void addCampaign()} style={button}>Add campaign</button>{campaigns.map((item) => <p key={item.id} style={{ borderTop: "1px solid #dce3ea", paddingTop: 12 }}><strong>{item.name}</strong></p>)}</article>;
    if (active === "Scheduler") return <article style={card}><h2>Publishing Readiness</h2>{approved.length ? approved.map((post) => <p key={post.id}><strong>{post.title}</strong> is approved and can be marked ready in Content Calendar.</p>) : <p>Approve a post first to make it publishing-ready.</p>}<p>{scheduled.length} post(s) marked ready. Meta is not connected, so no social post is published automatically.</p></article>;
    if (active === "Leads") return <article style={card}><h2>Lead Register</h2><label>Name<input value={leadName} onChange={(e) => setLeadName(e.target.value)} style={input} /></label><label>Phone<input value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} style={input} /></label><button type="button" onClick={() => void addLead()} style={button}>Save lead</button></article>;
    return <article style={card}><h2>Settings</h2><p>Supabase authentication and protected workspace data are active. AI generation will use OpenAI when the connected OpenAI account has available credit. Meta/Facebook/Instagram are not connected, so publishing remains manual.</p></article>;
  };
  return <main style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#f4f6f8", color: "#17345c" }}><aside style={{ position: "fixed", inset: "0 auto 0 0", width: 250, background: "#102f5b", padding: 28, color: "white" }}><div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 3 }}>COBS</div><div style={{ fontSize: 13, letterSpacing: 2 }}>BUILDMASTERS LTD</div><div style={{ marginTop: 18, color: "#d9bc7b", fontSize: 11, letterSpacing: 1.5 }}>MARKETING AGENT</div><nav aria-label="Workspace sections" style={{ marginTop: 34 }}>{modules.map((item) => <button key={item} type="button" onClick={() => setActive(item)} style={{ display: "block", width: "100%", textAlign: "left", border: 0, margin: "4px 0", padding: "10px 12px", borderRadius: 6, cursor: "pointer", color: "#e0e9f5", background: active === item ? "#295182" : "transparent", fontSize: 15 }}>{item}</button>)}</nav></aside><section style={{ marginLeft: 250, padding: 44, maxWidth: 1300 }}><header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}><div><p style={{ color: "#b18b4a", fontWeight: 700, fontSize: 12, letterSpacing: 1.4 }}>SECURE OWNER WORKSPACE</p><h1 style={{ fontSize: 34, margin: "5px 0" }}>{active}</h1></div><div><span style={{ fontSize: 13, marginRight: 12 }}>{session.user.email}</span><button type="button" onClick={() => void supabase?.auth.signOut()} style={button}>Sign out</button></div></header><div role="status" style={{ background: "white", borderLeft: "4px solid #19865c", padding: 16, borderRadius: 5, margin: "25px 0" }}>● {notice}</div>{panel()}</section></main>;
}
