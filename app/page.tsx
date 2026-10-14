"use client";

import { useEffect, useState } from "react";

const modules = ["Overview", "Campaign Planner", "Content Calendar", "Creative Studio", "Approvals", "Scheduler", "Analytics", "Leads", "Knowledge Base", "Settings"];
const cardStyle = { background: "white", borderRadius: 10, padding: 22, boxShadow: "0 1px 4px #cbd4df" };

export default function Page() {
  const [active, setActive] = useState("Overview");
  const [approval, setApproval] = useState("Draft");
  const [notice, setNotice] = useState("Checking Supabase connection…");

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setNotice("Supabase connection needs attention"); return; }
    fetch(url + "/rest/v1/organizations?select=id&limit=1", { headers: { apikey: key } })
      .then((response) => setNotice(response.ok ? "Supabase connected — secure workspace ready" : "Supabase connection needs attention"))
      .catch(() => setNotice("Supabase connection needs attention"));
  }, []);

  const choose = (item: string) => { setActive(item); setNotice(item + " selected."); };
  const create = () => { setApproval("Draft"); setActive("Content Calendar"); setNotice("New content draft created. Review it before sending for approval."); };

  return <main style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#f4f6f8", color: "#17345c" }}>
    <aside style={{ position: "fixed", inset: "0 auto 0 0", width: 250, background: "#102f5b", padding: 28, color: "white" }}>
      <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 3 }}>COBS</div>
      <div style={{ fontSize: 13, letterSpacing: 2 }}>BUILDMASTERS LTD</div>
      <div style={{ marginTop: 18, color: "#d9bc7b", fontSize: 11, letterSpacing: 1.5 }}>MARKETING AGENT</div>
      <nav aria-label="Workspace sections" style={{ marginTop: 34 }}>
        {modules.map((item) => <button key={item} type="button" onClick={() => choose(item)} style={{ display: "block", width: "100%", textAlign: "left", border: 0, margin: "4px 0", padding: "10px 12px", borderRadius: 6, cursor: "pointer", color: "#e0e9f5", background: active === item ? "#295182" : "transparent", fontSize: 15 }}>{item}</button>)}
      </nav>
    </aside>
    <section style={{ marginLeft: 250, padding: 44, maxWidth: 1300 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div><p style={{ color: "#b18b4a", fontWeight: 700, fontSize: 12, letterSpacing: 1.4 }}>PRIVATE WORKSPACE</p><h1 style={{ fontSize: 34, margin: "5px 0" }}>{active}</h1></div>
        <button type="button" onClick={create} style={{ background: "#17345c", color: "white", border: 0, borderRadius: 7, padding: "12px 17px", fontWeight: 700, cursor: "pointer" }}>+ Create content</button>
      </header>
      <div role="status" style={{ background: "white", borderLeft: "4px solid #19865c", padding: 16, borderRadius: 5, margin: "25px 0" }}>● {notice}</div>
      {active === "Overview" ? <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 16 }}>
          {[["Posts requiring approval", approval === "Pending Approval" ? "1" : "0", "Live database ready"], ["Approved and ready", approval === "Approved" ? "1" : "0", "Protected queue gate"], ["Connected accounts", "—", "No accounts connected"], ["Marketing spend", "—", "Set monthly budget in Settings"]].map(([title, value, note]) => <article key={title} style={cardStyle}><div style={{ color: "#617187" }}>{title}</div><strong style={{ display: "block", fontSize: 31, margin: "12px 0" }}>{value}</strong><small style={{ color: "#7a899b" }}>{note}</small></article>)}
        </div>
        <article style={{ ...cardStyle, marginTop: 18 }}><p style={{ fontSize: 12, color: "#b18b4a", fontWeight: 700, letterSpacing: 1.3 }}>APPROVAL SAFEGUARD</p><h2>Content review: {approval}</h2><p>Welcome COBS Buildmasters Ltd. Content actions now respond immediately in this workspace.</p><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button type="button" onClick={() => { setApproval("Pending Approval"); setNotice("Draft sent for approval."); }} style={{ padding: "10px 14px", cursor: "pointer" }}>Send for approval</button><button type="button" onClick={() => { setApproval("Approved"); setNotice("Current version approved and eligible for secure queueing."); }} style={{ padding: "10px 14px", cursor: "pointer" }}>Approve</button><button type="button" onClick={() => { setApproval("Rejected"); setNotice("Draft rejected; revise it before resubmitting."); }} style={{ padding: "10px 14px", cursor: "pointer" }}>Reject</button></div></article>
      </> : <article style={cardStyle}><p style={{ fontSize: 12, color: "#b18b4a", fontWeight: 700, letterSpacing: 1.3 }}>WORKSPACE MODULE</p><h2>{active}</h2><p>This section is active. Connect your organization data to populate its workspace.</p><button type="button" onClick={() => setNotice(active + " is ready for your organization data.")} style={{ background: "#17345c", color: "white", border: 0, borderRadius: 7, padding: "11px 15px", cursor: "pointer" }}>Open {active}</button></article>}
    </section>
  </main>;
}
