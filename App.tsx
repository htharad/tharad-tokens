import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://suvnulhadjhliqcyclzl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1dm51bGhhZGpobGlxY3ljbHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjAxNDQsImV4cCI6MjA5MTc5NjE0NH0.jRDs3neRTlGM58tnNb9ulinQTxwOmD1V_RI2xhYFVQI"
);

const PRIORITIES: string[] = ["High", "Medium", "Low"];
const CATEGORIES: string[] = ["Production", "Maintenance", "Dispatch", "Raw Materials", "Attendance", "Quality", "Other"];
const PRIORITY_COLOR: Record<string, string> = { High: "#FF4D4D", Medium: "#F59E0B", Low: "#6EE7B7" };
const STATUS_META: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  Open:       { color: "#F59E0B", bg: "#2D2500", dot: "#F59E0B", label: "OPEN" },
  Closed:     { color: "#10B981", bg: "#022C22", dot: "#10B981", label: "CLOSED" },
  Incomplete: { color: "#EF4444", bg: "#2D0A0A", dot: "#EF4444", label: "INCOMPLETE" },
};

interface Remark { text: string; time: string; }
interface Token {
  id: string;
  title: string;
  description: string;
  priority: string;
  category: string;
  deadline: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  remarks: Remark[];
}

function genId(): string {
  const d = new Date();
  const dp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  return `TKN-${dp}-${Math.floor(1000+Math.random()*9000)}`;
}
function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}
function fmtDate(d: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}
function startOf(unit: string): Date {
  const d = new Date();
  if (unit === "day")   { d.setHours(0,0,0,0); }
  if (unit === "week")  { d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay()); }
  if (unit === "month") { d.setDate(1); d.setHours(0,0,0,0); }
  if (unit === "year")  { d.setMonth(0,1); d.setHours(0,0,0,0); }
  return d;
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ background:bg, color, fontSize:10, fontFamily:"monospace", fontWeight:700, letterSpacing:2, padding:"3px 10px", borderRadius:20 }}>{label}</span>;
}

function BarChart({ data, colorFn }: { data: Record<string, number>; colorFn?: (k: string) => string }) {
  const max = Math.max(...Object.values(data), 1);
  const entries = Object.entries(data).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  if (!entries.length) return <div style={{fontSize:12,color:"#4B5563"}}>No data</div>;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {entries.map(([k,v])=>(
        <div key={k} style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:100,fontSize:11,color:"#9CA3AF",textAlign:"right",flexShrink:0}}>{k}</div>
          <div style={{flex:1,background:"#1F2937",borderRadius:4,height:16,overflow:"hidden"}}>
            <div style={{width:`${(v/max)*100}%`,background:colorFn?colorFn(k):"#F59E0B",height:"100%",borderRadius:4,transition:"width .4s ease"}} />
          </div>
          <div style={{width:24,fontSize:12,color:"#E2E8F0",fontFamily:"monospace",fontWeight:700}}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{display:"flex",flexDirection:"column",gap:6}}>
      <span style={{fontSize:10,color:"#6B7280",letterSpacing:2,textTransform:"uppercase"}}>{label}</span>
      {children}
    </label>
  );
}

