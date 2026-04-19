"use client";
import { useState, useCallback, useRef, useEffect } from "react";

type CheckResult = {
  username: string; status: string;
  name?: string | null; photo?: string | null;
  hasPremium?: boolean | null; source?: string; error?: boolean;
};
type HistoryItem = {
  id: string; username: string; status: string;
  name?: string | null; photo?: string | null;
  hasPremium?: string | null; checkedAt: string;
};

/* ── status palette ── */
const SP = {
  Available:  { label:"Available",  c:"#81c995", bg:"rgba(129,201,149,.08)", b:"rgba(129,201,149,.2)" },
  Taken:      { label:"Taken",      c:"#f28b82", bg:"rgba(242,139,130,.08)", b:"rgba(242,139,130,.2)" },
  "For Sale": { label:"For Sale",   c:"#fdd663", bg:"rgba(253,214,99,.08)",  b:"rgba(253,214,99,.2)"  },
  Sold:       { label:"Sold",       c:"#9aa0a6", bg:"rgba(154,160,166,.08)", b:"rgba(154,160,166,.2)" },
  Invalid:    { label:"Invalid",    c:"#f28b82", bg:"rgba(242,139,130,.06)", b:"rgba(242,139,130,.15)"},
  Unknown:    { label:"Unknown",    c:"#9aa0a6", bg:"rgba(154,160,166,.06)", b:"rgba(154,160,166,.15)"},
};
type SK = keyof typeof SP;
const ORDER: SK[] = ["Available","For Sale","Sold","Taken","Unknown","Invalid"];
const sc = (s:string) => (SP as Record<string,typeof SP[SK]>)[s] ?? SP.Unknown;

/* ── atoms ── */
function Badge({status}:{status:string}) {
  const c = sc(status);
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:5,background:c.bg,border:`1px solid ${c.b}`,color:c.c,fontSize:11,fontWeight:600,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:c.c,flexShrink:0}}/>
      {c.label}
    </span>
  );
}

function Spinner({size=15}:{size?:number}) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,.1)" strokeWidth="2.5"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="rgba(255,255,255,.45)" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function Avatar({u,photo,sz=34}:{u:string;photo?:string|null;sz?:number}) {
  if (photo) return <img src={photo} alt={u} style={{width:sz,height:sz,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>;
  return (
    <div style={{width:sz,height:sz,borderRadius:"50%",flexShrink:0,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:sz*.36,fontWeight:600,color:"var(--text-secondary)"}}>
      {u[0]?.toUpperCase()??"?"}
    </div>
  );
}

function EI({sz=11}:{sz?:number}) {
  return <svg width={sz} height={sz} viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}

function Premium() {
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 6px",borderRadius:4,background:"rgba(253,214,99,.09)",border:"1px solid rgba(253,214,99,.2)",color:"#fdd663",fontSize:10,fontWeight:600}}>
      ★ Premium
    </span>
  );
}

function Card({children,style}:{children:React.ReactNode;style?:React.CSSProperties}) {
  return (
    <div style={{background:"var(--bg-card)",border:"1px solid var(--border-color)",borderRadius:"var(--radius-lg)",overflow:"hidden",...style}}>
      {children}
    </div>
  );
}

function Row({r,last}:{r:CheckResult;last:boolean}) {
  const [h,setH]=useState(false);
  return (
    <div onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",background:h?"rgba(255,255,255,.02)":"transparent",borderBottom:last?"none":"1px solid var(--border-color)",transition:"background .12s"}}>
      <Avatar u={r.username} photo={r.photo} sz={32}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontWeight:500,fontSize:13,color:"var(--text-primary)"}}>@{r.username}</span>
          {r.hasPremium && <Premium/>}
        </div>
        {r.name && <div style={{fontSize:11,color:"var(--text-muted)",marginTop:1}}>{r.name}</div>}
      </div>
      <Badge status={r.status}/>
      {r.status!=="Invalid" && (
        <a href={`https://fragment.com/username/${r.username}`} target="_blank" rel="noopener noreferrer"
          style={{color:"var(--text-muted)",display:"flex",flexShrink:0,transition:"color .12s"}}
          onMouseEnter={e=>((e.currentTarget as HTMLAnchorElement).style.color="var(--text-secondary)")}
          onMouseLeave={e=>((e.currentTarget as HTMLAnchorElement).style.color="var(--text-muted)")}
        ><EI/></a>
      )}
    </div>
  );
}

