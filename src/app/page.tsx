"use client";

import { useState, useCallback, useRef, useEffect } from "react";

/* ── Types ─────────────────────────────────────────────── */
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

type Sort = "none" | "az" | "za" | "group";

/* ── Status config ──────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  Available:  { label: "Available", color: "var(--green)",  bg: "var(--green-dim)",  dot: "#35c96b" },
  Taken:      { label: "Taken",     color: "var(--red)",    bg: "var(--red-dim)",    dot: "#f04040" },
  "For Sale": { label: "For Sale",  color: "var(--yellow)", bg: "var(--yellow-dim)", dot: "#e8a030" },
  Sold:       { label: "Sold",      color: "var(--t-2)",    bg: "var(--muted-dim)",  dot: "#55555f" },
  Invalid:    { label: "Invalid",   color: "var(--red)",    bg: "var(--red-dim)",    dot: "#f04040" },
  Unknown:    { label: "Unknown",   color: "var(--t-2)",    bg: "var(--muted-dim)",  dot: "#55555f" },
};
const getS = (s: string) => STATUS_CFG[s] ?? { label: s, color: "var(--t-2)", bg: "var(--muted-dim)", dot: "#55555f" };

const STATUS_ORDER = ["Available", "For Sale", "Sold", "Taken", "Unknown", "Invalid"];
const ALPHA = "abcdefghijklmnopqrstuvwxyz".split("");

/* ── Shared style constants ─────────────────────────────── */
const FONT = { fontFamily: "var(--font-mono)" } as const;

const LINE_BOTTOM: React.CSSProperties = {
  borderBottom: "1px solid var(--line)",
};

/* ── Sub-components ─────────────────────────────────────── */

function StatusDot({ status }: { status: string }) {
  const cfg = getS(status);
  const isActive = status === "Available";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: "2px 8px 2px 6px",
      background: cfg.bg,
      border: `1px solid ${cfg.color}22`,
      borderRadius: "2px",
      fontSize: "11px",
      fontWeight: 700,
      color: cfg.color,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      ...FONT,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: cfg.dot, flexShrink: 0,
        animation: isActive ? "pulse-dot 2s ease-in-out infinite" : "none",
        boxShadow: isActive ? `0 0 6px ${cfg.dot}88` : "none",
      }} />
      {cfg.label}
    </span>
  );
}

function TonLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="28" cy="28" r="28" fill="#0098EA" />
      <path d="M38.82 17H17.18C13.64 17 11.43 20.85 13.2 23.9L26.37 46.59C27.14 47.93 29.07 47.93 29.83 46.59L43 23.9C44.57 20.85 42.36 17 38.82 17ZM25.4 35.46L19.68 25.3H25.4V35.46ZM25.4 23.3H18.03L25.4 19.5V23.3ZM30.6 35.46V25.3H36.32L30.6 35.46ZM30.6 23.3V19.5L37.97 23.3H30.6Z" fill="white"/>
    </svg>
  );
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="var(--line-hi)" strokeWidth="2.5"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--t-0)" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function PremiumStar() {
  return (
    <svg width="10" height="10" viewBox="0 0 20 20" fill="none" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <path d="M10 1l2.39 4.84 5.35.78-3.87 3.77.91 5.31L10 13.27l-4.78 2.51.91-5.31L2.26 6.62l5.35-.78L10 1z" fill="#FFD700" stroke="#c8a800" strokeWidth="0.5"/>
    </svg>
  );
}

function Avatar({ username, photo, size = 28 }: { username: string; photo?: string | null; size?: number }) {
  const letter = username[0]?.toUpperCase() ?? "?";
  if (photo) {
    return <img src={photo} alt={username} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid var(--line)" }} />;
  }
  // Hash the letter to a hue
  const hue = (letter.charCodeAt(0) * 47) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue}, 18%, 18%)`,
      border: "1px solid var(--line-hi)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.38) + "px",
      fontWeight: 700,
      color: `hsl(${hue}, 40%, 65%)`,
      flexShrink: 0,
      ...FONT,
    }}>
      {letter}
    </div>
  );
}

function ExtLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ color: "var(--t-3)", textDecoration: "none", flexShrink: 0, transition: "color var(--transition)", display: "flex", alignItems: "center" }}
      onMouseEnter={e => (e.currentTarget.style.color = "var(--t-0)")}
      onMouseLeave={e => (e.currentTarget.style.color = "var(--t-3)")}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </a>
  );
}

/* Row in results table */
function ResultRow({ r, last }: { r: CheckResult; last: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr auto 12px",
        alignItems: "center",
        padding: "8px 14px",
        gap: "10px",
        ...(!last ? LINE_BOTTOM : {}),
        transition: "background var(--transition)",
        cursor: "default",
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-2)")}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
    >
      <Avatar username={r.username} photo={r.photo} size={24} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--t-0)", ...FONT }}>@{r.username}</span>
          {r.hasPremium && <PremiumStar />}
        </div>
        {r.name && (
          <div style={{ fontSize: "11px", color: "var(--t-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...FONT }}>
            {r.name}
          </div>
        )}
      </div>
      <StatusDot status={r.status} />
      {r.status !== "Invalid" ? (
        <ExtLink href={`https://fragment.com/username/${r.username}`} />
      ) : <span />}
    </div>
  );
}

