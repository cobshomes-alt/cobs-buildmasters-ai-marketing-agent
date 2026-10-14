export const dynamic = "force-dynamic";

export default async function Page() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let connected = false;
  if (url && key) {
    try {
      const response = await fetch(url + "/rest/v1/organizations?select=id&limit=1", { headers: { apikey: key }, cache: "no-store" });
      connected = response.ok;
    } catch {}
  }
  return <main style={{fontFamily:"Arial, sans-serif",minHeight:"100vh",background:"#f4f6f8",color:"#17345c"}}>
    <aside style={{position:"fixed",inset:"0 auto 0 0",width:250,background:"#102f5b",padding:28,color:"white"}}>
      <div style={{fontSize:34,fontWeight:900,letterSpacing:3}}>COBS</div><div style={{fontSize:13,letterSpacing:2}}>BUILDMASTERS LTD</div><div style={{marginTop:18,color:"#d9bc7b",fontSize:11,letterSpacing:1.5}}>MARKETING AGENT</div>
      <nav style={{marginTop:34,lineHeight:2.55,color:"#d4dfed"}}>{["Overview","Campaign Planner","Content Calendar","Creative Studio","Approvals","Scheduler","Analytics","Leads","Knowledge Base","Settings"].map((item) => <div key={item} style={item === "Overview" ? {background:"#295182",borderRadius:6,padding:"0 12px"} : {padding:"0 12px"}}>{item}</div>)}</nav>
    </aside>
    <section style={{marginLeft:250,padding:44,maxWidth:1300}}><p style={{color:"#b18b4a",fontWeight:700,fontSize:12,letterSpacing:1.4}}>PRIVATE WORKSPACE</p><h1 style={{fontSize:34,marginTop:5}}>Overview</h1>
      <div style={{background:"white",borderLeft:"4px solid " + (connected ? "#19865c" : "#c43b3b"),padding:16,borderRadius:5,margin:"25px 0"}}>{connected ? "● Supabase connected — secure workspace ready" : "● Supabase connection needs attention"}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(150px,1fr))",gap:16}}>{[["Posts requiring approval","0","Live database ready"],["Approved and ready","0","Protected queue gate"],["Connected accounts","—","No accounts connected"],["Marketing spend","—","Set monthly budget in Settings"]].map(([title,value,note]) => <article key={title} style={{background:"white",borderRadius:8,padding:20,boxShadow:"0 1px 3px #ccd3dc"}}><div style={{color:"#617187"}}>{title}</div><strong style={{display:"block",fontSize:31,margin:"12px 0"}}>{value}</strong><small style={{color:"#7a899b"}}>{note}</small></article>)}</div>
      <article style={{marginTop:18,background:"white",borderRadius:8,padding:24,boxShadow:"0 1px 3px #ccd3dc"}}><p style={{fontSize:12,color:"#b18b4a",fontWeight:700,letterSpacing:1.3}}>APPROVAL SAFEGUARD</p><h2>Content review</h2><p>Welcome COBS Buildmasters Ltd</p><small>Version 1. Editing an approved post automatically invalidates approval.</small></article>
    </section>
  </main>;
}

// Trigger deployment after linking this repository to Vercel.
