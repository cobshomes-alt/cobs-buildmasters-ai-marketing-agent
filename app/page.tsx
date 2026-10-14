"use client";

import { useEffect, useState } from "react";

type Status = "Draft" | "Pending approval" | "Approved" | "Scheduled" | "Rejected";
type Post = { id: number; title: string; body: string; status: Status; source?: "ai" | "starter" };
const modules = ["Overview", "Campaign Planner", "Content Calendar", "Creative Studio", "Approvals", "Scheduler", "Analytics", "Leads", "Knowledge Base", "Settings"];
const card = { background: "#fff", borderRadius: 10, padding: 22, boxShadow: "0 1px 4px #cbd4df" };
const button = { background: "#17345c", color: "#fff", border: 0, borderRadius: 7, padding: "10px 14px", fontWeight: 700, cursor: "pointer" };

export default function Page() {
  const [active, setActive] = useState("Overview");
  const [notice, setNotice] = useState("Checking Supabase connection…");
  const [posts, setPosts] = useState<Post[]>([]);
  const [title, setTitle] = useState("Build stronger with COBS concrete blocks");
  const [body, setBody] = useState("Quality concrete blocks and fast floors for your next construction project.");
  const [topic, setTopic] = useState("concrete blocks and fast floors");
  const [generating, setGenerating] = useState(false);
  const [campaign, setCampaign] = useState("");
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const saveDraft = (nextTitle = title, nextBody = body, source?: Post["source"]) => {
    const post: Post = { id: Date.now(), title: nextTitle.trim() || "Untitled COBS post", body: nextBody.trim() || "Add your campaign message here.", status: "Draft", source };
    setPosts((items) => [post, ...items]); setActive("Content Calendar"); return post;
  };
  const updateStatus = (id: number, status: Status) => setPosts((items) => items.map((post) => post.id === id ? { ...post, status } : post));
  const generate = async () => {
    setGenerating(true); setNotice("Generating your COBS post…");
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, platform: "Facebook and Instagram", objective: "brand visibility" }) });
      if (!response.ok) throw new Error("Generation request failed");
      const result = await response.json() as { title: string; body: string; source: "ai" | "starter"; message?: string };
      setTitle(result.title); setBody(result.body); saveDraft(result.title, result.body, result.source);
      setNotice(result.source === "ai" ? "AI post generated and saved as a draft." : (result.message || "Starter draft created."));
    } catch { setNotice("Generation could not start. Please try again."); }
    finally { setGenerating(false); }
  };
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setNotice("Supabase connection needs attention"); return; }
    fetch(url + "/rest/v1/organizations?select=id&limit=1", { headers: { apikey: key } }).then((r) => r.ok && setNotice("Supabase connected — create your first campaign or content draft.")).catch(() => setNotice("Supabase connection needs attention"));
  }, []);
  const drafts = posts.filter((p) => p.status === "Draft"), pending = posts.filter((p) => p.status === "Pending approval"), approved = posts.filter((p) => p.status === "Approved");
  const panel = () => {
    if (active === "Overview") return <><div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(150px,1fr))", gap: 16 }}>{[["Drafts", drafts.length], ["Awaiting approval", pending.length], ["Approved", approved.length], ["Scheduled", posts.filter((p) => p.status === "Scheduled").length]].map(([label, value]) => <article key={String(label)} style={card}><div style={{ color: "#617187" }}>{label}</div><strong style={{ display: "block", fontSize: 32, marginTop: 10 }}>{value}</strong></article>)}</div><article style={{ ...card, marginTop: 18 }}><h2>Start creating content</h2><p>Generate an idea from Creative Studio or make a manual draft in your Content Calendar.</p><button type="button" onClick={() => setActive("Creative Studio")} style={button}>Open Creative Studio</button></article></>;
    if (active === "Creative Studio") return <article style={card}><h2>AI Content Generator</h2><p>Describe the product, service or campaign you want to promote.</p><label>Topic<input value={topic} onChange={(e) => setTopic(e.target.value)} style={{ display: "block", width: "100%", margin: "8px 0 16px", padding: 10 }} /></label><button type="button" disabled={generating} onClick={generate} style={{ ...button, opacity: generating ? 0.65 : 1 }}>{generating ? "Generating…" : "Generate post idea"}</button><p style={{ marginTop: 14, color: "#617187" }}>AI output is saved as a draft for your review; it is never published automatically.</p></article>;
    if (active === "Content Calendar") return <article style={card}><h2>Content Calendar</h2><label>Post title<input value={title} onChange={(e) => setTitle(e.target.value)} style={{ display: "block", width: "100%", margin: "8px 0 14px", padding: 10 }} /></label><label>Post copy<textarea value={body} onChange={(e) => setBody(e.target.value)} style={{ display: "block", width: "100%", minHeight: 100, margin: "8px 0 14px", padding: 10 }} /></label><button type="button" onClick={() => { saveDraft(); setNotice("Manual draft saved."); }} style={button}>Save as draft</button><div style={{ marginTop: 24 }}>{posts.length === 0 ? <p>No content yet. Create a manual draft or use Creative Studio.</p> : posts.map((post) => <article key={post.id} style={{ borderTop: "1px solid #dce3ea", padding: "16px 0" }}><strong>{post.title}</strong><p>{post.body}</p><small>Status: {post.status}{post.source ? " · " + (post.source === "ai" ? "AI generated" : "Starter draft") : ""}</small><div style={{ marginTop: 10 }}>{post.status === "Draft" && <button type="button" onClick={() => { updateStatus(post.id, "Pending approval"); setNotice("Post sent to the Approval Queue."); }} style={button}>Send for approval</button>}{post.status === "Approved" && <button type="button" onClick={() => { updateStatus(post.id, "Scheduled"); setNotice("Post scheduled for manual publishing review."); }} style={button}>Schedule post</button>}</div></article>)}</div></article>;
    if (active === "Approvals") return <article style={card}><h2>Owner Approval Centre</h2>{pending.length === 0 ? <p>No posts are waiting for approval.</p> : pending.map((post) => <article key={post.id} style={{ borderTop: "1px solid #dce3ea", padding: "16px 0" }}><strong>{post.title}</strong><p>{post.body}</p><button type="button" onClick={() => { updateStatus(post.id, "Approved"); setNotice("Post approved. It can now be scheduled."); }} style={button}>Approve</button><button type="button" onClick={() => { updateStatus(post.id, "Rejected"); setNotice("Post returned for revision."); }} style={{ ...button, marginLeft: 8, background: "#8f3131" }}>Return for revision</button></article>)}</article>;
    if (active === "Campaign Planner") return <article style={card}><h2>Campaign Planner</h2><label>Campaign name<input value={campaign} onChange={(e) => setCampaign(e.target.value)} style={{ display: "block", width: "100%", margin: "8px 0 14px", padding: 10 }} /></label><button type="button" onClick={() => { if (campaign.trim()) { setCampaigns((items) => [campaign, ...items]); setCampaign(""); setNotice("Campaign added to your plan."); } }} style={button}>Add campaign</button>{campaigns.map((item) => <p key={item} style={{ borderTop: "1px solid #dce3ea", paddingTop: 12 }}><strong>{item}</strong></p>)}</article>;
    if (active === "Scheduler") return <article style={card}><h2>Publishing Scheduler</h2>{approved.length ? approved.map((post) => <p key={post.id}><strong>{post.title}</strong> is approved and available to schedule in the Content Calendar.</p>) : <p>Approve a post first to make it ready for scheduling.</p>}<p>{posts.filter((p) => p.status === "Scheduled").length} post(s) scheduled.</p></article>;
    if (active === "Analytics") return <article style={card}><h2>Analytics</h2><p>Real performance metrics will appear after official Facebook or Instagram accounts are connected.</p></article>;
    if (active === "Leads") return <article style={card}><h2>Lead Register</h2><p>Customer enquiries will appear here after your lead capture source is connected.</p></article>;
    if (active === "Knowledge Base") return <article style={card}><h2>Brand Knowledge Base</h2><p>Use verified COBS products, services, contact details and approved claims for safe content generation.</p></article>;
    return <article style={card}><h2>Settings</h2><p>Supabase is connected. Add a secure OPENAI_API_KEY in Vercel to activate live AI generation.</p></article>;
  };
  return <main style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#f4f6f8", color: "#17345c" }}><aside style={{ position: "fixed", inset: "0 auto 0 0", width: 250, background: "#102f5b", padding: 28, color: "white" }}><div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 3 }}>COBS</div><div style={{ fontSize: 13, letterSpacing: 2 }}>BUILDMASTERS LTD</div><div style={{ marginTop: 18, color: "#d9bc7b", fontSize: 11, letterSpacing: 1.5 }}>MARKETING AGENT</div><nav aria-label="Workspace sections" style={{ marginTop: 34 }}>{modules.map((item) => <button key={item} type="button" onClick={() => setActive(item)} style={{ display: "block", width: "100%", textAlign: "left", border: 0, margin: "4px 0", padding: "10px 12px", borderRadius: 6, cursor: "pointer", color: "#e0e9f5", background: active === item ? "#295182" : "transparent", fontSize: 15 }}>{item}</button>)}</nav></aside><section style={{ marginLeft: 250, padding: 44, maxWidth: 1300 }}><header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}><div><p style={{ color: "#b18b4a", fontWeight: 700, fontSize: 12, letterSpacing: 1.4 }}>PRIVATE WORKSPACE</p><h1 style={{ fontSize: 34, margin: "5px 0" }}>{active}</h1></div><button type="button" onClick={() => { saveDraft(); setNotice("Manual draft created."); }} style={button}>+ Create content</button></header><div role="status" style={{ background: "white", borderLeft: "4px solid #19865c", padding: 16, borderRadius: 5, margin: "25px 0" }}>● {notice}</div>{panel()}</section></main>;
}
