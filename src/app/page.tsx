"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type CheckResult = {
  username: string;
  status: "Available" | "Taken" | "For Sale" | "Sold" | "Reserved" | "Unknown" | "Invalid" | string;
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

type Sort = "none" | "az" | "za" | "group";

const CSS = {
  font: { fontFamily: "var(--font-mono)" } as React.CSSProperties,
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  Available:  { label: "Available", color: "#2D9B5A", bg: "rgba(45,155,90,0.08)",   border: "rgba(45,155,90,0.3)",  dot: "#2D9B5A" },
  Taken:      { label: "Taken",     color: "#CC2200", bg: "rgba(204,34,0,0.07)",    border: "rgba(204,34,0,0.25)",  dot: "#FF4900" },
  "For Sale": { label: "For Sale",  color: "#A53DE7", bg: "rgba(165,61,231,0.07)",  border: "rgba(165,61,231,0.25)",dot: "#A53DE7" },
  Sold:       { label: "Sold",      color: "#8C8880", bg: "rgba(140,136,128,0.08)", border: "rgba(140,136,128,0.2)",dot: "#8C8880" },
  Reserved:   { label: "Reserved",  color: "#0735F5", bg: "rgba(7,53,245,0.07)",    border: "rgba(7,53,245,0.22)",  dot: "#0735F5" },
  Invalid:    { label: "Invalid",   color: "#CC2200", bg: "rgba(204,34,0,0.07)",    border: "rgba(204,34,0,0.25)",  dot: "#FF4900" },
  Unknown:    { label: "Unknown",   color: "#8C8880", bg: "rgba(140,136,128,0.08)", border: "rgba(140,136,128,0.2)",dot: "#8C8880" },
};
const getS = (s: string) =>
  STATUS_CFG[s] ?? { label: s, color: "#8C8880", bg: "rgba(140,136,128,0.08)", border: "rgba(140,136,128,0.2)", dot: "#8C8880" };

const STATUS_ORDER = ["Available", "For Sale", "Reserved", "Sold", "Taken", "Unknown", "Invalid"];
const ALPHA = "abcdefghijklmnopqrstuvwxyz".split("");

function StatusPill({ status }: { status: string }) {
  const cfg = getS(status);
  const isActive = status === "Available";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "2px 7px 2px 5px",
      background: cfg.bg,
      border: `0.5px solid ${cfg.border}`,
      borderRadius: "2px",
      fontSize: "11px",
      fontWeight: 600,
      color: cfg.color,
      letterSpacing: "0.02em",
      whiteSpace: "nowrap",
      ...CSS.font,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: cfg.dot, flexShrink: 0,
        animation: isActive ? "pulse-dot 2s ease-in-out infinite" : "none",
      }} />
      {cfg.label}
    </span>
  );
}

function TonLogo({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="28" cy="28" r="28" fill="#0098EA" />
      <path d="M38.82 17H17.18C13.64 17 11.43 20.85 13.2 23.9L26.37 46.59C27.14 47.93 29.07 47.93 29.83 46.59L43 23.9C44.57 20.85 42.36 17 38.82 17ZM25.4 35.46L19.68 25.3H25.4V35.46ZM25.4 23.3H18.03L25.4 19.5V23.3ZM30.6 35.46V25.3H36.32L30.6 35.46ZM30.6 23.3V19.5L37.97 23.3H30.6Z" fill="white"/>
    </svg>
  );
}