function Spinner() {
  return (
    <div style={{background:"#030712",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:36,height:36,border:"3px solid #1F2937",borderTop:"3px solid #F59E0B",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
      <div style={{color:"#F59E0B",fontFamily:"monospace",fontSize:13,letterSpacing:3}}>CONNECTING...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const inp: React.CSSProperties = { background:"#030712", border:"1px solid #1F2937", borderRadius:8, color:"#E2E8F0", padding:"10px 13px", fontSize:13, width:"100%", outline:"none", fontFamily:"inherit" };
function nbtn(active: boolean, highlight: boolean = false): React.CSSProperties {
  return { background:highlight?"#F59E0B":active?"#1F2937":"transparent", color:highlight?"#000":active?"#F1F5F9":"#6B7280", border:highlight?"none":`1px solid ${active?"#374151":"#1F2937"}`, borderRadius:6, padding:"7px 15px", cursor:"pointer", fontSize:11, fontWeight:700, letterSpacing:1, textTransform:"uppercase" };
}
function abtn(color: string, outline: boolean = false): React.CSSProperties {
  return { flex:1, background:outline?"transparent":color, color:outline?color:"#fff", border:`1px solid ${color}`, borderRadius:8, padding:"12px", fontWeight:700, fontSize:12, cursor:"pointer" };
}

export default function App() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [catFilter, setCatFilter] = useState("All");
  const [form, setForm] = useState({ title:"", description:"", priority:"Medium", category:"Production", deadline:"" });
  const [remarkDraft, setRemarkDraft] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [reportPeriod, setReportPeriod] = useState("week");
  const [saving, setSaving] = useState(false);

  async function fetchTokens() {
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setTokens([...(data as Token[])]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 3000);
    return () => clearInterval(interval);
  }, []);

  function showToast(msg: string, type: string = "ok") {
    setToast({msg,type});
    setTimeout(()=>setToast(null), 2500);
  }

  async function createToken() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const t: Omit<Token, "created_at"> & { created_at?: string } = {
        id: genId(),
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        category: form.category,
        deadline: form.deadline,
        status: "Open",
        closed_at: null,
        remarks: []
      };
      const { error } = await supabase.from("tokens").insert([t]);
      if (error) throw error;
      setForm({ title:"", description:"", priority:"Medium", category:"Production", deadline:"" });
      setView("dashboard");
      showToast(`Token ${t.id} generated`);
    } catch(e: any) {
      console.error("Save error:", e);
      showToast(`Error: ${e.message}`, "warn");
    }
    setSaving(false);
  }

  async function updateToken(id: string, updates: Partial<Token>) {
    try {
      const { error } = await supabase.from("tokens").update(updates).eq("id", id);
      if (error) throw error;
    } catch(e: any) {
      showToast(`Error: ${e.message}`, "warn");
    }
  }

  function closeToken(token: Token) { updateToken(token.id, { status:"Closed", closed_at: new Date().toISOString() }); showToast("Task closed ✓"); }
  function markIncomplete(token: Token) { updateToken(token.id, { status:"Incomplete" }); showToast("Marked incomplete","warn"); }
  function reopenToken(token: Token) { updateToken(token.id, { status:"Open", closed_at: null }); showToast("Token reopened"); }

  function addRemark(token: Token) {
    const text = (remarkDraft[token.id] || "").trim();
    if (!text) return;
    const updated = [...(token.remarks || []), { text, time: new Date().toISOString() }];
    updateToken(token.id, { remarks: updated });
    setRemarkDraft(p => ({...p, [token.id]: ""}));
    showToast("Remark saved");
  }

  const counts = { All:tokens.length, Open:tokens.filter(t=>t.status==="Open").length, Closed:tokens.filter(t=>t.status==="Closed").length, Incomplete:tokens.filter(t=>t.status==="Incomplete").length };
  const displayed = tokens.filter(t=>statusFilter==="All"||t.status===statusFilter).filter(t=>catFilter==="All"||t.category===catFilter);
  const selected = tokens.find(t=>t.id===selectedId);

  const rStart = startOf(reportPeriod).getTime();
  const rTokens = tokens.filter(t=>new Date(t.created_at).getTime()>=rStart);
  const rClosed = rTokens.filter(t=>t.status==="Closed").length;
  const rIncomplete = rTokens.filter(t=>t.status==="Incomplete").length;
  const rOpen = rTokens.filter(t=>t.status==="Open").length;
  const rRate = rTokens.length ? Math.round((rClosed/rTokens.length)*100) : 0;
  const rByCat = CATEGORIES.reduce((a,c)=>({...a,[c]:rTokens.filter(t=>t.category===c).length}),{} as Record<string,number>);
  const rByPri = PRIORITIES.reduce((a,p)=>({...a,[p]:rTokens.filter(t=>t.priority===p).length}),{} as Record<string,number>);

  if (loading) return <Spinner />;

  return (
    <div style={{minHeight:"100vh",background:"#030712",fontFamily:"'Trebuchet MS',sans-serif",color:"#E2E8F0"}}>
      {toast && (
        <div style={{position:"fixed",top:16,right:16,zIndex:9999,background:toast.type==="warn"?"#78350F":"#064E3B",color:"#fff",padding:"11px 18px",borderRadius:8,fontSize:12,fontFamily:"monospace",letterSpacing:1,boxShadow:"0 8px 32px rgba(0,0,0,.5)",animation:"pop .2s ease"}}>
          {toast.msg}
        </div>
      )}

      <div style={{background:"#030712",borderBottom:"1px solid #111827",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1000,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:58}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:30,height:30,background:"#F59E0B",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center"}}>🏭</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,letterSpacing:3,color:"#F1F5F9",textTransform:"uppercase"}}>Tharad Fabrics</div>
              <div style={{fontSize:9,color:"#374151",letterSpacing:3,textTransform:"uppercase"}}>Task Token System</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button onClick={()=>{setView("dashboard");setSelectedId(null);}} style={nbtn(view==="dashboard")}>Dashboard</button>
            <button onClick={()=>setView("reports")} style={nbtn(view==="reports")}>Reports</button>
            <button onClick={()=>setView("create")} style={nbtn(view==="create",true)}>+ New Token</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1000,margin:"0 auto",padding:"24px 24px 60px"}}>

        {/* DASHBOARD */}
        {view==="dashboard" && !selectedId && (<>
          <div style={{display:"flex",gap:10,marginBottom:24}}>
            {([{icon:"📋",label:"Total",key:"All",color:"#94A3B8"},{icon:"⏳",label:"Open",key:"Open",color:"#F59E0B"},{icon:"✅",label:"Closed",key:"Closed",color:"#10B981"},{icon:"⚠️",label:"Incomplete",key:"Incomplete",color:"#EF4444"}] as any[]).map((s:any)=>(
              <button key={s.key} onClick={()=>setStatusFilter(s.key)} style={{background:statusFilter===s.key?"#1E293B":"#0D1117",border:`1px solid ${statusFilter===s.key?s.color:"#1F2937"}`,borderRadius:12,padding:"16px 12px",cursor:"pointer",textAlign:"left",flex:1,transition:"all .15s"}}>
                <div style={{fontSize:20,marginBottom:6}}>{s.icon}</div>
                <div style={{fontSize:26,fontWeight:700,color:s.color,fontFamily:"monospace"}}>{counts[s.key as keyof typeof counts]}</div>
                <div style={{fontSize:10,color:"#6B7280",letterSpacing:2,textTransform:"uppercase",marginTop:4}}>{s.label}</div>
              </button>
            ))}
          </div>
          <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:10,color:"#4B5563",letterSpacing:2,textTransform:"uppercase",marginRight:4}}>Category:</span>
            {["All",...CATEGORIES].map(c=>(
              <button key={c} onClick={()=>setCatFilter(c)} style={{background:catFilter===c?"#1F2937":"transparent",color:catFilter===c?"#E2E8F0":"#6B7280",border:`1px solid ${catFilter===c?"#374151":"#1F2937"}`,borderRadius:20,padding:"4px 12px",fontSize:11,cursor:"pointer"}}>{c}</button>
            ))}
          </div>
          {displayed.length===0 ? (
            <div style={{textAlign:"center",padding:"64px 0",color:"#374151"}}>
              <div style={{fontSize:40,marginBottom:12}}>📋</div>
              <div style={{fontSize:12,letterSpacing:3,textTransform:"uppercase"}}>No tokens found</div>
              <button onClick={()=>setView("create")} style={{marginTop:16,background:"#F59E0B",color:"#000",border:"none",borderRadius:6,padding:"10px 22px",cursor:"pointer",fontWeight:700,fontSize:12}}>Generate First Token</button>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {displayed.map(token=>{
                const meta=STATUS_META[token.status];
                const overdue=token.deadline&&token.status==="Open"&&new Date(token.deadline)<new Date();
                return (
                  <div key={token.id} onClick={()=>{setSelectedId(token.id);setView("detail");}}
                    style={{background:"#0D1117",border:`1px solid ${overdue?"#7F1D1D":"#1F2937"}`,borderRadius:10,padding:"14px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,transition:"border-color .15s"}}
                    onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor="#F59E0B"}
                    onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=overdue?"#7F1D1D":"#1F2937"}
                  >
                    <div style={{width:8,height:8,borderRadius:"50%",background:meta.dot,flexShrink:0}} />
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",gap:8,marginBottom:4,flexWrap:"wrap",alignItems:"center"}}>
                        <span style={{fontFamily:"monospace",fontSize:11,color:"#F59E0B",letterSpacing:1}}>{token.id}</span>
                        <span style={{fontSize:10,color:PRIORITY_COLOR[token.priority],border:`1px solid ${PRIORITY_COLOR[token.priority]}44`,borderRadius:4,padding:"1px 6px"}}>{token.priority}</span>
                        <span style={{fontSize:10,color:"#6B7280",border:"1px solid #1F2937",borderRadius:4,padding:"1px 6px"}}>{token.category}</span>
                        {token.remarks&&token.remarks.length>0&&<span style={{fontSize:10,color:"#4B5563"}}>💬 {token.remarks.length}</span>}
                        {overdue&&<span style={{fontSize:10,color:"#EF4444",background:"#2D0A0A",borderRadius:4,padding:"1px 6px"}}>OVERDUE</span>}
                      </div>
                      <div style={{fontSize:13,color:"#F1F5F9",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{token.title}</div>
                      <div style={{fontSize:10,color:"#4B5563",marginTop:3}}>Created {fmt(token.created_at)}{token.deadline?` · Due ${fmtDate(token.deadline)}`:""}</div>
                    </div>
                    <Badge label={meta.label} color={meta.color} bg={meta.bg} />
                  </div>
                );
              })}
            </div>
          )}
        </>)}

        {/* CREATE */}
        {view==="create" && (
          <div style={{maxWidth:560,margin:"0 auto"}}>
            <div style={{marginBottom:22}}>
              <div style={{fontSize:10,color:"#F59E0B",letterSpacing:3,textTransform:"uppercase",marginBottom:4}}>New Task Token</div>
              <div style={{fontSize:22,color:"#F1F5F9",fontWeight:700}}>Generate a Token</div>
            </div>
            <div style={{background:"#0D1117",border:"1px solid #1F2937",borderRadius:12,padding:26,display:"flex",flexDirection:"column",gap:18}}>
              <Field label="Task Title *">
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Check loom #5 tension" style={inp} />
              </Field>
              <Field label="Description">
                <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Detailed instructions for supervisor..." rows={3} style={{...inp,resize:"vertical"}} />
              </Field>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <Field label="Priority">
                  <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={inp}>
                    {PRIORITIES.map(p=><option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Category">
                  <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={inp}>
                    {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Deadline (optional)">
                <input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={inp} />
              </Field>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button onClick={createToken} disabled={!form.title.trim()||saving} style={{flex:1,background:form.title.trim()&&!saving?"#F59E0B":"#1F2937",color:form.title.trim()&&!saving?"#000":"#6B7280",border:"none",borderRadius:8,padding:"13px",fontWeight:700,fontSize:13,cursor:form.title.trim()&&!saving?"pointer":"not-allowed",letterSpacing:1}}>
                  {saving?"Saving...":"🎫 Generate Token"}
                </button>
                <button onClick={()=>setView("dashboard")} style={{padding:"13px 18px",background:"transparent",color:"#6B7280",border:"1px solid #1F2937",borderRadius:8,cursor:"pointer",fontSize:12}}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* DETAIL */}
        {view==="detail" && selected && (()=>{
          const meta=STATUS_META[selected.status];
          const overdue=selected.deadline&&selected.status==="Open"&&new Date(selected.deadline)<new Date();
          return (
            <div style={{maxWidth:660,margin:"0 auto"}}>
              <button onClick={()=>{setView("dashboard");setSelectedId(null);}} style={{background:"transparent",border:"none",color:"#F59E0B",cursor:"pointer",fontSize:12,marginBottom:18,padding:0,letterSpacing:1}}>← Back</button>
              <div style={{background:"#0D1117",border:`1px solid ${overdue?"#7F1D1D":"#1F2937"}`,borderRadius:12,padding:26,marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
                  <div>
                    <div style={{fontFamily:"monospace",fontSize:12,color:"#F59E0B",letterSpacing:2,marginBottom:6}}>{selected.id}</div>
                    <div style={{fontSize:20,color:"#F1F5F9",fontWeight:700,lineHeight:1.3}}>{selected.title}</div>
                  </div>
                  <Badge label={meta.label} color={meta.color} bg={meta.bg} />
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
                  {[{label:"Priority",value:selected.priority,color:PRIORITY_COLOR[selected.priority]},{label:"Category",value:selected.category,color:"#94A3B8"},{label:"Deadline",value:fmtDate(selected.deadline),color:overdue?"#EF4444":"#94A3B8"}].map(m=>(
                    <div key={m.label} style={{background:"#030712",borderRadius:8,padding:"10px 14px"}}>
                      <div style={{fontSize:9,color:"#374151",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>{m.label}</div>
                      <div style={{fontSize:13,color:m.color,fontWeight:700}}>{m.value}</div>
                    </div>
                  ))}
                </div>
                {selected.description&&(
                  <div style={{background:"#030712",borderRadius:8,padding:"13px 15px",marginBottom:18}}>
                    <div style={{fontSize:9,color:"#374151",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Description</div>
                    <div style={{fontSize:13,color:"#9CA3AF",lineHeight:1.7}}>{selected.description}</div>
                  </div>
                )}
                <div style={{fontSize:11,color:"#374151",display:"flex",gap:20,marginBottom:22}}>
                  <span>Created: {fmt(selected.created_at)}</span>
                  {selected.closed_at&&<span>Closed: {fmt(selected.closed_at)}</span>}
                </div>
                {selected.status==="Open"&&(
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={()=>closeToken(selected)} style={abtn("#10B981")}>✅ Close Token — Task Complete</button>
                    <button onClick={()=>markIncomplete(selected)} style={abtn("#EF4444",true)}>⚠️ Mark Incomplete</button>
                  </div>
                )}
                {selected.status!=="Open"&&(
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{background:selected.status==="Closed"?"#022C22":"#2D0A0A",color:selected.status==="Closed"?"#10B981":"#EF4444",padding:"10px 16px",borderRadius:8,fontSize:13,fontWeight:700}}>
                      {selected.status==="Closed"?"✅ Task Completed":"⚠️ Task Incomplete"}
                    </div>
                    <button onClick={()=>reopenToken(selected)} style={{background:"transparent",border:"1px solid #1F2937",color:"#6B7280",borderRadius:8,padding:"10px 14px",cursor:"pointer",fontSize:12}}>Reopen</button>
                  </div>
                )}
              </div>
              <div style={{background:"#0D1117",border:"1px solid #1F2937",borderRadius:12,padding:22}}>
                <div style={{fontSize:10,color:"#F59E0B",letterSpacing:3,textTransform:"uppercase",marginBottom:14}}>💬 Supervisor Remarks</div>
                {(!selected.remarks||selected.remarks.length===0)
                  ?<div style={{color:"#374151",fontSize:13,marginBottom:14,fontStyle:"italic"}}>No remarks yet.</div>
                  :<div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
                    {selected.remarks.map((r,i)=>(
                      <div key={i} style={{background:"#030712",borderRadius:8,padding:"12px 15px",borderLeft:"3px solid #F59E0B"}}>
                        <div style={{fontSize:13,color:"#CBD5E1",lineHeight:1.6}}>{r.text}</div>
                        <div style={{fontSize:10,color:"#374151",marginTop:6}}>{fmt(r.time)}</div>
                      </div>
                    ))}
                  </div>
                }
                <div style={{display:"flex",gap:10}}>
                  <textarea value={remarkDraft[selected.id]||""} onChange={e=>setRemarkDraft(p=>({...p,[selected.id]:e.target.value}))} placeholder="Add remark or reason for incomplete task..." rows={2} style={{...inp,flex:1,resize:"none",fontSize:13}} />
                  <button onClick={()=>addRemark(selected)} style={{background:"#1F2937",color:"#E2E8F0",border:"none",borderRadius:8,padding:"0 16px",cursor:"pointer",fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}>Add →</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* REPORTS */}
        {view==="reports" && (
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
              <div>
                <div style={{fontSize:10,color:"#F59E0B",letterSpacing:3,textTransform:"uppercase",marginBottom:4}}>Analytics</div>
                <div style={{fontSize:22,color:"#F1F5F9",fontWeight:700}}>Reports</div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {(["day","week","month","year"] as const).map(p=>(
                  <button key={p} onClick={()=>setReportPeriod(p)} style={{background:reportPeriod===p?"#1F2937":"transparent",color:reportPeriod===p?"#F59E0B":"#6B7280",border:`1px solid ${reportPeriod===p?"#374151":"#1F2937"}`,borderRadius:6,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:700,letterSpacing:1}}>
                    {p==="day"?"Today":p==="week"?"This Week":p==="month"?"This Month":"This Year"}
                  </button>
                ))}
              </div>
            </div>
            {rTokens.length===0?(
              <div style={{textAlign:"center",padding:"60px 0",color:"#374151"}}>
                <div style={{fontSize:36,marginBottom:12}}>📊</div>
                <div style={{fontSize:12,letterSpacing:2,textTransform:"uppercase"}}>No data for this period</div>
              </div>
            ):(<>
              <div style={{display:"flex",gap:10,marginBottom:20}}>
                {[{icon:"📋",label:"Total",value:rTokens.length,color:"#94A3B8"},{icon:"✅",label:"Completed",value:rClosed,color:"#10B981"},{icon:"⚠️",label:"Incomplete",value:rIncomplete,color:"#EF4444"},{icon:"📈",label:"Rate",value:`${rRate}%`,color:"#F59E0B"}].map(s=>(
                  <div key={s.label} style={{background:"#0D1117",border:"1px solid #1F2937",borderRadius:12,padding:"16px 12px",flex:1,textAlign:"left"}}>
                    <div style={{fontSize:20,marginBottom:6}}>{s.icon}</div>
                    <div style={{fontSize:24,fontWeight:700,color:s.color,fontFamily:"monospace"}}>{s.value}</div>
                    <div style={{fontSize:10,color:"#6B7280",letterSpacing:2,textTransform:"uppercase",marginTop:4}}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div style={{background:"#0D1117",border:"1px solid #1F2937",borderRadius:12,padding:20}}>
                  <div style={{fontSize:10,color:"#F59E0B",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>By Category</div>
                  <BarChart data={rByCat} colorFn={()=>"#3B82F6"} />
                </div>
                <div style={{background:"#0D1117",border:"1px solid #1F2937",borderRadius:12,padding:20}}>
                  <div style={{fontSize:10,color:"#F59E0B",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>By Priority</div>
                  <BarChart data={rByPri} colorFn={(k)=>PRIORITY_COLOR[k]} />
                </div>
              </div>
              <div style={{background:"#0D1117",border:"1px solid #1F2937",borderRadius:12,padding:20,marginBottom:14}}>
                <div style={{fontSize:10,color:"#F59E0B",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>Status Breakdown</div>
                <div style={{display:"flex",alignItems:"center",gap:40}}>
                  <div style={{position:"relative",width:90,height:90,flexShrink:0}}>
                    <svg viewBox="0 0 36 36" style={{transform:"rotate(-90deg)",width:90,height:90}}>
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#1F2937" strokeWidth="4" />
                      {[{val:rClosed,color:"#10B981",offset:0},{val:rIncomplete,color:"#EF4444",offset:rClosed},{val:rOpen,color:"#F59E0B",offset:rClosed+rIncomplete}].map((s,i)=>{
                        if(s.val===0) return null;
                        const circ=2*Math.PI*14;
                        const dash=(s.val/rTokens.length)*circ;
                        const gap=circ-dash;
                        const off=-(s.offset/rTokens.length)*circ;
                        return <circle key={i} cx="18" cy="18" r="14" fill="none" stroke={s.color} strokeWidth="4" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={off} />;
                      })}
                    </svg>
                    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <div style={{fontFamily:"monospace",fontSize:16,fontWeight:700,color:"#F1F5F9"}}>{rRate}%</div>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {[{label:"Closed",value:rClosed,color:"#10B981"},{label:"Incomplete",value:rIncomplete,color:"#EF4444"},{label:"Open",value:rOpen,color:"#F59E0B"}].map(s=>(
                      <div key={s.label} style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:s.color,flexShrink:0}} />
                        <div style={{fontSize:13,color:"#9CA3AF",width:80}}>{s.label}</div>
                        <div style={{fontFamily:"monospace",fontSize:14,color:s.color,fontWeight:700}}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{background:"#0D1117",border:"1px solid #1F2937",borderRadius:12,padding:20}}>
                <div style={{fontSize:10,color:"#F59E0B",letterSpacing:3,textTransform:"uppercase",marginBottom:14}}>All Tokens This Period</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{borderBottom:"1px solid #1F2937"}}>
                        {["Token ID","Title","Category","Priority","Status","Remarks","Created"].map(h=>(
                          <th key={h} style={{textAlign:"left",padding:"8px 10px",fontSize:10,color:"#4B5563",letterSpacing:2,textTransform:"uppercase",fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rTokens.map(t=>{
                        const meta=STATUS_META[t.status];
                        return (
                          <tr key={t.id} onClick={()=>{setSelectedId(t.id);setView("detail");}} style={{borderBottom:"1px solid #111827",cursor:"pointer"}}
                            onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background="#111827"}
                            onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background="transparent"}
                          >
                            <td style={{padding:"10px",fontFamily:"monospace",color:"#F59E0B",fontSize:11,whiteSpace:"nowrap"}}>{t.id}</td>
                            <td style={{padding:"10px",color:"#E2E8F0",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</td>
                            <td style={{padding:"10px",color:"#9CA3AF"}}>{t.category}</td>
                            <td style={{padding:"10px",color:PRIORITY_COLOR[t.priority]}}>{t.priority}</td>
                            <td style={{padding:"10px"}}><Badge label={meta.label} color={meta.color} bg={meta.bg} /></td>
                            <td style={{padding:"10px",color:"#6B7280",fontFamily:"monospace"}}>{t.remarks?t.remarks.length:0}</td>
                            <td style={{padding:"10px",color:"#4B5563",whiteSpace:"nowrap",fontSize:11}}>{fmt(t.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>)}
          </div>
        )}
      </div>
      <style>{`
        @keyframes pop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        input,select,textarea{color-scheme:dark}
        button:active{transform:scale(.98)}
      `}</style>
    </div>
  );
}