/* Stats bar above results */
function StatsPills({ results }: { results: CheckResult[] }) {
  const counts = STATUS_ORDER.map(s => ({ s, n: results.filter(r => r.status === s).length })).filter(x => x.n > 0);
  if (!counts.length) return null;
  return (
    <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", marginBottom: "10px" }}>
      {counts.map(({ s, n }) => {
        const cfg = getS(s);
        return (
          <div key={s} style={{
            padding: "3px 9px",
            background: cfg.bg,
            border: `1px solid ${cfg.color}22`,
            borderRadius: "2px",
            display: "flex", gap: "7px", alignItems: "center",
          }}>
            <span style={{ fontSize: "10px", color: cfg.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", ...FONT }}>{cfg.label}</span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--t-0)", ...FONT }}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

/* Sort controls */
function SortBar({ sort, setSort }: { sort: Sort; setSort: (s: Sort) => void }) {
  const opts: { k: Sort; label: string }[] = [
    { k: "none", label: "Default" },
    { k: "az", label: "A → Z" },
    { k: "za", label: "Z → A" },
    { k: "group", label: "Group" },
  ];
  return (
    <div style={{ display: "flex", gap: "3px", alignItems: "center", justifyContent: "flex-end", marginBottom: "8px" }}>
      <span style={{ fontSize: "10px", color: "var(--t-2)", marginRight: "5px", textTransform: "uppercase", letterSpacing: "0.06em", ...FONT }}>Sort</span>
      {opts.map(({ k, label }) => (
        <button key={k} onClick={() => setSort(k)} style={{
          background: sort === k ? "var(--bg-3)" : "transparent",
          border: `1px solid ${sort === k ? "var(--line-hi)" : "var(--line)"}`,
          borderRadius: "2px",
          padding: "2px 8px",
          color: sort === k ? "var(--t-0)" : "var(--t-2)",
          fontSize: "11px",
          fontWeight: sort === k ? 700 : 400,
          cursor: "pointer",
          transition: "all var(--transition)",
          ...FONT,
        }}>
          {label}
        </button>
      ))}
    </div>
  );
}

/* Group label header */
function GroupHeader({ status, count }: { status: string; count: number }) {
  const cfg = getS(status);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
      <span style={{ fontSize: "9px", fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.1em", ...FONT }}>{cfg.label}</span>
      <span style={{ fontSize: "10px", color: "var(--t-2)", ...FONT }}>{count}</span>
      <div style={{ flex: 1, height: "1px", background: "var(--line)" }} />
    </div>
  );
}

/* Full results panel */
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
    <div className="fade-up">
      <StatsPills results={results} />
      <SortBar sort={sort} setSort={setSort} />

      {sort === "group" && grouped ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {grouped.map(g => (
            <div key={g.status}>
              <GroupHeader status={g.status} count={g.items.length} />
              <div style={{ border: "1px solid var(--line)", borderRadius: "2px", overflow: "hidden" }}>
                {g.items.map((r, i) => <ResultRow key={r.username + i} r={r} last={i === g.items.length - 1} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ border: "1px solid var(--line)", borderRadius: "2px", overflow: "hidden" }}>
          {sorted.map((r, i) => <ResultRow key={i} r={r} last={i === sorted.length - 1} />)}
        </div>
      )}
    </div>
  );
}

/* ── Shared input styles ─────────────────────────────────── */
function InputWrap({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      style={{
        display: "flex", alignItems: "center",
        border: `1px solid ${focused ? "var(--t-1)" : "var(--line)"}`,
        borderRadius: "2px",
        background: "var(--bg-1)",
        transition: "border-color var(--transition)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const textInputStyle: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "var(--t-0)",
  fontSize: "14px",
  fontWeight: 700,
  padding: "10px 8px",
  ...FONT,
};

function PrimaryBtn({
  onClick, disabled, loading, children,
}: {
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
        background: disabled ? "var(--bg-3)" : "var(--t-0)",
        color: disabled ? "var(--t-2)" : "var(--bg-0)",
        border: "none",
        borderRadius: "0",
        padding: "0 18px",
        height: "100%",
        minHeight: "40px",
        fontSize: "12px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", gap: "7px",
        whiteSpace: "nowrap", flexShrink: 0,
        transition: "background var(--transition), color var(--transition)",
        ...FONT,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "#d8d8da"; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "var(--t-0)"; }}
    >
      {loading ? <Spinner size={12} /> : null}
      {children}
    </button>
  );
}

/* ── Main page ───────────────────────────────────────────── */
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
    background: "transparent",
    border: `1px solid ${active ? (danger ? "var(--red)" : "var(--line-hi)") : "var(--line)"}`,
    borderRadius: "2px",
    padding: "4px 10px",
    color: active ? (danger ? "var(--red)" : "var(--t-0)") : "var(--t-1)",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    cursor: "pointer",
    display: "flex", alignItems: "center", gap: "5px",
    transition: "all var(--transition)",
    ...FONT,
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)", color: "var(--t-0)", display: "flex", flexDirection: "column" }}>

      {/* ── Top bar ── */}

      {/* ── Main ── */}
      <main style={{ maxWidth: "600px", width: "100%", margin: "0 auto", padding: "36px 24px 80px", flex: 1 }}>

        {/* Page title */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em", ...FONT }}>
            Username Checker
          </h1>
          <p style={{ fontSize: "12px", color: "var(--t-2)", margin: 0, ...FONT }}>
            Check Telegram username availability on the Fragment marketplace.
          </p>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--line)", marginBottom: "28px", gap: "0" }}>
          {TABS.map(({ key, label }) => {
            const active = mode === key;
            return (
              <button key={key}
                onClick={() => { setMode(key); resetState(); if (key === "history") void loadHistory(); }}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderBottom: `2px solid ${active ? "var(--t-0)" : "transparent"}`,
                  background: "transparent",
                  color: active ? "var(--t-0)" : "var(--t-2)",
                  fontWeight: active ? 700 : 400,
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                  marginBottom: "-1px",
                  transition: "color var(--transition), border-color var(--transition)",
                  ...FONT,
                }}
              >{label}</button>
            );
          })}
        </div>

        {/* ── ERROR banner ── */}
        {error && (
          <div className="fade-up" style={{
            padding: "10px 14px",
            border: "1px solid var(--red-dim)",
            background: "var(--red-dim)",
            borderRadius: "2px",
            color: "var(--red)",
            fontSize: "12px",
            marginBottom: "16px",
            display: "flex", alignItems: "flex-start", gap: "8px",
            ...FONT,
          }}>
            <span style={{ flexShrink: 0, marginTop: "1px" }}>✕</span>
            <span>{error}</span>
          </div>
        )}

        {/* ══ SINGLE ══ */}
        {mode === "single" && (
          <div>
            <InputWrap style={{ marginBottom: "6px" }}>
              <span style={{ padding: "0 2px 0 14px", color: "var(--t-2)", fontSize: "16px", userSelect: "none", flexShrink: 0, fontWeight: 400, ...FONT }}>@</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => { setInput(e.target.value); setResult(null); setError(null); }}
                onKeyDown={e => { if (e.key === "Enter") void checkSingle(); }}
                placeholder="username"
                autoFocus
                autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                style={textInputStyle}
              />
              <PrimaryBtn onClick={() => void checkSingle()} disabled={loading || !input.trim()} loading={loading}>
                {loading ? "Checking" : "Check"}
              </PrimaryBtn>
            </InputWrap>
            <p style={{ fontSize: "10px", color: "var(--t-2)", marginBottom: "28px", marginTop: "4px", ...FONT }}>
              3–32 chars · letters, numbers, underscores · press Enter
            </p>

            {result && !error && (
              <div className="fade-up" style={{ border: "1px solid var(--line)", borderRadius: "2px", overflow: "hidden" }}>
                {/* Card header */}
                <div style={{
                  padding: "8px 14px",
                  background: "var(--bg-2)",
                  borderBottom: "1px solid var(--line)",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                }}>
                  <span style={{ fontSize: "10px", color: "var(--t-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...FONT }}>
                    fragment.com/username/{result.username}
                  </span>
                  <StatusDot status={result.status} />
                </div>

                {/* Card body */}
                <div style={{ padding: "16px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                    <Avatar username={result.username} photo={result.photo} size={42} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "16px", fontWeight: 700, ...FONT }}>@{result.username}</span>
                        {result.hasPremium && <PremiumStar />}
                      </div>
                      {result.name && (
                        <div style={{ fontSize: "12px", color: "var(--t-2)", marginTop: "2px", ...FONT }}>{result.name}</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {[
                      { href: `https://fragment.com/username/${result.username}`, label: "View on Fragment", icon: <TonLogo size={12} /> },
                      { href: `https://t.me/${result.username}`, label: "Open in Telegram", icon: null },
                    ].map(({ href, label, icon }) => (
                      <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: "6px",
                          padding: "5px 11px",
                          border: "1px solid var(--line)",
                          borderRadius: "2px",
                          background: "var(--bg-2)",
                          color: "var(--t-0)",
                          textDecoration: "none",
                          fontSize: "11px",
                          fontWeight: 700,
                          letterSpacing: "0.03em",
                          transition: "background var(--transition), border-color var(--transition)",
                          ...FONT,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-3)"; e.currentTarget.style.borderColor = "var(--line-hi)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-2)"; e.currentTarget.style.borderColor = "var(--line)"; }}
                      >
                        {icon}{label}
                      </a>
                    ))}
                  </div>
                </div>

                {result.source && (
                  <div style={{ padding: "5px 14px", borderTop: "1px solid var(--line)", background: "var(--bg-2)", fontSize: "10px", color: "var(--t-2)", ...FONT }}>
                    source: {result.source}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ BATCH ══ */}
        {mode === "batch" && (
          <div>
            <div style={{ border: "1px solid var(--line)", borderRadius: "2px", overflow: "hidden", marginBottom: "10px" }}>
              <div style={{
                padding: "7px 12px",
                background: "var(--bg-2)",
                borderBottom: "1px solid var(--line)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: "10px", color: "var(--t-2)", textTransform: "uppercase", letterSpacing: "0.06em", ...FONT }}>One per line · comma or semicolon OK</span>
                <span style={{ fontSize: "11px", color: "var(--t-1)", fontWeight: 700, ...FONT }}>
                  {batchInput.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).length}
                  <span style={{ color: "var(--t-2)", fontWeight: 400 }}>/200</span>
                </span>
              </div>
              <textarea
                value={batchInput}
                onChange={e => { setBatchInput(e.target.value); setError(null); setBatchRes([]); }}
                placeholder={"username1\nusername2\nusername3"}
                rows={8}
                style={{
                  width: "100%",
                  background: "var(--bg-1)",
                  border: "none", outline: "none",
                  color: "var(--t-0)",
                  fontSize: "13px",
                  fontWeight: 700,
                  padding: "10px 12px",
                  resize: "vertical",
                  lineHeight: 1.7,
                  ...FONT,
                }}
              />
            </div>

            <InputWrap style={{ marginBottom: "18px", cursor: loading || !batchInput.trim() ? "not-allowed" : "pointer" }}>
              <PrimaryBtn onClick={() => void checkBatch()} disabled={loading || !batchInput.trim()} loading={loading}>
                {loading ? "Checking" : "Check all"}
              </PrimaryBtn>
            </InputWrap>

            {batchRes.length > 0 && <Results results={batchRes} sort={batchSort} setSort={setBatchSort} />}
          </div>
        )}

        {/* ══ SWEEP ══ */}
        {mode === "sweep" && (
          <div>
            {/* Info box */}
            <div style={{
              padding: "10px 14px",
              background: "var(--ton-glow)",
              border: "1px solid var(--ton-dim)",
              borderRadius: "2px",
              fontSize: "12px",
              color: "var(--t-1)",
              marginBottom: "20px",
              lineHeight: 1.6,
              ...FONT,
            }}>
              Checks the exact username + all 26 letter variants (a–z appended or prepended).
              {" "}<span style={{ color: "var(--t-0)", fontWeight: 700 }}>27 requests total.</span>
            </div>

            <InputWrap style={{ marginBottom: "10px" }}>
              <span style={{ padding: "0 2px 0 14px", color: "var(--t-2)", fontSize: "16px", userSelect: "none", flexShrink: 0, ...FONT }}>@</span>
              <input
                type="text"
                value={sweepInput}
                onChange={e => { setSweepInput(e.target.value); setError(null); setSweepRes([]); }}
                onKeyDown={e => { if (e.key === "Enter") void checkSweep(); }}
                placeholder="baseusername"
                autoFocus
                autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                style={textInputStyle}
              />
              <PrimaryBtn onClick={() => void checkSweep()} disabled={loading || !sweepInput.trim()} loading={loading}>
                {loading ? "Sweeping" : "Sweep"}
              </PrimaryBtn>
            </InputWrap>

            {/* Prefix / suffix toggle */}
            <div style={{ display: "flex", gap: "4px", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontSize: "10px", color: "var(--t-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: "6px", ...FONT }}>Mode</span>
              {(["suffix", "prefix"] as const).map(k => (
                <button key={k} onClick={() => setSweepPos(k)} style={{
                  background: sweepPos === k ? "var(--bg-3)" : "transparent",
                  border: `1px solid ${sweepPos === k ? "var(--line-hi)" : "var(--line)"}`,
                  borderRadius: "2px",
                  padding: "3px 10px",
                  color: sweepPos === k ? "var(--t-0)" : "var(--t-2)",
                  fontSize: "11px",
                  fontWeight: sweepPos === k ? 700 : 400,
                  cursor: "pointer",
                  transition: "all var(--transition)",
                  ...FONT,
                }}>
                  {k === "suffix" ? "john + a" : "a + john"}
                </button>
              ))}
            </div>

            {/* Preview chips */}
            {sweepInput.trim() && (
              <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", marginBottom: "20px" }}>
                {[sweepInput.trim().toLowerCase(), ...ALPHA.slice(0, 5).map(l => sweepPos === "suffix" ? `${sweepInput.trim().toLowerCase()}${l}` : `${l}${sweepInput.trim().toLowerCase()}`)].map((u, i) => (
                  <span key={i} style={{
                    background: i === 0 ? "var(--t-0)" : "var(--bg-2)",
                    border: `1px solid ${i === 0 ? "var(--t-0)" : "var(--line)"}`,
                    borderRadius: "2px",
                    padding: "2px 8px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: i === 0 ? "var(--bg-0)" : "var(--t-1)",
                    ...FONT,
                  }}>{u}</span>
                ))}
                <span style={{ fontSize: "11px", color: "var(--t-2)", alignSelf: "center", ...FONT }}>+{26 - 5} more</span>
              </div>
            )}

            {sweepRes.length > 0 && (
              <div className="fade-up">
                {sweepRes[0] && (
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--t-2)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px", ...FONT }}>Original</div>
                    <div style={{ border: "1px solid var(--ton-dim)", borderRadius: "2px", overflow: "hidden" }}>
                      <ResultRow r={sweepRes[0]} last />
                    </div>
                  </div>
                )}
                {sweepRes.length > 1 && (
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--t-2)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px", ...FONT }}>Letter variants a–z</div>
                    <Results results={sweepRes.slice(1)} sort={sweepSort} setSort={setSweepSort} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ HISTORY ══ */}
        {mode === "history" && (
          <div className="fade-up">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--t-1)", ...FONT }}>
                Recent checks
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button onClick={() => void loadHistory()} style={ghostBtn()}>
                  {histLoad ? <Spinner size={10} /> : "↻"} Refresh
                </button>
                {history.length > 0 && (
                  <button onClick={() => void clearHistory()} style={ghostBtn(true, clearOk)}>
                    {clearOk ? "Sure?" : "Clear"}
                  </button>
                )}
              </div>
            </div>

            {history.length === 0 ? (
              <div style={{
                padding: "40px 16px",
                textAlign: "center",
                border: "1px solid var(--line)",
                borderRadius: "2px",
                color: "var(--t-2)",
                fontSize: "12px",
                ...FONT,
              }}>
                No checks yet.
              </div>
            ) : (
              <div style={{ border: "1px solid var(--line)", borderRadius: "2px", overflow: "hidden" }}>
                {history.map((item, i) => (
                  <div key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "22px 1fr auto 12px",
                      alignItems: "center",
                      padding: "9px 14px",
                      gap: "10px",
                      ...(i < history.length - 1 ? LINE_BOTTOM : {}),
                      transition: "background var(--transition)",
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-2)")}
                    onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                  >
                    <Avatar username={item.username} size={22} />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px", ...FONT }}>
                        @{item.username}{item.hasPremium === "true" && <PremiumStar />}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--t-2)", ...FONT }}>{fmtDate(item.checkedAt)}</div>
                    </div>
                    <StatusDot status={item.status} />
                    <ExtLink href={`https://fragment.com/username/${item.username}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--line)", padding: "12px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <TonLogo size={12} />
          <span style={{ fontSize: "10px", color: "var(--t-2)", ...FONT }}>Unofficial tool · Not affiliated with Telegram or Fragment</span>
          <span style={{ color: "var(--t-3)", fontSize: "10px" }}>·</span>
          <a
            href="https://fragment.com"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: "10px", color: "var(--t-1)", textDecoration: "none", transition: "color var(--transition)", ...FONT }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--t-0)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--t-1)")}
          >
            fragment.com
          </a>
        </div>
      </footer>
    </div>
  );
}