function Spinner({ size = 13 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(30,28,24,0.15)" strokeWidth="2.5"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="rgb(30,28,24)" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function PremiumStar() {
  return (
    <svg width="10" height="10" viewBox="0 0 20 20" fill="none" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <path d="M10 1l2.39 4.84 5.35.78-3.87 3.77.91 5.31L10 13.27l-4.78 2.51.91-5.31L2.26 6.62l5.35-.78L10 1z" fill="#E8A030" stroke="#c8830a" strokeWidth="0.5"/>
    </svg>
  );
}

function Avatar({ username, photo, size = 26 }: { username: string; photo?: string | null; size?: number }) {
  const letter = username[0]?.toUpperCase() ?? "?";
  if (photo) {
    return <img src={photo} alt={username} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "0.5px solid rgba(30,28,24,0.15)" }} />;
  }
  const hue = (letter.charCodeAt(0) * 47) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue}, 12%, 90%)`,
      border: "0.5px solid rgba(30,28,24,0.15)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.38) + "px",
      fontWeight: 700,
      color: `hsl(${hue}, 25%, 40%)`,
      flexShrink: 0,
      ...CSS.font,
    }}>
      {letter}
    </div>
  );
}

function ExtLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ color: "rgba(30,28,24,0.25)", textDecoration: "none", flexShrink: 0, transition: "color 120ms ease", display: "flex", alignItems: "center" }}
      onMouseEnter={e => (e.currentTarget.style.color = "rgb(30,28,24)")}
      onMouseLeave={e => (e.currentTarget.style.color = "rgba(30,28,24,0.25)")}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </a>
  );
}

const ROW_BORDER: React.CSSProperties = { borderBottom: "0.5px solid rgba(30,28,24,0.1)" };

function ResultRow({ r, last }: { r: CheckResult; last: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr auto 14px",
        alignItems: "center",
        padding: "8px 13px",
        gap: "10px",
        ...(!last ? ROW_BORDER : {}),
        transition: "background 100ms ease",
        cursor: "default",
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = "rgba(30,28,24,0.03)")}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
    >
      <Avatar username={r.username} photo={r.photo} size={22} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "rgb(30,28,24)", ...CSS.font }}>@{r.username}</span>
          {r.hasPremium && <PremiumStar />}
        </div>
        {r.name && (
          <div style={{ fontSize: "11px", color: "rgba(30,28,24,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...CSS.font }}>
            {r.name}
          </div>
        )}
      </div>
      <StatusPill status={r.status} />
      {r.status !== "Invalid" ? (
        <ExtLink href={`https://fragment.com/username/${r.username}`} />
      ) : <span />}
    </div>
  );
}