function LetterPill({letter,status}:{letter:string;status:string|null}) {
  const c = status ? sc(status) : null;
  return (
    <div title={status?`${letter}: ${status}`:letter}
      style={{width:36,height:36,borderRadius:7,background:c?c.bg:"rgba(255,255,255,.03)",border:`1px solid ${c?c.b:"rgba(255,255,255,.06)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:c?c.c:"rgba(255,255,255,.2)",cursor:"default",transition:"transform .1s, opacity .2s",opacity:status===null?.38:1}}
      onMouseEnter={e=>{if(c)(e.currentTarget as HTMLDivElement).style.transform="scale(1.14)";}}
      onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.transform="scale(1)";}}
    >{letter}</div>
  );
}

/* ── search input shell ── */
function SearchBox({
  value, onChange, onEnter, disabled, placeholder,
  suffix, onAction, actionLabel, actionLoading, actionStop, onStop,
}:{
  value:string; onChange:(v:string)=>void; onEnter?:()=>void; disabled?:boolean;
  placeholder?:string; suffix?:string;
  onAction:()=>void; actionLabel:string; actionLoading?:boolean;
  actionStop?:boolean; onStop?:()=>void;
}) {
  return (
    <div style={{display:"flex",alignItems:"center",background:"var(--bg-elevated)",border:"1px solid var(--border-color)",borderRadius:"var(--radius-lg)",overflow:"hidden",boxShadow:"0 1px 10px rgba(0,0,0,.35)"}}>
      <span style={{padding:"0 0 0 16px",color:"var(--text-muted)",fontSize:16,flexShrink:0,userSelect:"none"}}>@</span>
      <input type="text" value={value}
        onChange={e=>onChange(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter"&&onEnter)onEnter();}}
        placeholder={placeholder??"username"} disabled={disabled}
        autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
        style={{flex:1,background:"transparent",border:"none",outline:"none",color:"var(--text-primary)",fontSize:15,fontWeight:500,fontFamily:"inherit",padding:"13px 12px",opacity:disabled?.6:1}}
      />
      {suffix && !actionLoading && (
        <span style={{fontSize:11,color:"var(--text-muted)",fontFamily:"monospace",paddingRight:12,flexShrink:0}}>{suffix}</span>
      )}
      {actionStop ? (
        <button onClick={onStop} style={{padding:"0 18px",height:46,flexShrink:0,background:"rgba(242,139,130,.07)",border:"none",borderLeft:"1px solid var(--border-color)",color:"#f28b82",fontFamily:"inherit",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><rect x="2" y="2" width="8" height="8" rx="1.5" fill="#f28b82"/></svg>
          Stop
        </button>
      ) : (
        <button onClick={onAction} disabled={!value.trim()||actionLoading}
          style={{padding:"0 20px",height:46,flexShrink:0,background:value.trim()&&!actionLoading?"rgba(255,255,255,.07)":"transparent",border:"none",borderLeft:"1px solid var(--border-color)",color:value.trim()?"var(--text-primary)":"var(--text-muted)",fontFamily:"inherit",fontSize:13,fontWeight:500,cursor:!value.trim()||actionLoading?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:7,transition:"background .15s"}}
          onMouseEnter={e=>{if(value.trim()&&!actionLoading)(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,.1)";}}
          onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background=value.trim()&&!actionLoading?"rgba(255,255,255,.07)":"transparent";}}
        >
          {actionLoading?<Spinner size={14}/>:<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
          {actionLoading?"Checking…":actionLabel}
        </button>
      )}
    </div>
  );
}

/* ════ PAGE ════ */
export default function HomePage() {
  const [tab, setTab] = useState<"single"|"batch"|"sweep">("single");
  const [input, setInput]       = useState("");
  const [batchIn, setBatchIn]   = useState("");
  const [sweepIn, setSweepIn]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<CheckResult|null>(null);
  const [batchR, setBatchR]     = useState<CheckResult[]>([]);
  const [sweepR, setSweepR]     = useState<CheckResult[]>([]);
  const [sweepProg, setSweepProg]= useState(0);
  const [sweepRun, setSweepRun] = useState(false);
  const [sort, setSort]         = useState<"none"|"az"|"za"|"group">("none");
  const [err, setErr]           = useState<string|null>(null);
  const [history, setHistory]   = useState<HistoryItem[]>([]);
  const [histLoad, setHistLoad] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const abortRef = useRef(false);
  const ALPHA = "abcdefghijklmnopqrstuvwxyz".split("");

  const sorted = sort==="az"?[...batchR].sort((a,b)=>a.username.localeCompare(b.username))
               : sort==="za"?[...batchR].sort((a,b)=>b.username.localeCompare(a.username))
               : batchR;

  const grouped = sort==="group" ? (() => {
    const g:{status:string;items:CheckResult[]}[]=[];
    for(const s of ORDER){const items=batchR.filter(r=>r.status===s).sort((a,b)=>a.username.localeCompare(b.username));if(items.length)g.push({status:s,items});}
    const known=new Set<string>(ORDER);
    const extra=batchR.filter(r=>!known.has(r.status));if(extra.length)g.push({status:"Other",items:extra});
    return g;
  })() : null;

  const loadHist = useCallback(async()=>{
    setHistLoad(true);
    try{const r=await fetch("/api/history");const d=await r.json() as{history:HistoryItem[]};setHistory(d.history??[]);}
    catch{/**/}finally{setHistLoad(false);}
  },[]);

  useEffect(()=>{void loadHist();},[loadHist]);

  const checkSingle = useCallback(async()=>{
    const u=input.trim().replace(/^@/,""); if(!u) return;
    setLoading(true);setErr(null);setResult(null);
    try{const r=await fetch(`/api/check-username?username=${encodeURIComponent(u)}`);const d=await r.json() as CheckResult&{error?:string};if(!r.ok)setErr(d.error??"Error");else{setResult(d);void loadHist();}}
    catch{setErr("Network error.");}finally{setLoading(false);}
  },[input,loadHist]);

  const checkBatch = useCallback(async()=>{
    const lines=batchIn.split(/[\n,;]+/).map(s=>s.trim().replace(/^@/,"")).filter(Boolean);
    if(!lines.length)return;if(lines.length>100){setErr("Max 100 usernames.");return;}
    setLoading(true);setErr(null);setBatchR([]);setSort("none");
    try{const r=await fetch("/api/check-username",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({usernames:lines})});const d=await r.json() as{results?:CheckResult[];error?:string};if(!r.ok)setErr(d.error??"Error");else{setBatchR(d.results??[]);void loadHist();}}
    catch{setErr("Network error.");}finally{setLoading(false);}
  },[batchIn,loadHist]);

  const startSweep = useCallback(async()=>{
    const base=sweepIn.trim().replace(/^@/,""); if(!base) return;
    abortRef.current=false;setSweepRun(true);setSweepR([]);setSweepProg(0);setErr(null);
    try{
      const r=await fetch("/api/check-username",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({usernames:ALPHA.map(l=>base+l)})});
      const d=await r.json() as{results?:CheckResult[];error?:string};
      if(!r.ok){setErr(d.error??"Error");return;}
      const results=d.results??[];
      for(let i=0;i<results.length;i++){
        if(abortRef.current)break;
        setSweepR(p=>[...p,results[i]]);setSweepProg(i+1);
        await new Promise(res=>setTimeout(res,55));
      }
      void loadHist();
    }catch{setErr("Network error.");}finally{setSweepRun(false);}
  },[sweepIn,loadHist,ALPHA]);

  const stopSweep=()=>{abortRef.current=true;setSweepRun(false);};
  const resetTab=(t:typeof tab)=>{setTab(t);setResult(null);setBatchR([]);setSweepR([]);setErr(null);setSweepProg(0);};
  const fmtDate=(s:string)=>new Date(s).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  const sweepBase=sweepR.length?sweepR[0].username.slice(0,-1):sweepIn.trim().replace(/^@/,"");

  const TON=(
    <svg width="13" height="13" viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="28" fill="#0098EA"/>
      <path d="M38.82 17H17.18C13.64 17 11.43 20.85 13.2 23.9L26.37 46.59C27.14 47.93 29.07 47.93 29.83 46.59L43 23.9C44.57 20.85 42.36 17 38.82 17ZM25.4 35.46L19.68 25.3H25.4V35.46ZM25.4 23.3H18.03L25.4 19.5V23.3ZM30.6 35.46V25.3H36.32L30.6 35.46ZM30.6 23.3V19.5L37.97 23.3H30.6Z" fill="white"/>
    </svg>
  );

  return (
    <div style={{minHeight:"100vh",background:"var(--bg-primary)"}}>

      {/* ── HEADER ── */}
      <header style={{position:"sticky",top:0,zIndex:50,borderBottom:"1px solid var(--border-color)",background:"rgba(23,25,28,.92)",backdropFilter:"blur(18px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"0 24px",height:54,display:"flex",alignItems:"center",justifyContent:"space-between"}}>

          {/* Logo — clicks to fragment.com */}
          <a href="https://fragment.com" target="_blank" rel="noopener noreferrer"
            style={{display:"flex",alignItems:"center",gap:9,textDecoration:"none"}}
            onMouseEnter={e=>{(e.currentTarget.querySelector("span") as HTMLElement).style.color="var(--text-primary)";}}
            onMouseLeave={e=>{(e.currentTarget.querySelector("span") as HTMLElement).style.color="rgba(232,234,237,.82)";}}
          >
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="6" fill="rgba(255,255,255,.05)"/>
              <path d="M16 4L28 16L16 28L4 16Z" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.5"/>
              <path d="M16 4L28 16H16Z" fill="rgba(255,255,255,.14)"/>
              <path d="M16 16H28L16 28Z" fill="rgba(255,255,255,.06)"/>
              <path d="M4 16L16 4V16Z" fill="rgba(255,255,255,.07)"/>
            </svg>
            <span style={{fontSize:15,fontWeight:600,color:"rgba(232,234,237,.82)",letterSpacing:"-0.01em",transition:"color .15s"}}>
              Fragment
            </span>
          </a>

          {/* right */}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <a href="https://fragment.com" target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:7,border:"1px solid var(--border-color)",color:"var(--text-muted)",fontSize:12,textDecoration:"none",transition:"all .15s"}}
              onMouseEnter={e=>{const el=e.currentTarget as HTMLAnchorElement;el.style.borderColor="var(--border-hover)";el.style.color="var(--text-secondary)";}}
              onMouseLeave={e=>{const el=e.currentTarget as HTMLAnchorElement;el.style.borderColor="var(--border-color)";el.style.color="var(--text-muted)";}}
            >
              fragment.com <EI sz={10}/>
            </a>
            <button onClick={()=>{setShowHist(!showHist);if(!showHist)void loadHist();}}
              style={{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:7,border:"1px solid",borderColor:showHist?"rgba(255,255,255,.15)":"var(--border-color)",background:showHist?"rgba(255,255,255,.06)":"transparent",color:showHist?"var(--text-primary)":"var(--text-muted)",fontFamily:"inherit",fontSize:12,fontWeight:500,cursor:"pointer",transition:"all .15s"}}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              History
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{padding:"60px 24px 36px",textAlign:"center",position:"relative"}}>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 55% 45% at 50% 0%,rgba(255,255,255,.015) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:18,padding:"3px 10px",borderRadius:20,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",fontSize:10,color:"var(--text-muted)",fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase"}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:"#81c995",boxShadow:"0 0 4px #81c995"}}/>
            Username Checker
          </div>
          <h1 style={{fontSize:"clamp(22px,4vw,36px)",fontWeight:700,letterSpacing:"-0.03em",color:"var(--text-primary)",lineHeight:1.2,marginBottom:10}}>
            Check Telegram username availability
          </h1>
          <p style={{fontSize:13,color:"var(--text-muted)",maxWidth:380,margin:"0 auto",lineHeight:1.7}}>
            Single lookup, bulk batch, or scan all 26 letter variants — powered by the{" "}
            <a href="https://fragment.com" target="_blank" rel="noopener noreferrer" style={{color:"var(--text-secondary)",textDecoration:"none"}}>Fragment</a> API.
          </p>
        </div>
      </section>

      {/* ── MAIN ── */}
      <main style={{maxWidth:660,margin:"0 auto",padding:"0 24px 80px"}}>

        {/* tabs */}
        <div style={{display:"flex",gap:2,padding:3,background:"rgba(255,255,255,.03)",border:"1px solid var(--border-color)",borderRadius:11,marginBottom:18}}>
          {(["single","batch","sweep"] as const).map(t=>(
            <button key={t} onClick={()=>resetTab(t)} style={{flex:1,padding:"7px 4px",border:"none",background:tab===t?"rgba(255,255,255,.08)":"transparent",color:tab===t?"var(--text-primary)":"var(--text-muted)",fontFamily:"inherit",fontWeight:tab===t?600:400,fontSize:12,borderRadius:9,cursor:"pointer",transition:"all .15s",outline:tab===t?"1px solid rgba(255,255,255,.1)":"none",whiteSpace:"nowrap"}}>
              {{single:"Single",batch:"Batch · up to 100",sweep:"🔤 Alpha Sweep"}[t]}
            </button>
          ))}
        </div>

        {/* error */}
        {err && (
          <div className="animate-fade-in" style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",borderRadius:9,marginBottom:14,background:"rgba(242,139,130,.06)",border:"1px solid rgba(242,139,130,.18)",color:"#f28b82",fontSize:12}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            {err}
          </div>
        )}

        {/* ══ SINGLE ══ */}
        {tab==="single" && (
          <div>
            <SearchBox
              value={input} onChange={v=>{setInput(v);setResult(null);setErr(null);}}
              onEnter={()=>void checkSingle()}
              placeholder="username"
              onAction={()=>void checkSingle()} actionLabel="Check" actionLoading={loading}
            />
            <p style={{fontSize:11,color:"var(--text-muted)",textAlign:"center",marginTop:7,marginBottom:22}}>
              3–32 chars · letters, numbers, underscores
            </p>

            {result && !err && (
              <div className="animate-fade-in">
                <Card style={{border:`1px solid ${sc(result.status).b}`}}>
                  <div style={{padding:18}}>
                    <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                      <Avatar u={result.username} photo={result.photo} sz={46}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                          <span style={{fontSize:16,fontWeight:600,color:"var(--text-primary)"}}>@{result.username}</span>
                          {result.hasPremium && <Premium/>}
                          <Badge status={result.status}/>
                        </div>
                        {result.name && <div style={{fontSize:12,color:"var(--text-muted)"}}>{result.name}</div>}
                        <div style={{display:"flex",gap:7,marginTop:12,flexWrap:"wrap"}}>
                          <a href={`https://fragment.com/username/${result.username}`} target="_blank" rel="noopener noreferrer"
                            style={{display:"inline-flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"var(--text-secondary)",textDecoration:"none",fontSize:12,fontWeight:500,transition:"all .15s"}}
                            onMouseEnter={e=>{const el=e.currentTarget as HTMLAnchorElement;el.style.background="rgba(255,255,255,.08)";el.style.color="var(--text-primary)";}}
                            onMouseLeave={e=>{const el=e.currentTarget as HTMLAnchorElement;el.style.background="rgba(255,255,255,.05)";el.style.color="var(--text-secondary)";}}
                          >
                            {TON} View on Fragment <EI sz={10}/>
                          </a>
                          <a href={`https://t.me/${result.username}`} target="_blank" rel="noopener noreferrer"
                            style={{display:"inline-flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,background:"rgba(0,152,234,.07)",border:"1px solid rgba(0,152,234,.18)",color:"#0098ea",textDecoration:"none",fontSize:12,fontWeight:500,transition:"all .15s"}}
                            onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.background="rgba(0,152,234,.13)";}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.background="rgba(0,152,234,.07)";}}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#0098ea"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                            Telegram
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                  {result.source && (
                    <div style={{padding:"8px 18px",borderTop:"1px solid var(--border-color)",fontSize:10,color:"var(--text-muted)"}}>
                      Source: {result.source}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ══ BATCH ══ */}
        {tab==="batch" && (
          <div>
            <Card style={{marginBottom:10}}>
              <div style={{padding:"9px 14px",borderBottom:"1px solid var(--border-color)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:"var(--text-muted)",fontWeight:500}}>One per line, comma or semicolon separated</span>
                <span style={{fontSize:11,color:"var(--text-muted)"}}>{batchIn.split(/[\n,;]+/).map(s=>s.trim()).filter(Boolean).length}/100</span>
              </div>
              <textarea value={batchIn} onChange={e=>{setBatchIn(e.target.value);setErr(null);setBatchR([]);}}
                placeholder={"username1\nusername2\nusername3"} rows={8}
                style={{width:"100%",background:"transparent",border:"none",outline:"none",resize:"vertical",padding:"13px",color:"var(--text-primary)",fontFamily:"monospace",fontSize:12,lineHeight:1.75}}
              />
            </Card>
            <button onClick={()=>void checkBatch()} disabled={loading||!batchIn.trim()}
              style={{width:"100%",padding:11,borderRadius:10,border:"1px solid",borderColor:!batchIn.trim()?"var(--border-color)":"rgba(255,255,255,.11)",background:!batchIn.trim()?"transparent":"rgba(255,255,255,.05)",color:!batchIn.trim()?"var(--text-muted)":"var(--text-primary)",fontFamily:"inherit",fontSize:13,fontWeight:500,cursor:loading||!batchIn.trim()?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,marginBottom:18,transition:"all .15s"}}
            >
              {loading?<><Spinner size={13}/> Checking…</>:<><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>Check all usernames</>}
            </button>

            {batchR.length>0 && (
              <div className="animate-fade-in">
                {/* summary pills */}
                <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
                  {ORDER.map(s=>{const n=batchR.filter(r=>r.status===s).length;if(!n)return null;const c=sc(s);return(
                    <div key={s} style={{padding:"7px 13px",borderRadius:9,background:c.bg,border:`1px solid ${c.b}`,textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:c.c}}>{n}</div>
                      <div style={{fontSize:10,color:c.c,opacity:.75}}>{c.label}</div>
                    </div>
                  );})}
                </div>
                {/* sort */}
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:10,justifyContent:"flex-end"}}>
                  <span style={{fontSize:10,color:"var(--text-muted)"}}>Sort:</span>
                  {(["none","az","za","group"] as const).map(k=>(
                    <button key={k} onClick={()=>setSort(k)} style={{padding:"3px 8px",borderRadius:5,border:"1px solid",borderColor:sort===k?"rgba(255,255,255,.14)":"var(--border-color)",background:sort===k?"rgba(255,255,255,.06)":"transparent",color:sort===k?"var(--text-primary)":"var(--text-muted)",fontSize:11,fontWeight:sort===k?600:400,fontFamily:"inherit",cursor:"pointer",transition:"all .12s"}}>
                      {{none:"Default",az:"A→Z",za:"Z→A",group:"Status"}[k]}
                    </button>
                  ))}
                </div>

                {grouped?(
                  grouped.map(g=>(
                    <div key={g.status} style={{marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5,padding:"0 2px"}}>
                        <span style={{fontSize:10,fontWeight:700,color:sc(g.status).c,letterSpacing:"0.07em",textTransform:"uppercase"}}>{sc(g.status).label}</span>
                        <span style={{fontSize:10,color:"var(--text-muted)",background:"rgba(255,255,255,.04)",border:"1px solid var(--border-color)",borderRadius:10,padding:"1px 6px"}}>{g.items.length}</span>
                        <div style={{flex:1,height:1,background:"rgba(255,255,255,.05)"}}/>
                      </div>
                      <Card style={{border:`1px solid ${sc(g.status).b}`}}>
                        {g.items.map((r,i)=><Row key={r.username} r={r} last={i===g.items.length-1}/>)}
                      </Card>
                    </div>
                  ))
                ):(
                  <Card>{sorted.map((r,i)=><Row key={i} r={r} last={i===sorted.length-1}/>)}</Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ ALPHA SWEEP ══ */}
        {tab==="sweep" && (
          <div>
            <div style={{display:"flex",gap:10,padding:"11px 14px",borderRadius:9,marginBottom:14,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)"}}>
              <span style={{flexShrink:0}}>🔤</span>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:3}}>Alpha Sweep</div>
                <div style={{fontSize:12,color:"var(--text-muted)",lineHeight:1.6}}>
                  Enter a base and we&apos;ll check all 26 variants with each letter appended.{" "}
                  <code style={{color:"var(--text-secondary)",fontFamily:"monospace",fontSize:11}}>username</code>{" → "}
                  <code style={{color:"var(--text-secondary)",fontFamily:"monospace",fontSize:11}}>usernamea … usernamez</code>
                </div>
              </div>
            </div>

            <SearchBox
              value={sweepIn}
              onChange={v=>{setSweepIn(v);setSweepR([]);setErr(null);}}
              onEnter={()=>void startSweep()}
              placeholder="username"
              disabled={sweepRun}
              suffix={sweepIn.trim()?"+ a…z":undefined}
              onAction={()=>void startSweep()} actionLabel="Sweep" actionLoading={false}
              actionStop={sweepRun} onStop={stopSweep}
            />

            {/* progress */}
            {(sweepRun||sweepR.length>0) && (
              <div style={{marginTop:16,marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:11,color:"var(--text-muted)"}}>{sweepRun?`Scanning… ${sweepProg}/26`:`Done — ${sweepProg}/26`}</span>
                  <span style={{fontSize:11,color:"var(--text-muted)",fontFamily:"monospace"}}>{sweepBase}a…{sweepBase}z</span>
                </div>
                <div style={{height:2,background:"rgba(255,255,255,.05)",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(sweepProg/26)*100}%`,background:"rgba(255,255,255,.22)",borderRadius:2,transition:"width .12s ease"}}/>
                </div>
              </div>
            )}

            {/* letter grid */}
            {(sweepRun||sweepR.length>0) && (
              <div style={{marginBottom:18}}>
                <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:9}}>Overview</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {ALPHA.map((l,i)=>{
                    const res=sweepR.find(r=>r.username===sweepBase+l);
                    return <LetterPill key={l} letter={l} status={i<sweepProg?(res?.status??"Unknown"):null}/>;
                  })}
                </div>
              </div>
            )}

            {/* summary */}
            {sweepR.length>0 && (()=>{
              const counts=sweepR.reduce<Record<string,number>>((a,r)=>{a[r.status]=(a[r.status]??0)+1;return a;},{});
              return(
                <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:16}}>
                  {Object.entries(counts).map(([s,n])=>{const c=sc(s);return(
                    <div key={s} style={{padding:"7px 13px",borderRadius:9,background:c.bg,border:`1px solid ${c.b}`,textAlign:"center"}}>
                      <div style={{fontSize:17,fontWeight:700,color:c.c}}>{n}</div>
                      <div style={{fontSize:10,color:c.c,opacity:.75}}>{c.label}</div>
                    </div>
                  );})}
                </div>
              );
            })()}

            {/* full list */}
            {sweepR.length>0 && (
              <div className="animate-fade-in">
                <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>All results</div>
                <Card>{sweepR.map((r,i)=><Row key={r.username} r={r} last={i===sweepR.length-1}/>)}</Card>
              </div>
            )}
          </div>
        )}

        {/* ══ HISTORY ══ */}
        {showHist && (
          <div className="animate-fade-in" style={{marginTop:36}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:10,fontWeight:600,color:"var(--text-muted)",letterSpacing:"0.07em",textTransform:"uppercase"}}>Recent checks</span>
              <button onClick={()=>void loadHist()} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:6,border:"1px solid var(--border-color)",background:"transparent",color:"var(--text-muted)",fontFamily:"inherit",fontSize:11,cursor:"pointer"}}>
                {histLoad?<Spinner size={11}/>:"↻"} Refresh
              </button>
            </div>
            {history.length===0?(
              <Card><div style={{padding:28,textAlign:"center",color:"var(--text-muted)",fontSize:12}}>No checks yet.</div></Card>
            ):(
              <Card>
                {history.map((item,i)=>(
                  <div key={item.id} style={{display:"flex",alignItems:"center",gap:11,padding:"9px 15px",borderBottom:i<history.length-1?"1px solid var(--border-color)":"none"}}>
                    <Avatar u={item.username} sz={28}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:"var(--text-primary)",display:"flex",alignItems:"center",gap:5}}>
                        @{item.username}{item.hasPremium==="true"&&<Premium/>}
                      </div>
                      <div style={{fontSize:10,color:"var(--text-muted)"}}>{fmtDate(item.checkedAt)}</div>
                    </div>
                    <Badge status={item.status}/>
                    <a href={`https://fragment.com/username/${item.username}`} target="_blank" rel="noopener noreferrer"
                      style={{color:"var(--text-muted)",flexShrink:0,transition:"color .12s"}}
                      onMouseEnter={e=>((e.currentTarget as HTMLAnchorElement).style.color="var(--text-secondary)")}
                      onMouseLeave={e=>((e.currentTarget as HTMLAnchorElement).style.color="var(--text-muted)")}
                    ><EI sz={11}/></a>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer style={{borderTop:"1px solid var(--border-color)",padding:"18px 24px",textAlign:"center"}}>
        <p style={{fontSize:11,color:"var(--text-muted)",display:"flex",alignItems:"center",justifyContent:"center",gap:5,flexWrap:"wrap"}}>
          Unofficial tool · not affiliated with Telegram or{" "}
          <a href="https://fragment.com" target="_blank" rel="noopener noreferrer" style={{color:"var(--text-secondary)",textDecoration:"none"}}>Fragment</a>
        </p>
      </footer>
    </div>
  );
}
