"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type CheckResult = {
  username: string;
  status: "Available" | "Taken" | "For Sale" | "Sold" | "Unknown" | "Invalid" | string;
  name?: string | null;
  photo?: string | null;
  hasPremium?: boolean | null;
  source?: string;
  error?: boolean;
};

type HistoryItem = {
  id: string;
  username: string;
  status: string;
  name?: string | null;
  photo?: string | null;
  hasPremium?: string | null;
  checkedAt: string;
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  Available:  { label: "Available", color: "#3a9a28" },
  Taken:      { label: "Taken",     color: "#ec3425" },
  "For Sale": { label: "For Sale",  color: "#ff9000" },
  Sold:       { label: "Sold",      color: "#9b9b9b" },
  Invalid:    { label: "Invalid",   color: "#ec3425" },
  Unknown:    { label: "Unknown",   color: "#9b9b9b" },
};
const getS = (s: string) => STATUS_CFG[s] ?? { label: s, color: "#9b9b9b" };
const STATUS_ORDER = ["Available", "For Sale", "Sold", "Taken", "Unknown", "Invalid"];
const ALPHA = "abcdefghijklmnopqrstuvwxyz".split("");

/* ── helpers ── */
function Badge({ status }: { status: string }) {
  const c = getS(status);
  return <span style={{ color: c.color, fontSize: "11px", fontWeight: 500, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{c.label}</span>;
}

function TonLogo() {
  return (
    <svg width="13" height="13" viewBox="0 0 56 56" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="28" cy="28" r="28" fill="#0098EA" />
      <path d="M38.82 17H17.18C13.64 17 11.43 20.85 13.2 23.9L26.37 46.59C27.14 47.93 29.07 47.93 29.83 46.59L43 23.9C44.57 20.85 42.36 17 38.82 17ZM25.4 35.46L19.68 25.3H25.4V35.46ZM25.4 23.3H18.03L25.4 19.5V23.3ZM30.6 35.46V25.3H36.32L30.6 35.46ZM30.6 23.3V19.5L37.97 23.3H30.6Z" fill="white" />
    </svg>
  );
}

function Spin({ sz = 13 }: { sz?: number }) {
  return (
    <svg className="animate-spin" width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#e6e6e6" strokeWidth="2.5" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#0d0d0d" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Star() {
  return (
    <svg width="11" height="11" viewBox="0 0 20 20" fill="none" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <path d="M10 1l2.39 4.84 5.35.78-3.87 3.77.91 5.31L10 13.27l-4.78 2.51.91-5.31L2.26 6.62l5.35-.78L10 1z" fill="#FFD700" stroke="#e6be00" strokeWidth="0.5" />
    </svg>
  );
}

function Ava({ username, photo, sz = 26 }: { username: string; photo?: string | null; sz?: number }) {
  if (photo) return <img src={photo} alt={username} style={{ width: sz, height: sz, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: sz, height: sz, borderRadius: "50%", background: "#f4f4f4", border: "0.5px solid #e6e6e6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(sz * 0.38) + "px", fontWeight: 500, color: "#9b9b9b", flexShrink: 0 }}>
      {username[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

const DLBDR = { borderBottom: "0.5px solid #e6e6e6" } as const;

function Row({ r, last }: { r: CheckResult; last: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "9px 14px", ...(!last ? DLBDR : {}), gap: "10px", transition: "background 0.1s", cursor: "default" }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = "#f4f4f4")}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
    >
      <Ava username={r.username} photo={r.photo} sz={24} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#0d0d0d" }}>@{r.username}</span>
          {r.hasPremium && <Star />}
        </div>
        {r.name && <div style={{ fontSize: "11px", color: "#9b9b9b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>}
      </div>
      <Badge status={r.status} />
      {r.status !== "Invalid" && (
        <a href={`https://fragment.com/username/${r.username}`} target="_blank" rel="noopener noreferrer"
          style={{ color: "#cecece", textDecoration: "none", display: "flex", alignItems: "center", flexShrink: 0, transition: "color 0.1s" }}
          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = "#0d0d0d")}
          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = "#cecece")}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </a>
      )}
    </div>
  );
}

type Sort = "none" | "az" | "za" | "group";

function Results({ results, sort, setSort }: { results: CheckResult[]; sort: Sort; setSort: (s: Sort) => void }) {
  const sorted = sort === "az" ? [...results].sort((a, b) => a.username.localeCompare(b.username))
    : sort === "za" ? [...results].sort((a, b) => b.username.localeCompare(a.username))
    : results;

  const grouped = (() => {
    if (sort !== "group") return null;
    const g: { status: string; items: CheckResult[] }[] = [];
    for (const s of STATUS_ORDER) {
      const items = results.filter(r => r.status === s).sort((a, b) => a.username.localeCompare(b.username));
      if (items.length) g.push({ status: s, items });
    }
    const known = new Set(STATUS_ORDER);
    const extra = results.filter(r => !known.has(r.status));
    if (extra.length) g.push({ status: "Other", items: extra });
    return g;
  })();

  const counts = STATUS_ORDER.map(s => ({ s, n: results.filter(r => r.status === s).length })).filter(x => x.n > 0);

  return (
    <div>
      {counts.length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "12px" }}>
          {counts.map(({ s, n }) => (
            <div key={s} style={{ padding: "4px 10px", background: "#f4f4f4", border: "0.5px solid #e6e6e6", borderRadius: "2px", display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: getS(s).color, fontWeight: 500 }}>{getS(s).label}</span>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#0d0d0d" }}>{n}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "3px", marginBottom: "8px", alignItems: "center" }}>
        <span style={{ fontSize: "11px", color: "#9b9b9b", marginRight: "4px" }}>Sort</span>
        {(["none", "az", "za", "group"] as Sort[]).map(k => (
          <button key={k} onClick={() => setSort(k)} style={{
            background: "transparent",
            border: "0.5px solid " + (sort === k ? "#0d0d0d" : "#cecece"),
            borderRadius: "2px", padding: "3px 8px",
            color: sort === k ? "#0d0d0d" : "#9b9b9b",
            fontSize: "11px", fontWeight: sort === k ? 500 : 400,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s",
          }}>{({ none: "Default", az: "A→Z", za: "Z→A", group: "Status" } as Record<Sort, string>)[k]}</button>
        ))}
      </div>

      {sort === "group" && grouped ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {grouped.map(g => (
            <div key={g.status}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "10px", fontWeight: 500, color: getS(g.status).color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{getS(g.status).label}</span>
                <span style={{ fontSize: "10px", color: "#9b9b9b" }}>{g.items.length}</span>
                <div style={{ flex: 1, height: "0.5px", background: "#e6e6e6" }} />
              </div>
              <div style={{ border: "0.5px solid #e6e6e6", borderRadius: "2px", overflow: "hidden" }}>
                {g.items.map((r, i) => <Row key={r.username + i} r={r} last={i === g.items.length - 1} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ border: "0.5px solid #e6e6e6", borderRadius: "2px", overflow: "hidden" }}>
          {sorted.map((r, i) => <Row key={i} r={r} last={i === sorted.length - 1} />)}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════
   Page
════════════════════════════════════ */
export default function HomePage() {
  const [input, setInput]           = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [sweepInput, setSweepInput] = useState("");
  const [sweepPos, setSweepPos]     = useState<"suffix" | "prefix">("suffix");
  const [mode, setMode]             = useState<"single" | "batch" | "sweep" | "history">("single");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<CheckResult | null>(null);
  const [batchRes, setBatchRes]     = useState<CheckResult[]>([]);
  const [sweepRes, setSweepRes]     = useState<CheckResult[]>([]);
  const [batchSort, setBatchSort]   = useState<Sort>("none");
  const [sweepSort, setSweepSort]   = useState<Sort>("none");
  const [error, setError]           = useState<string | null>(null);
  const [history, setHistory]       = useState<HistoryItem[]>([]);
  const [histLoad, setHistLoad]     = useState(false);
  const [clearOk, setClearOk]       = useState(false);
  const inputRef                    = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    setHistLoad(true);
    try { const d = await (await fetch("/api/history")).json() as { history: HistoryItem[] }; setHistory(d.history ?? []); } catch { /**/ }
    finally { setHistLoad(false); }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const clearHistory = useCallback(async () => {
    if (!clearOk) { setClearOk(true); setTimeout(() => setClearOk(false), 3000); return; }
    try { await fetch("/api/history", { method: "DELETE" }); setHistory([]); setClearOk(false); } catch { /**/ }
  }, [clearOk]);

  const checkSingle = useCallback(async () => {
    const u = input.trim().replace(/^@/, "").toLowerCase();
    if (!u) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/check-username?username=${encodeURIComponent(u)}`);
      const d = await res.json() as CheckResult & { error?: string };
      if (!res.ok) setError(d.error ?? "Something went wrong");
      else { setResult(d as CheckResult); void loadHistory(); }
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [input, loadHistory]);

  const checkBatch = useCallback(async () => {
    const lines = batchInput.split(/[\n,;]+/).map(s => s.trim().replace(/^@/, "").toLowerCase()).filter(Boolean);
    if (!lines.length) return;
    if (lines.length > 200) { setError("Max 200 usernames."); return; }
    setLoading(true); setError(null); setBatchRes([]); setBatchSort("none");
    try {
      const res = await fetch("/api/check-username", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernames: lines }) });
      const d = await res.json() as { results?: CheckResult[]; error?: string };
      if (!res.ok) setError(d.error ?? "Something went wrong");
      else { setBatchRes(d.results ?? []); void loadHistory(); }
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [batchInput, loadHistory]);

  const checkSweep = useCallback(async () => {
    const base = sweepInput.trim().replace(/^@/, "").toLowerCase();
    if (!base) return;
    const cands = [base, ...ALPHA.map(l => sweepPos === "suffix" ? `${base}${l}` : `${l}${base}`)];
    setLoading(true); setError(null); setSweepRes([]); setSweepSort("none");
    try {
      const res = await fetch("/api/check-username", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernames: cands }) });
      const d = await res.json() as { results?: CheckResult[]; error?: string };
      if (!res.ok) setError(d.error ?? "Something went wrong");
      else { setSweepRes(d.results ?? []); void loadHistory(); }
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [sweepInput, sweepPos, loadHistory]);

  const fmtDate = (s: string) => {
    try { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return s; }
  };

  /* style helpers */
  const primaryBtn = (dis: boolean): React.CSSProperties => ({
    background: dis ? "#e6e6e6" : "#0d0d0d",
    color: dis ? "#9b9b9b" : "#fff",
    border: "none", borderRadius: "2px", padding: "8px 16px",
    fontSize: "13px", fontWeight: 500, cursor: dis ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", gap: "6px",
    whiteSpace: "nowrap" as const, flexShrink: 0, fontFamily: "inherit", transition: "background 0.1s",
  });
  const ghostBtn: React.CSSProperties = {
    background: "transparent", border: "0.5px solid #cecece", borderRadius: "2px",
    padding: "5px 10px", color: "#787878", fontSize: "12px", cursor: "pointer",
    display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit", transition: "all 0.1s",
  };
  const inputWrap: React.CSSProperties = {
    display: "flex", alignItems: "center", border: "0.5px solid #cecece",
    borderRadius: "2px", overflow: "hidden",
  };
  const textInput: React.CSSProperties = {
    flex: 1, background: "transparent", border: "none", outline: "none",
    color: "#0d0d0d", fontSize: "14px", padding: "10px 6px", fontFamily: "inherit",
  };

  const tabs = [
    { key: "single"  as const, label: "Single",  icon: null },
    { key: "batch"   as const, label: "Batch",   icon: null },
    { key: "sweep"   as const, label: "Sweep",
      icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> },
    { key: "history" as const, label: "History",
      icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#fff", color: "#0d0d0d" }}>

      {/* header */}
      <header style={{ borderBottom: "0.5px solid #e6e6e6", padding: "0 24px", height: "46px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(6px)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <TonLogo />
          <span style={{ fontSize: "13px", fontWeight: 500, letterSpacing: "0.01em" }}>Fragment Username</span>
        </div>
        <a href="https://fragment.com" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: "12px", color: "#9b9b9b", textDecoration: "none", display: "flex", alignItems: "center", gap: "3px", transition: "color 0.1s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#0d0d0d")}
          onMouseLeave={e => (e.currentTarget.style.color = "#9b9b9b")}
        >
          fragment.com
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </a>
      </header>

      <main style={{ maxWidth: "620px", margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* title */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "21px", fontWeight: 500, margin: "0 0 5px", letterSpacing: "-0.01em" }}>Username Checker</h1>
          <p style={{ fontSize: "13px", color: "#9b9b9b", margin: 0 }}>Check Telegram username availability on Fragment marketplace.</p>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", borderBottom: "0.5px solid #e6e6e6", marginBottom: "24px" }}>
          {tabs.map(({ key, label, icon }) => (
            <button key={key}
              onClick={() => { setMode(key); setResult(null); setBatchRes([]); setSweepRes([]); setError(null); if (key === "history") void loadHistory(); }}
              style={{
                padding: "9px 14px", border: "none",
                borderBottom: mode === key ? "1.5px solid #0d0d0d" : "1.5px solid transparent",
                background: "transparent",
                color: mode === key ? "#0d0d0d" : "#9b9b9b",
                fontWeight: mode === key ? 500 : 400, fontSize: "13px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "5px",
                marginBottom: "-0.5px", fontFamily: "inherit", transition: "color 0.1s",
              }}
            >{icon}{label}</button>
          ))}
        </div>

        {/* ── single ── */}
        {mode === "single" && (
          <div>
            <div style={{ ...inputWrap, marginBottom: "8px" }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = "#0d0d0d")}
              onBlurCapture={e => (e.currentTarget.style.borderColor = "#cecece")}
            >
              <span style={{ padding: "0 0 0 14px", color: "#cecece", fontSize: "15px", userSelect: "none", flexShrink: 0 }}>@</span>
              <input ref={inputRef} type="text" value={input}
                onChange={e => { setInput(e.target.value); setResult(null); setError(null); }}
                onKeyDown={e => { if (e.key === "Enter") void checkSingle(); }}
                placeholder="username" autoFocus
                autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                style={textInput}
              />
              <button onClick={() => void checkSingle()} disabled={loading || !input.trim()}
                style={primaryBtn(loading || !input.trim())}
                onMouseEnter={e => { if (!loading && input.trim()) (e.currentTarget as HTMLButtonElement).style.background = "#2d2d2d"; }}
                onMouseLeave={e => { if (!loading && input.trim()) (e.currentTarget as HTMLButtonElement).style.background = "#0d0d0d"; }}
              >
                {loading ? <Spin /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
                {loading ? "Checking" : "Check"}
              </button>
            </div>
            <p style={{ fontSize: "11px", color: "#9b9b9b", marginBottom: "24px" }}>Enter · 3–32 chars · letters, numbers, underscores</p>

            {error && (
              <div className="animate-fade-in" style={{ padding: "10px 14px", border: "0.5px solid #ec3425", borderRadius: "2px", color: "#ec3425", fontSize: "13px", marginBottom: "16px", display: "flex", gap: "8px" }}>
                <span>—</span>{error}
              </div>
            )}

            {result && !error && (
              <div className="animate-fade-in" style={{ border: "0.5px solid #e6e6e6", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ padding: "8px 14px", background: "#f4f4f4", borderBottom: "0.5px solid #e6e6e6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "11px", color: "#9b9b9b", fontFamily: "'Courier New', monospace" }}>fragment.com/username/{result.username}</span>
                  <Badge status={result.status} />
                </div>
                <div style={{ padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                    <Ava username={result.username} photo={result.photo} sz={38} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ fontSize: "15px", fontWeight: 500 }}>@{result.username}</span>
                        {result.hasPremium && <Star />}
                      </div>
                      {result.name && <div style={{ fontSize: "12px", color: "#9b9b9b", marginTop: "1px" }}>{result.name}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                    {[
                      { href: `https://fragment.com/username/${result.username}`, label: "View on Fragment", icon: <TonLogo /> },
                      { href: `https://t.me/${result.username}`, label: "Open in Telegram", icon: null },
                    ].map(({ href, label, icon }) => (
                      <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", border: "0.5px solid #cecece", borderRadius: "2px", color: "#0d0d0d", textDecoration: "none", fontSize: "12px", transition: "background 0.1s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f4f4f4")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >{icon}{label}</a>
                    ))}
                  </div>
                </div>
                {result.source && (
                  <div style={{ padding: "5px 14px", borderTop: "0.5px solid #e6e6e6", background: "#f4f4f4", fontSize: "10px", color: "#9b9b9b" }}>Source: {result.source}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── batch ── */}
        {mode === "batch" && (
          <div>
            <div style={{ border: "0.5px solid #cecece", borderRadius: "2px", overflow: "hidden", marginBottom: "10px" }}>
              <div style={{ padding: "7px 12px", background: "#f4f4f4", borderBottom: "0.5px solid #e6e6e6", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#9b9b9b" }}>One per line · comma or semicolon separated</span>
                <span style={{ fontSize: "11px", color: "#9b9b9b", fontFamily: "'Courier New', monospace" }}>
                  {batchInput.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).length}/200
                </span>
              </div>
              <textarea value={batchInput}
                onChange={e => { setBatchInput(e.target.value); setError(null); setBatchRes([]); }}
                placeholder={"username1\nusername2\nusername3"} rows={8}
                style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#0d0d0d", fontSize: "13px", fontFamily: "'Courier New', monospace", padding: "10px 12px", resize: "vertical", lineHeight: 1.6 }}
              />
            </div>
            <button onClick={() => void checkBatch()} disabled={loading || !batchInput.trim()}
              style={{ ...primaryBtn(loading || !batchInput.trim()), width: "100%", justifyContent: "center", marginBottom: "18px" }}
              onMouseEnter={e => { if (!loading && batchInput.trim()) (e.currentTarget as HTMLButtonElement).style.background = "#2d2d2d"; }}
              onMouseLeave={e => { if (!loading && batchInput.trim()) (e.currentTarget as HTMLButtonElement).style.background = "#0d0d0d"; }}
            >
              {loading ? <><Spin />Checking</> : "Check all"}
            </button>
            {error && <div style={{ padding: "10px 14px", border: "0.5px solid #ec3425", borderRadius: "2px", color: "#ec3425", fontSize: "13px", marginBottom: "14px" }}>— {error}</div>}
            {batchRes.length > 0 && <Results results={batchRes} sort={batchSort} setSort={setBatchSort} />}
          </div>
        )}

        {/* ── sweep ── */}
        {mode === "sweep" && (
          <div>
            <div style={{ padding: "9px 12px", background: "#f4f4f4", border: "0.5px solid #e6e6e6", borderRadius: "2px", fontSize: "12px", color: "#787878", marginBottom: "18px", lineHeight: 1.6 }}>
              Checks the original username + all 26 letter variants (a–z). Total: 27 requests.
            </div>
            <div style={{ ...inputWrap, marginBottom: "10px" }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = "#0d0d0d")}
              onBlurCapture={e => (e.currentTarget.style.borderColor = "#cecece")}
            >
              <span style={{ padding: "0 0 0 14px", color: "#cecece", fontSize: "15px", flexShrink: 0 }}>@</span>
              <input type="text" value={sweepInput}
                onChange={e => { setSweepInput(e.target.value); setError(null); setSweepRes([]); }}
                onKeyDown={e => { if (e.key === "Enter") void checkSweep(); }}
                placeholder="baseusername" autoFocus
                autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                style={textInput}
              />
              <button onClick={() => void checkSweep()} disabled={loading || !sweepInput.trim()}
                style={primaryBtn(loading || !sweepInput.trim())}
                onMouseEnter={e => { if (!loading && sweepInput.trim()) (e.currentTarget as HTMLButtonElement).style.background = "#2d2d2d"; }}
                onMouseLeave={e => { if (!loading && sweepInput.trim()) (e.currentTarget as HTMLButtonElement).style.background = "#0d0d0d"; }}
              >
                {loading ? <><Spin />Sweeping</> : "Sweep"}
              </button>
            </div>

            <div style={{ display: "flex", gap: "4px", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontSize: "11px", color: "#9b9b9b", marginRight: "4px" }}>Append</span>
              {(["suffix", "prefix"] as const).map(k => (
                <button key={k} onClick={() => setSweepPos(k)} style={{
                  background: "transparent",
                  border: "0.5px solid " + (sweepPos === k ? "#0d0d0d" : "#cecece"),
                  borderRadius: "2px", padding: "3px 10px",
                  color: sweepPos === k ? "#0d0d0d" : "#9b9b9b",
                  fontSize: "11px", fontWeight: sweepPos === k ? 500 : 400,
                  cursor: "pointer", fontFamily: "'Courier New', monospace", transition: "all 0.1s",
                }}>
                  {k === "suffix" ? "john+a" : "a+john"}
                </button>
              ))}
            </div>

            {sweepInput.trim() && (
              <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", marginBottom: "18px" }}>
                {[sweepInput.trim().toLowerCase(), ...ALPHA.slice(0, 6).map(l => sweepPos === "suffix" ? `${sweepInput.trim().toLowerCase()}${l}` : `${l}${sweepInput.trim().toLowerCase()}`)].map((u, i) => (
                  <span key={i} style={{
                    background: i === 0 ? "#0d0d0d" : "#f4f4f4",
                    border: "0.5px solid " + (i === 0 ? "#0d0d0d" : "#e6e6e6"),
                    borderRadius: "2px", padding: "2px 7px", fontSize: "11px",
                    color: i === 0 ? "#fff" : "#787878",
                    fontFamily: "'Courier New', monospace",
                  }}>{u}</span>
                ))}
                <span style={{ fontSize: "11px", color: "#9b9b9b", alignSelf: "center" }}>+{26 - 6} more</span>
              </div>
            )}

            {error && <div style={{ padding: "10px 14px", border: "0.5px solid #ec3425", borderRadius: "2px", color: "#ec3425", fontSize: "13px", marginBottom: "14px" }}>— {error}</div>}

            {sweepRes.length > 0 && (
              <div className="animate-fade-in">
                {sweepRes[0] && (
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 500, color: "#9b9b9b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "5px" }}>Original</div>
                    <div style={{ border: "0.5px solid #0d0d0d", borderRadius: "2px", overflow: "hidden" }}>
                      <Row r={sweepRes[0]} last={true} />
                    </div>
                  </div>
                )}
                {sweepRes.length > 1 && (
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 500, color: "#9b9b9b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "5px" }}>Letter variants a–z</div>
                    <Results results={sweepRes.slice(1)} sort={sweepSort} setSort={setSweepSort} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── history ── */}
        {mode === "history" && (
          <div className="animate-fade-in">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 500 }}>Recent checks</span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button onClick={() => void loadHistory()} style={ghostBtn}>{histLoad ? <Spin sz={11} /> : "↻"} Refresh</button>
                {history.length > 0 && (
                  <button onClick={() => void clearHistory()} style={{ ...ghostBtn, color: clearOk ? "#ec3425" : "#787878", borderColor: clearOk ? "#ec3425" : "#cecece" }}>
                    {clearOk ? "Sure?" : "Clear"}
                  </button>
                )}
              </div>
            </div>
            {history.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", border: "0.5px solid #e6e6e6", borderRadius: "2px", color: "#9b9b9b", fontSize: "13px" }}>No checks yet.</div>
            ) : (
              <div style={{ border: "0.5px solid #e6e6e6", borderRadius: "2px", overflow: "hidden" }}>
                {history.map((item, i) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", padding: "9px 14px", gap: "10px", ...(i < history.length - 1 ? DLBDR : {}) }}>
                    <Ava username={item.username} sz={22} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                        @{item.username}{item.hasPremium === "true" && <Star />}
                      </div>
                      <div style={{ fontSize: "10px", color: "#9b9b9b", fontFamily: "'Courier New', monospace" }}>{fmtDate(item.checkedAt)}</div>
                    </div>
                    <Badge status={item.status} />
                    <a href={`https://fragment.com/username/${item.username}`} target="_blank" rel="noopener noreferrer"
                      style={{ color: "#cecece", textDecoration: "none", flexShrink: 0, transition: "color 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#0d0d0d")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#cecece")}
                    >
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* footer */}
      <footer style={{ borderTop: "0.5px solid #e6e6e6", padding: "14px 24px" }}>
        <p style={{ fontSize: "11px", color: "#9b9b9b", margin: 0, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <TonLogo />
          <a href="https://fragment.com" target="_blank" rel="noopener noreferrer"
            style={{ color: "#0d0d0d", textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
          >Fragment</a>
          <span>·</span>
          <span>Unofficial tool · Not affiliated with Telegram or Fragment</span>
        </p>
      </footer>
    </div>
  );
}