function StatsPills({ results }: { results: CheckResult[] }) {
  const counts = STATUS_ORDER.map(s => ({ s, n: results.filter(r => r.status === s).length })).filter(x => x.n > 0);
  if (!counts.length) return null;
  return (
    <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", marginBottom: "10px" }}>
      {counts.map(({ s, n }) => {
        const cfg = getS(s);
        return (
          <div key={s} style={{
            padding: "2px 8px",
            background: cfg.bg,
            border: `0.5px solid ${cfg.border}`,
            borderRadius: "2px",
            display: "flex", gap: "6px", alignItems: "center",
          }}>
            <span style={{ fontSize: "10px", color: cfg.color, fontWeight: 600, letterSpacing: "0.04em", ...CSS.font }}>{cfg.label}</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "rgb(30,28,24)", ...CSS.font }}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

function SortBar({ sort, setSort }: { sort: Sort; setSort: (s: Sort) => void }) {
  const opts: { k: Sort; label: string }[] = [
    { k: "none", label: "Default" },
    { k: "az", label: "A → Z" },
    { k: "za", label: "Z → A" },
    { k: "group", label: "Group" },
  ];
  return (
    <div style={{ display: "flex", gap: "2px", alignItems: "center", justifyContent: "flex-end", marginBottom: "8px" }}>
      <span style={{ fontSize: "10px", color: "rgba(30,28,24,0.4)", marginRight: "4px", letterSpacing: "0.06em", ...CSS.font }}>Sort</span>
      {opts.map(({ k, label }) => (
        <button key={k} onClick={() => setSort(k)} style={{
          background: sort === k ? "rgb(240,238,234)" : "transparent",
          border: `0.5px solid ${sort === k ? "rgba(30,28,24,0.25)" : "rgba(30,28,24,0.12)"}`,
          borderRadius: "2px",
          padding: "2px 8px",
          color: sort === k ? "rgb(30,28,24)" : "rgba(30,28,24,0.45)",
          fontSize: "11px",
          fontWeight: sort === k ? 700 : 400,
          cursor: "pointer",
          transition: "all 100ms ease",
          ...CSS.font,
        }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function GroupHeader({ status, count }: { status: string; count: number }) {
  const cfg = getS(status);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
      <span style={{ fontSize: "9px", fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.1em", ...CSS.font }}>{cfg.label}</span>
      <span style={{ fontSize: "10px", color: "rgba(30,28,24,0.4)", ...CSS.font }}>{count}</span>
      <div style={{ flex: 1, height: "0.5px", background: "rgba(30,28,24,0.1)" }} />
    </div>
  );
}

function Results({ results, sort, setSort }: { results: CheckResult[]; sort: Sort; setSort: (s: Sort) => void }) {
  const sorted =
    sort === "az" ? [...results].sort((a, b) => a.username.localeCompare(b.username))
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

  return (
    <div style={{ animation: "fadeUp 0.15s ease forwards" }}>
      <StatsPills results={results} />
      <SortBar sort={sort} setSort={setSort} />
      {sort === "group" && grouped ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {grouped.map(g => (
            <div key={g.status}>
              <GroupHeader status={g.status} count={g.items.length} />
              <div style={{ border: "0.5px solid rgba(30,28,24,0.15)", borderRadius: "2px", overflow: "hidden", background: "white" }}>
                {g.items.map((r, i) => <ResultRow key={r.username + i} r={r} last={i === g.items.length - 1} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ border: "0.5px solid rgba(30,28,24,0.15)", borderRadius: "2px", overflow: "hidden", background: "white" }}>
          {sorted.map((r, i) => <ResultRow key={i} r={r} last={i === sorted.length - 1} />)}
        </div>
      )}
    </div>
  );
}

function InputRow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      style={{
        display: "flex", alignItems: "center",
        border: `0.5px solid ${focused ? "rgba(30,28,24,0.5)" : "rgba(30,28,24,0.2)"}`,
        borderRadius: "2px",
        background: "white",
        transition: "border-color 120ms ease",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const TEXT_INPUT: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "rgb(30,28,24)",
  fontSize: "13px",
  fontWeight: 600,
  padding: "9px 8px",
  fontFamily: "var(--font-mono)",
};

function PrimaryBtn({ onClick, disabled, loading, children }: {
  onClick: () => void;
  disabled: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "rgba(30,28,24,0.06)" : "rgb(30,28,24)",
        color: disabled ? "rgba(30,28,24,0.3)" : "white",
        border: "none",
        borderRadius: "0",
        padding: "0 16px",
        height: "100%",
        minHeight: "38px",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.05em",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", gap: "6px",
        whiteSpace: "nowrap", flexShrink: 0,
        transition: "background 120ms ease, color 120ms ease",
        fontFamily: "var(--font-mono)",
        borderLeft: "0.5px solid rgba(30,28,24,0.15)",
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "rgba(30,28,24,0.88)"; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "rgb(30,28,24)"; }}
    >
      {loading ? <Spinner size={11} /> : null}
      {children}
    </button>
  );
}

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
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    setHistLoad(true);
    try {
      const d = await (await fetch("/api/history")).json() as { history: HistoryItem[] };
      setHistory(d.history ?? []);
    } catch { /**/ }
    finally { setHistLoad(false); }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const clearHistory = useCallback(async () => {
    if (!clearOk) { setClearOk(true); setTimeout(() => setClearOk(false), 3000); return; }
    try { await fetch("/api/history", { method: "DELETE" }); setHistory([]); setClearOk(false); } catch { /**/ }
  }, [clearOk]);

  const resetState = () => { setResult(null); setBatchRes([]); setSweepRes([]); setError(null); };

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
    try {
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return s; }
  };

  const TABS = [
    { key: "single"  as const, label: "Single" },
    { key: "batch"   as const, label: "Batch" },
    { key: "sweep"   as const, label: "Sweep" },
    { key: "history" as const, label: "History" },
  ];

  const ghostBtn = (danger = false, active = false): React.CSSProperties => ({
    background: active ? (danger ? "rgba(204,34,0,0.07)" : "rgba(30,28,24,0.06)") : "transparent",
    border: `0.5px solid ${active ? (danger ? "rgba(204,34,0,0.4)" : "rgba(30,28,24,0.3)") : "rgba(30,28,24,0.15)"}`,
    borderRadius: "2px",
    padding: "4px 10px",
    color: active ? (danger ? "#CC2200" : "rgb(30,28,24)") : "rgba(30,28,24,0.5)",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex", alignItems: "center", gap: "5px",
    transition: "all 100ms ease",
    ...CSS.font,
  });

  return (
    <>
      <style>{`
        html { zoom: 1.2; background: rgb(242,240,237) !important; }
        body { background: rgb(242,240,237) !important; color: rgb(30,28,24) !important; }
        body::before { display: none !important; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 0.7s linear infinite; }
        @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        * { box-sizing: border-box; }
        textarea { box-sizing: border-box; }
        ::selection { background: rgba(7,53,245,0.12); }
        ::-webkit-scrollbar { width:3px; height:3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(30,28,24,0.2); border-radius:0; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "rgb(242,240,237)", color: "rgb(30,28,24)", display: "flex", flexDirection: "column" }}>

        <main style={{ maxWidth: "620px", width: "100%", margin: "0 auto", padding: "32px 24px 80px", flex: 1 }}>

          <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: "0.5px solid rgba(30,28,24,0.1)" }}>
            <h1 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 5px", letterSpacing: "-0.01em", color: "rgb(30,28,24)", ...CSS.font }}>
              Username Tool
            </h1>
            <p style={{ fontSize: "12px", color: "rgba(30,28,24,0.45)", margin: 0, ...CSS.font }}>
              Search Fragment for available Telegram usernames. Real-time availability data.
            </p>
          </div>

          <div style={{ display: "flex", borderBottom: "0.5px solid rgba(30,28,24,0.12)", marginBottom: "24px" }}>
            {TABS.map(({ key, label }) => {
              const active = mode === key;
              return (
                <button key={key}
                  onClick={() => { setMode(key); resetState(); if (key === "history") void loadHistory(); }}
                  style={{
                    padding: "7px 14px",
                    border: "none",
                    borderBottom: `1.5px solid ${active ? "rgb(30,28,24)" : "transparent"}`,
                    background: "transparent",
                    color: active ? "rgb(30,28,24)" : "rgba(30,28,24,0.4)",
                    fontWeight: active ? 700 : 400,
                    fontSize: "12px",
                    letterSpacing: "0.04em",
                    cursor: "pointer",
                    marginBottom: "-0.5px",
                    transition: "color 100ms ease, border-color 100ms ease",
                    ...CSS.font,
                  }}
                >{label}</button>
              );
            })}
          </div>

          {error && (
            <div style={{
              padding: "9px 12px",
              border: "0.5px solid rgba(204,34,0,0.3)",
              background: "rgba(204,34,0,0.06)",
              borderRadius: "2px",
              color: "#CC2200",
              fontSize: "12px",
              marginBottom: "14px",
              display: "flex", alignItems: "flex-start", gap: "8px",
              animation: "fadeUp 0.15s ease forwards",
              ...CSS.font,
            }}>
              <span style={{ flexShrink: 0, marginTop: "1px" }}>✕</span>
              <span>{error}</span>
            </div>
          )}

          {mode === "single" && (
            <div>
              <InputRow style={{ marginBottom: "5px" }}>
                <span style={{ padding: "0 4px 0 13px", color: "rgba(30,28,24,0.3)", fontSize: "15px", userSelect: "none", flexShrink: 0, ...CSS.font }}>@</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => { setInput(e.target.value); setResult(null); setError(null); }}
                  onKeyDown={e => { if (e.key === "Enter") void checkSingle(); }}
                  placeholder="username"
                  autoFocus
                  autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                  style={TEXT_INPUT}
                />
                <PrimaryBtn onClick={() => void checkSingle()} disabled={loading || !input.trim()} loading={loading}>
                  {loading ? "Checking" : "Check"}
                </PrimaryBtn>
              </InputRow>
              <p style={{ fontSize: "10px", color: "rgba(30,28,24,0.35)", marginBottom: "24px", marginTop: "4px", ...CSS.font }}>
                3–32 chars * letters, numbers, underscores * press Enter
              </p>

              {result && !error && (
                <div style={{ border: "0.5px solid rgba(30,28,24,0.15)", borderRadius: "2px", overflow: "hidden", background: "white", animation: "fadeUp 0.15s ease forwards" }}>
                  <div style={{
                    padding: "8px 13px",
                    background: "rgb(246,246,244)",
                    borderBottom: "0.5px solid rgba(30,28,24,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                  }}>
                    <span style={{ fontSize: "10px", color: "rgba(30,28,24,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...CSS.font }}>
                      fragment.com/username/{result.username}
                    </span>
                    <StatusPill status={result.status} />
                  </div>
                  <div style={{ padding: "14px 13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "11px", marginBottom: "14px" }}>
                      <Avatar username={result.username} photo={result.photo} size={40} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ fontSize: "15px", fontWeight: 700, color: "rgb(30,28,24)", ...CSS.font }}>@{result.username}</span>
                          {result.hasPremium && <PremiumStar />}
                        </div>
                        {result.name && (
                          <div style={{ fontSize: "12px", color: "rgba(30,28,24,0.45)", marginTop: "2px", ...CSS.font }}>{result.name}</div>
                        )}
                        {result.status === "Reserved" && (
                          <div style={{ fontSize: "11px", color: "#0735F5", marginTop: "4px", ...CSS.font }}>
                            Reserved by Telegram * cannot be registered
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                      {[
                        { href: `https://fragment.com/username/${result.username}`, label: "View on Fragment", icon: <TonLogo size={11} /> },
                        { href: `https://t.me/${result.username}`, label: "Open in Telegram", icon: null },
                      ].map(({ href, label, icon }) => (
                        <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: "5px",
                            padding: "5px 10px",
                            border: "0.5px solid rgba(30,28,24,0.18)",
                            borderRadius: "2px",
                            background: "rgb(246,246,244)",
                            color: "rgb(30,28,24)",
                            textDecoration: "none",
                            fontSize: "11px",
                            fontWeight: 600,
                            transition: "background 100ms ease, border-color 100ms ease",
                            ...CSS.font,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(30,28,24,0.06)"; e.currentTarget.style.borderColor = "rgba(30,28,24,0.3)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgb(246,246,244)"; e.currentTarget.style.borderColor = "rgba(30,28,24,0.18)"; }}
                        >
                          {icon}{label}
                        </a>
                      ))}
                    </div>
                  </div>
                  {result.source && (
                    <div style={{ padding: "5px 13px", borderTop: "0.5px solid rgba(30,28,24,0.08)", background: "rgb(246,246,244)", fontSize: "10px", color: "rgba(30,28,24,0.35)", ...CSS.font }}>
                      source: {result.source}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === "batch" && (
            <div>
              <div style={{ border: "0.5px solid rgba(30,28,24,0.15)", borderRadius: "2px", overflow: "hidden", marginBottom: "10px", background: "white" }}>
                <div style={{
                  padding: "6px 12px",
                  background: "rgb(246,246,244)",
                  borderBottom: "0.5px solid rgba(30,28,24,0.1)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: "10px", color: "rgba(30,28,24,0.45)", letterSpacing: "0.04em", ...CSS.font }}>Single? Only Batch.</span>
                  <span style={{ fontSize: "11px", color: "rgba(30,28,24,0.6)", fontWeight: 600, ...CSS.font }}>
                    {batchInput.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).length}
                    <span style={{ color: "rgba(30,28,24,0.3)", fontWeight: 400 }}>/200</span>
                  </span>
                </div>
                <textarea
                  value={batchInput}
                  onChange={e => { setBatchInput(e.target.value); setError(null); setBatchRes([]); }}
                  placeholder={"username1\nusername2\nusername3"}
                  rows={8}
                  style={{
                    width: "100%",
                    background: "white",
                    border: "none", outline: "none",
                    color: "rgb(30,28,24)",
                    fontSize: "13px",
                    fontWeight: 600,
                    padding: "10px 12px",
                    resize: "vertical",
                    lineHeight: 1.7,
                    ...CSS.font,
                  }}
                />
              </div>
              <div style={{ marginBottom: "18px" }}>
                <InputRow>
                  <PrimaryBtn onClick={() => void checkBatch()} disabled={loading || !batchInput.trim()} loading={loading}>
                    {loading ? "Checking…" : "Check all"}
                  </PrimaryBtn>
                </InputRow>
              </div>
              {batchRes.length > 0 && <Results results={batchRes} sort={batchSort} setSort={setBatchSort} />}
            </div>
          )}

          {mode === "sweep" && (
            <div>
              <div style={{
                padding: "9px 12px",
                background: "rgba(7,53,245,0.05)",
                border: "0.5px solid rgba(7,53,245,0.2)",
                borderRadius: "2px",
                fontSize: "12px",
                color: "rgba(30,28,24,0.6)",
                marginBottom: "18px",
                lineHeight: 1.55,
                ...CSS.font,
              }}>
                Checks the exact username + all 26 letter variants (a–z appended or prepended).{" "}
                <span style={{ color: "rgb(30,28,24)", fontWeight: 700 }}>27 requests total.</span>
              </div>
              <InputRow style={{ marginBottom: "9px" }}>
                <span style={{ padding: "0 4px 0 13px", color: "rgba(30,28,24,0.3)", fontSize: "15px", userSelect: "none", flexShrink: 0, ...CSS.font }}>@</span>
                <input
                  type="text"
                  value={sweepInput}
                  onChange={e => { setSweepInput(e.target.value); setError(null); setSweepRes([]); }}
                  onKeyDown={e => { if (e.key === "Enter") void checkSweep(); }}
                  placeholder="username"
                  autoFocus
                  autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                  style={TEXT_INPUT}
                />
                <PrimaryBtn onClick={() => void checkSweep()} disabled={loading || !sweepInput.trim()} loading={loading}>
                  {loading ? "Sweeping…" : "Sweep"}
                </PrimaryBtn>
              </InputRow>
              <div style={{ display: "flex", gap: "3px", alignItems: "center", marginBottom: "14px" }}>
                <span style={{ fontSize: "10px", color: "rgba(30,28,24,0.4)", letterSpacing: "0.05em", marginRight: "5px", ...CSS.font }}>Mode</span>
                {(["suffix", "prefix"] as const).map(k => (
                  <button key={k} onClick={() => setSweepPos(k)} style={{
                    background: sweepPos === k ? "rgb(240,238,234)" : "transparent",
                    border: `0.5px solid ${sweepPos === k ? "rgba(30,28,24,0.25)" : "rgba(30,28,24,0.12)"}`,
                    borderRadius: "2px",
                    padding: "3px 9px",
                    color: sweepPos === k ? "rgb(30,28,24)" : "rgba(30,28,24,0.4)",
                    fontSize: "11px",
                    fontWeight: sweepPos === k ? 700 : 400,
                    cursor: "pointer",
                    transition: "all 100ms ease",
                    ...CSS.font,
                  }}>
                    {k === "suffix" ? "username + a" : "a + username"}
                  </button>
                ))}
              </div>
              {sweepInput.trim() && (
                <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", marginBottom: "18px" }}>
                  {[sweepInput.trim().toLowerCase(), ...ALPHA.slice(0, 5).map(l => sweepPos === "suffix" ? `${sweepInput.trim().toLowerCase()}${l}` : `${l}${sweepInput.trim().toLowerCase()}`)].map((u, i) => (
                    <span key={i} style={{
                      background: i === 0 ? "rgb(30,28,24)" : "rgb(240,238,234)",
                      border: `0.5px solid ${i === 0 ? "rgb(30,28,24)" : "rgba(30,28,24,0.15)"}`,
                      borderRadius: "2px",
                      padding: "2px 7px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: i === 0 ? "white" : "rgba(30,28,24,0.6)",
                      ...CSS.font,
                    }}>{u}</span>
                  ))}
                  <span style={{ fontSize: "11px", color: "rgba(30,28,24,0.35)", alignSelf: "center", ...CSS.font }}>+{26 - 5} more</span>
                </div>
              )}
              {sweepRes.length > 0 && (
                <div style={{ animation: "fadeUp 0.15s ease forwards" }}>
                  {sweepRes[0] && (
                    <div style={{ marginBottom: "14px" }}>
                      <div style={{ fontSize: "9px", fontWeight: 700, color: "rgba(30,28,24,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px", ...CSS.font }}>Original</div>
                      <div style={{ border: "0.5px solid rgba(7,53,245,0.25)", borderRadius: "2px", overflow: "hidden", background: "white" }}>
                        <ResultRow r={sweepRes[0]} last />
                      </div>
                    </div>
                  )}
                  {sweepRes.length > 1 && (
                    <div>
                      <div style={{ fontSize: "9px", fontWeight: 700, color: "rgba(30,28,24,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px", ...CSS.font }}>Letter variants a–z</div>
                      <Results results={sweepRes.slice(1)} sort={sweepSort} setSort={setSweepSort} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === "history" && (
            <div style={{ animation: "fadeUp 0.15s ease forwards" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", color: "rgba(30,28,24,0.5)", ...CSS.font }}>
                  Recent checks
                </span>
                <div style={{ display: "flex", gap: "3px" }}>
                  <button onClick={() => void loadHistory()} style={ghostBtn()}>
                    {histLoad ? <Spinner size={10} /> : "Refresh"}
                  </button>
                  {history.length > 0 && (
                    <button onClick={() => void clearHistory()} style={ghostBtn(true, clearOk)}>
                      {clearOk ? "Confirm?" : "Clear"}
                    </button>
                  )}
                </div>
              </div>
              {history.length === 0 ? (
                <div style={{
                  padding: "40px 16px",
                  textAlign: "center",
                  border: "0.5px solid rgba(30,28,24,0.12)",
                  borderRadius: "2px",
                  color: "rgba(30,28,24,0.35)",
                  fontSize: "12px",
                  background: "white",
                  ...CSS.font,
                }}>
                  No checks yet.
                </div>
              ) : (
                <div style={{ border: "0.5px solid rgba(30,28,24,0.15)", borderRadius: "2px", overflow: "hidden", background: "white" }}>
                  {history.map((item, i) => (
                    <div key={item.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "24px 1fr auto 14px",
                        alignItems: "center",
                        padding: "8px 13px",
                        gap: "10px",
                        ...(i < history.length - 1 ? ROW_BORDER : {}),
                        transition: "background 100ms ease",
                      }}
                      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = "rgba(30,28,24,0.03)")}
                      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                    >
                      <Avatar username={item.username} size={22} />
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", color: "rgb(30,28,24)", ...CSS.font }}>
                          @{item.username}{item.hasPremium === "true" && <PremiumStar />}
                        </div>
                        <div style={{ fontSize: "10px", color: "rgba(30,28,24,0.35)", ...CSS.font }}>{fmtDate(item.checkedAt)}</div>
                      </div>
                      <StatusPill status={item.status} />
                      <ExtLink href={`https://fragment.com/username/${item.username}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        <footer style={{
          borderTop: "0.5px solid rgba(30,28,24,0.12)",
          padding: "10px 24px",
          background: "white",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <TonLogo size={11} />
            <span style={{ fontSize: "10px", color: "rgba(30,28,24,0.35)", ...CSS.font }}>Unofficial tool * Not affiliated with Telegram or Fragment</span>
            <span style={{ color: "rgba(30,28,24,0.2)", fontSize: "10px" }}>*</span>
            <a
              href="https://fragment.com"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "10px", color: "rgba(30,28,24,0.45)", textDecoration: "none", transition: "color 100ms ease", ...CSS.font }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgb(30,28,24)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(30,28,24,0.45)")}
            >
              fragment.com
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}
