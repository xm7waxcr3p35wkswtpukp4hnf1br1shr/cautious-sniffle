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
type SweepMode = "alpha-suffix" | "alpha-prefix" | "digit-suffix";
type GenSweepMode = "off" | "alpha-suffix" | "alpha-prefix" | "digit-suffix";

const CSS = { font: { fontFamily: "var(--font-mono)" } as React.CSSProperties };

const C = {
  bg0: "#0d0d0f", bg1: "#111113", bg2: "#161618", bg3: "#1b1b1e",
  line: "rgba(255,255,255,0.07)", lineHi: "rgba(255,255,255,0.13)",
  t0: "#f0f0f2", t1: "rgba(240,240,242,0.6)",
  t2: "rgba(240,240,242,0.35)", t3: "rgba(240,240,242,0.18)",
  ton: "#0098ea", tonDim: "rgba(0,152,234,0.15)",
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  Available:  { label: "Available", color: "#35c96b", bg: "rgba(53,201,107,0.10)",  border: "rgba(53,201,107,0.28)",  dot: "#35c96b" },
  Taken:      { label: "Taken",     color: "#f04040", bg: "rgba(240,64,64,0.09)",   border: "rgba(240,64,64,0.26)",   dot: "#FF4900" },
  "For Sale": { label: "For Sale",  color: "#c07aff", bg: "rgba(165,61,231,0.10)",  border: "rgba(165,61,231,0.28)",  dot: "#c07aff" },
  Sold:       { label: "Sold",      color: "#7a7a88", bg: "rgba(120,120,136,0.10)", border: "rgba(120,120,136,0.22)", dot: "#7a7a88" },
  Reserved:   { label: "Reserved",  color: "#6b8cff", bg: "rgba(107,140,255,0.09)", border: "rgba(107,140,255,0.24)", dot: "#6b8cff" },
  Invalid:    { label: "Invalid",   color: "#f04040", bg: "rgba(240,64,64,0.09)",   border: "rgba(240,64,64,0.26)",   dot: "#FF4900" },
  Unknown:    { label: "Unknown",   color: "#7a7a88", bg: "rgba(120,120,136,0.10)", border: "rgba(120,120,136,0.22)", dot: "#7a7a88" },
};
const getS = (s: string) =>
  STATUS_CFG[s] ?? { label: s, color: "#7a7a88", bg: "rgba(120,120,136,0.10)", border: "rgba(120,120,136,0.22)", dot: "#7a7a88" };

const FREE_STATUSES = new Set(["Available"]);

const STATUS_ORDER = ["Available", "For Sale", "Reserved", "Sold", "Taken", "Unknown", "Invalid"];
const ALPHA  = "abcdefghijklmnopqrstuvwxyz".split("");
const DIGITS = "0123456789".split("");
const SUFFIX_HOT = new Set(["s", "x", "z", "y", "0", "1", "2", "3"]);
const PREFIX_HOT = new Set(["i", "e", "o", "a", "m", "t"]);
const PAGE_SIZE = 100;
const API_CHUNK = 100;

function getOrCreateUserId(): string {
  try {
    const key = "username_tool_uid";
    let uid = localStorage.getItem(key);
    if (!uid) { uid = crypto.randomUUID(); localStorage.setItem(key, uid); }
    return uid;
  } catch { return "anonymous"; }
}

function buildSweepCandidates(base: string, mode: SweepMode): string[] {
  const chars = mode === "digit-suffix" ? DIGITS : ALPHA;
  return [base, ...chars.map(c => mode === "alpha-prefix" ? `${c}${base}` : `${base}${c}`)];
}

function fmtDate(s: string) {
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

function downloadAvailable(results: CheckResult[], filename = "available_usernames.txt") {
  const available = results.filter(r => FREE_STATUSES.has(r.status)).map(r => r.username);
  if (!available.length) return false;
  const blob = new Blob([available.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

// ── Components ────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const cfg = getS(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "2px 7px 2px 5px", background: cfg.bg,
      border: `0.5px solid ${cfg.border}`, borderRadius: "2px",
      fontSize: "11px", fontWeight: 600, color: cfg.color,
      letterSpacing: "0.02em", whiteSpace: "nowrap", ...CSS.font,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%", background: cfg.dot, flexShrink: 0,
        animation: status === "Available" ? "pulse-dot 2s ease-in-out infinite" : "none",
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
      <circle cx="12" cy="12" r="10" stroke="rgba(240,240,242,0.12)" strokeWidth="2.5"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="rgba(240,240,242,0.75)" strokeWidth="2.5" strokeLinecap="round"/>
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
  if (photo) return <img src={photo} alt={username} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `0.5px solid ${C.lineHi}` }} />;
  const hue = (letter.charCodeAt(0) * 47) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue}, 10%, 18%)`, border: `0.5px solid ${C.lineHi}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.38) + "px", fontWeight: 700,
      color: `hsl(${hue}, 40%, 65%)`, flexShrink: 0, ...CSS.font,
    }}>{letter}</div>
  );
}

function ExtLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ color: C.t3, textDecoration: "none", flexShrink: 0, transition: "color 120ms ease", display: "flex", alignItems: "center" }}
      onMouseEnter={e => (e.currentTarget.style.color = C.t0)}
      onMouseLeave={e => (e.currentTarget.style.color = C.t3)}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </a>
  );
}

const ROW_BORDER: React.CSSProperties = { borderBottom: `0.5px solid ${C.line}` };

function ResultRow({ r, last }: { r: CheckResult; last: boolean }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "28px 1fr auto 14px",
      alignItems: "center", padding: "8px 13px", gap: "10px",
      ...(!last ? ROW_BORDER : {}), transition: "background 100ms ease", cursor: "default",
    }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = C.bg3)}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
    >
      <Avatar username={r.username} photo={r.photo} size={22} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: C.t0, ...CSS.font }}>@{r.username}</span>
          {r.hasPremium && <PremiumStar />}
        </div>
        {r.name && <div style={{ fontSize: "11px", color: C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...CSS.font }}>{r.name}</div>}
      </div>
      <StatusPill status={r.status} />
      {r.status !== "Invalid" ? <ExtLink href={`https://fragment.com/username/${r.username}`} /> : <span />}
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
          <div key={s} style={{ padding: "2px 8px", background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: "2px", display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "10px", color: cfg.color, fontWeight: 600, letterSpacing: "0.04em", ...CSS.font }}>{cfg.label}</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: C.t0, ...CSS.font }}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

function SortBar({ sort, setSort, results }: { sort: Sort; setSort: (s: Sort) => void; results: CheckResult[] }) {
  const opts: { k: Sort; label: string }[] = [
    { k: "none", label: "Default" }, { k: "az", label: "A → Z" },
    { k: "za", label: "Z → A" }, { k: "group", label: "Group" },
  ];
  const availableCount = results.filter(r => FREE_STATUSES.has(r.status)).length;
  return (
    <div style={{ display: "flex", gap: "2px", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
        <span style={{ fontSize: "10px", color: C.t2, marginRight: "4px", letterSpacing: "0.06em", ...CSS.font }}>Sort</span>
        {opts.map(({ k, label }) => (
          <button key={k} onClick={() => setSort(k)} style={{
            background: sort === k ? C.bg3 : "transparent", border: `0.5px solid ${sort === k ? C.lineHi : C.line}`,
            borderRadius: "2px", padding: "2px 8px", color: sort === k ? C.t0 : C.t2,
            fontSize: "11px", fontWeight: sort === k ? 700 : 400, cursor: "pointer", transition: "all 100ms ease", ...CSS.font,
          }}>{label}</button>
        ))}
      </div>
      {availableCount > 0 && (
        <button
          onClick={() => downloadAvailable(results)}
          style={{
            display: "flex", alignItems: "center", gap: "5px",
            background: "rgba(53,201,107,0.08)", border: "0.5px solid rgba(53,201,107,0.28)",
            borderRadius: "2px", padding: "3px 10px", color: "#35c96b",
            fontSize: "11px", fontWeight: 600, cursor: "pointer", transition: "all 100ms ease", ...CSS.font,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(53,201,107,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(53,201,107,0.08)"; }}
          title="Download available usernames as .txt"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {availableCount} available
        </button>
      )}
    </div>
  );
}

function GroupHeader({ status, count }: { status: string; count: number }) {
  const cfg = getS(status);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
      <span style={{ fontSize: "9px", fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.1em", ...CSS.font }}>{cfg.label}</span>
      <span style={{ fontSize: "10px", color: C.t2, ...CSS.font }}>{count}</span>
      <div style={{ flex: 1, height: "0.5px", background: C.line }} />
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
      <SortBar sort={sort} setSort={setSort} results={results} />
      {sort === "group" && grouped ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {grouped.map(g => (
            <div key={g.status}>
              <GroupHeader status={g.status} count={g.items.length} />
              <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", background: C.bg1 }}>
                {g.items.map((r, i) => <ResultRow key={r.username + i} r={r} last={i === g.items.length - 1} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", background: C.bg1 }}>
          {sorted.map((r, i) => <ResultRow key={i} r={r} last={i === sorted.length - 1} />)}
        </div>
      )}
    </div>
  );
}

function InputRow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const [focused, setFocused] = useState(false);
  return (
    <div onFocusCapture={() => setFocused(true)} onBlurCapture={() => setFocused(false)}
      style={{ display: "flex", alignItems: "center", border: `0.5px solid ${focused ? C.lineHi : C.line}`, borderRadius: "2px", background: C.bg1, transition: "border-color 120ms ease", overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

const TEXT_INPUT: React.CSSProperties = {
  flex: 1, background: "transparent", border: "none", outline: "none",
  color: C.t0, fontSize: "13px", fontWeight: 600, padding: "9px 8px", fontFamily: "var(--font-mono)",
};

function PrimaryBtn({ onClick, disabled, loading, children }: { onClick: () => void; disabled: boolean; loading?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? "rgba(240,240,242,0.05)" : C.t0, color: disabled ? C.t3 : C.bg0,
      border: "none", borderRadius: "0", padding: "0 16px", height: "100%", minHeight: "38px",
      fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", cursor: disabled ? "not-allowed" : "pointer",
      display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", flexShrink: 0,
      transition: "background 120ms ease, color 120ms ease", fontFamily: "var(--font-mono)", borderLeft: `0.5px solid ${C.line}`,
    }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "rgba(240,240,242,0.85)"; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = C.t0; }}
    >
      {loading ? <Spinner size={11} /> : null}{children}
    </button>
  );
}

function SegmentedControl<T extends string>({ label, options, value, onChange }: { label: string; options: { k: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
      <span style={{ fontSize: "10px", color: C.t2, letterSpacing: "0.05em", marginRight: "5px", ...CSS.font }}>{label}</span>
      {options.map(({ k, label: lbl }) => (
        <button key={k} onClick={() => onChange(k)} style={{
          background: value === k ? C.bg3 : "transparent", border: `0.5px solid ${value === k ? C.lineHi : C.line}`,
          borderRadius: "2px", padding: "3px 9px", color: value === k ? C.t0 : C.t2,
          fontSize: "11px", fontWeight: value === k ? 700 : 400, cursor: "pointer", transition: "all 100ms ease", ...CSS.font,
        }}>{lbl}</button>
      ))}
    </div>
  );
}

function ProgressBar({ done, total, label, paused }: { done: number; total: number; label?: string; paused?: boolean }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "10px", color: paused ? "#e8a030" : C.t2, display: "flex", alignItems: "center", gap: "5px", ...CSS.font }}>
          {paused && (
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e8a030", display: "inline-block" }} />
          )}
          {paused ? "Paused — switch back to resume" : (label ?? "Checking…")}
        </span>
        <span style={{ fontSize: "10px", color: C.t1, fontWeight: 600, ...CSS.font }}>
          {done} / {total} <span style={{ color: C.t3, fontWeight: 400 }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height: "2px", background: C.bg3, borderRadius: "1px", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: paused ? "#e8a030" : C.ton,
          borderRadius: "1px", transition: "width 200ms ease",
        }} />
      </div>
    </div>
  );
}

function SweepVariantGrid({ base, mode, results }: { base: string; mode: SweepMode; results: CheckResult[] }) {
  const chars = mode === "digit-suffix" ? DIGITS : ALPHA;
  const hotSet = mode === "alpha-prefix" ? PREFIX_HOT : SUFFIX_HOT;
  const byUsername = new Map(results.map(r => [r.username, r]));
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ fontSize: "9px", fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px", ...CSS.font }}>
        {mode === "digit-suffix" ? "Digit variants 0–9" : mode === "alpha-prefix" ? "Letter variants a–z (prefix)" : "Letter variants a–z (suffix)"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {chars.map(c => {
          const username = mode === "alpha-prefix" ? `${c}${base}` : `${base}${c}`;
          const r = byUsername.get(username);
          const cfg = r ? getS(r.status) : null;
          const isHot = hotSet.has(c);
          return (
            <a key={c} href={`https://fragment.com/username/${username}`} target="_blank" rel="noopener noreferrer"
              title={`@${username}${r ? ` · ${r.status}` : ""}`}
              style={{
                display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                width: "44px", padding: "5px 4px 4px",
                background: cfg ? cfg.bg : C.bg2,
                border: `0.5px solid ${isHot ? "rgba(0,152,234,0.45)" : cfg ? cfg.border : C.line}`,
                borderRadius: "2px", textDecoration: "none", transition: "all 100ms ease", position: "relative",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = C.bg3; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = cfg ? cfg.bg : C.bg2; }}
            >
              {isHot && <span style={{ position: "absolute", top: "2px", right: "3px", width: "4px", height: "4px", borderRadius: "50%", background: C.ton, opacity: 0.8 }} />}
              <span style={{ fontSize: "12px", fontWeight: 700, color: cfg ? cfg.color : C.t2, ...CSS.font }}>{c}</span>
              <span style={{ fontSize: "9px", color: cfg ? cfg.color : C.t3, opacity: 0.8, marginTop: "1px", ...CSS.font }}>
                {r ? r.status.slice(0, 4) : "···"}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const userIdRef = useRef<string>("");
  const [userIdDisplay, setUserIdDisplay] = useState<string>("");

  const [input, setInput]           = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [sweepInput, setSweepInput] = useState("");
  const [sweepMode, setSweepMode]   = useState<SweepMode>("alpha-suffix");
  const [mode, setMode]             = useState<"single" | "batch" | "sweep" | "parser" | "history">("single");
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

  const [isPaused, setIsPaused]   = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const pausedRef   = useRef(false);
  const stoppedRef  = useRef(false);
  const pendingQueueRef   = useRef<string[]>([]);
  const partialResultsRef = useRef<CheckResult[]>([]);
  const activeCheckMode   = useRef<"batch" | "parser" | null>(null);

  const allWordsRef  = useRef<string[]>([]);
  const shownIndices = useRef<Set<number>>(new Set());

  const [parserList, setParserList]             = useState<string[]>([]);
  const [parserChecked, setParserChecked]       = useState<CheckResult[]>([]);
  const [parserSort, setParserSort]             = useState<Sort>("none");
  const [parserChecking, setParserChecking]     = useState(false);
  const [parserCopied, setParserCopied]         = useState(false);
  const [parserSweepMode, setParserSweepMode]   = useState<GenSweepMode>("off");
  const [parserProgress, setParserProgress]     = useState<{ done: number; total: number } | null>(null);
  const [batchProgress, setBatchProgress]       = useState<{ done: number; total: number } | null>(null);

  const [wordListUrl, setWordListUrl]           = useState("");
  const [wordListFetching, setWordListFetching] = useState(false);
  const [wordListError, setWordListError]       = useState<string | null>(null);
  const [wordListInfo, setWordListInfo]         = useState<string | null>(null);

  useEffect(() => {
    const uid = getOrCreateUserId();
    userIdRef.current = uid;
    setUserIdDisplay(uid);
  }, []);

  // Pause on tab hide / resume on tab show
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (loading) { pausedRef.current = true; setIsPaused(true); }
      } else {
        if (pausedRef.current) { pausedRef.current = false; setIsPaused(false); }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loading]);

  const authHeaders = useCallback((): HeadersInit => ({
    "Content-Type": "application/json",
    ...(userIdRef.current ? { "x-user-id": userIdRef.current } : {}),
  }), []);

  const loadHistory = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    setHistLoad(true);
    try {
      const d = await (await fetch("/api/history", { headers: { "x-user-id": uid } })).json() as { history: HistoryItem[] };
      setHistory(d.history ?? []);
    } catch { /**/ }
    finally { setHistLoad(false); }
  }, []);

  useEffect(() => { if (userIdDisplay) void loadHistory(); }, [userIdDisplay, loadHistory]);

  // ── Heartbeat: сообщает админ-панели что пользователь онлайн ──
  useEffect(() => {
    const ping = () => { void fetch("/api/admin/presence", { method: "POST" }); };
    ping(); // сразу при входе
    const interval = setInterval(ping, 30_000); // каждые 30 сек
    return () => clearInterval(interval);
  }, []);

  const clearHistory = useCallback(async () => {
    if (!clearOk) { setClearOk(true); setTimeout(() => setClearOk(false), 3000); return; }
    try {
      await fetch("/api/history", { method: "DELETE", headers: authHeaders() });
      setHistory([]); setClearOk(false);
    } catch { /**/ }
  }, [clearOk, authHeaders]);

  const resetState = () => {
    setResult(null); setBatchRes([]); setSweepRes([]);
    setParserList([]); setParserChecked([]); setError(null);
    setWordListError(null); setWordListInfo(null);
    setBatchProgress(null); setParserProgress(null);
    setIsPaused(false); setIsStopped(false);
    pausedRef.current = false; stoppedRef.current = false;
    pendingQueueRef.current = []; partialResultsRef.current = [];
    activeCheckMode.current = null;
  };

  const handleStop = useCallback(() => {
    stoppedRef.current = true;
    pausedRef.current = false;
    setIsStopped(true);
    setIsPaused(false);
    setLoading(false);
    setParserChecking(false);
    setBatchProgress(null);
    setParserProgress(null);
  }, []);

  const waitIfPaused = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      const check = () => {
        if (stoppedRef.current) { resolve(false); return; }
        if (!pausedRef.current) { resolve(true); return; }
        setTimeout(check, 200);
      };
      check();
    });
  }, []);

  const checkInChunksInterruptible = useCallback(async (
    usernames: string[],
    startDone: number,
    onProgress: (done: number, total: number, partial: CheckResult[]) => void,
    existingResults: CheckResult[]
  ): Promise<{ results: CheckResult[]; stopped: boolean; remaining: string[] }> => {
    const allResults: CheckResult[] = [...existingResults];
    const total = usernames.length + startDone;

    for (let i = 0; i < usernames.length; i += API_CHUNK) {
      const canContinue = await waitIfPaused();
      if (!canContinue || stoppedRef.current) {
        return { results: allResults, stopped: true, remaining: usernames.slice(i) };
      }
      const chunk = usernames.slice(i, i + API_CHUNK);
      try {
        const res = await fetch("/api/check-username", {
          method: "POST", headers: authHeaders(), body: JSON.stringify({ usernames: chunk }),
        });
        const d = await res.json() as { results?: CheckResult[]; error?: string };
        if (!res.ok) throw new Error(d.error ?? "Something went wrong");
        allResults.push(...(d.results ?? []));
        onProgress(startDone + allResults.length - existingResults.length, total, [...allResults]);
      } catch (e) {
        if (stoppedRef.current) return { results: allResults, stopped: true, remaining: usernames.slice(i) };
        throw e;
      }
      if (stoppedRef.current) {
        return { results: allResults, stopped: true, remaining: usernames.slice(i + API_CHUNK) };
      }
    }
    return { results: allResults, stopped: false, remaining: [] };
  }, [authHeaders, waitIfPaused]);

  const checkInChunks = useCallback(async (
    usernames: string[],
    onProgress: (done: number, total: number, partial: CheckResult[]) => void
  ): Promise<CheckResult[]> => {
    const allResults: CheckResult[] = [];
    for (let i = 0; i < usernames.length; i += API_CHUNK) {
      const chunk = usernames.slice(i, i + API_CHUNK);
      const res = await fetch("/api/check-username", {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ usernames: chunk }),
      });
      const d = await res.json() as { results?: CheckResult[]; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Something went wrong");
      allResults.push(...(d.results ?? []));
      onProgress(allResults.length, usernames.length, [...allResults]);
    }
    return allResults;
  }, [authHeaders]);

  const checkSingle = useCallback(async () => {
    const u = input.trim().replace(/^@/, "").toLowerCase();
    if (!u) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/check-username?username=${encodeURIComponent(u)}`, { headers: authHeaders() });
      const d = await res.json() as CheckResult & { error?: string };
      if (!res.ok) setError(d.error ?? "Something went wrong");
      else { setResult(d as CheckResult); void loadHistory(); }
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [input, loadHistory, authHeaders]);

  const checkBatch = useCallback(async (resumeQueue?: string[], resumePartial?: CheckResult[]) => {
    const isResume = !!resumeQueue;
    const lines = isResume
      ? resumeQueue!
      : batchInput.split(/[\n,;]+/).map(s => s.trim().replace(/^@/, "").toLowerCase()).filter(Boolean);

    if (!lines.length) return;
    if (!isResume && lines.length > 1000) { setError("Max 1000 usernames."); return; }

    stoppedRef.current = false; pausedRef.current = false;
    setIsStopped(false); setIsPaused(false);
    setLoading(true); setError(null);
    if (!isResume) { setBatchRes([]); setBatchSort("none"); }
    activeCheckMode.current = "batch";

    const alreadyDone = isResume ? (resumePartial?.length ?? 0) : 0;
    const total = lines.length + alreadyDone;
    setBatchProgress({ done: alreadyDone, total });

    try {
      const { results, stopped, remaining } = await checkInChunksInterruptible(
        lines, alreadyDone,
        (done, tot, partial) => { setBatchProgress({ done, total: tot }); setBatchRes(partial); },
        resumePartial ?? []
      );
      setBatchRes(results);
      if (stopped) {
        pendingQueueRef.current = remaining;
        partialResultsRef.current = results;
      } else {
        pendingQueueRef.current = []; partialResultsRef.current = [];
        void loadHistory();
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Network error."); }
    finally {
      setLoading(false);
      if (!stoppedRef.current) setBatchProgress(null);
    }
  }, [batchInput, loadHistory, checkInChunksInterruptible]);

  const resumeBatch = useCallback(() => {
    if (!pendingQueueRef.current.length) return;
    stoppedRef.current = false; setIsStopped(false);
    void checkBatch(pendingQueueRef.current, partialResultsRef.current);
  }, [checkBatch]);

  const checkSweep = useCallback(async () => {
    const base = sweepInput.trim().replace(/^@/, "").toLowerCase();
    if (!base) return;
    const cands = buildSweepCandidates(base, sweepMode);
    setLoading(true); setError(null); setSweepRes([]); setSweepSort("none");
    try {
      const res = await fetch("/api/check-username", {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ usernames: cands }),
      });
      const d = await res.json() as { results?: CheckResult[]; error?: string };
      if (!res.ok) setError(d.error ?? "Something went wrong");
      else { setSweepRes(d.results ?? []); void loadHistory(); }
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [sweepInput, sweepMode, loadHistory, authHeaders]);

  const handleFetchWordList = useCallback(async () => {
    if (!wordListUrl.trim()) return;
    setWordListFetching(true); setWordListError(null); setWordListInfo(null);
    allWordsRef.current = []; shownIndices.current = new Set();
    setParserList([]); setParserChecked([]);
    try {
      const res = await fetch(`/api/fetch-wordlist?url=${encodeURIComponent(wordListUrl.trim())}`);
      const data = await res.json() as { words?: string[]; total?: number; error?: string };
      if (!res.ok || data.error) { setWordListError(data.error ?? "Failed to load word list"); }
      else {
        allWordsRef.current = data.words ?? [];
        shownIndices.current = new Set();
        setWordListInfo(`✓ Loaded ${data.total ?? data.words?.length ?? 0} words · showing ${PAGE_SIZE} at a time without repeats`);
      }
    } catch (e) { setWordListError(`Network error: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setWordListFetching(false); }
  }, [wordListUrl]);

  const handleNextPage = useCallback(() => {
    const all = allWordsRef.current;
    if (!all.length) { setWordListError("Load a word list first"); return; }
    const available: number[] = [];
    for (let i = 0; i < all.length; i++) { if (!shownIndices.current.has(i)) available.push(i); }
    if (available.length === 0) { setWordListError(`All ${all.length} words have been shown.`); return; }
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    const picked = available.slice(0, PAGE_SIZE);
    picked.forEach(idx => shownIndices.current.add(idx));
    setParserList(picked.map(idx => all[idx]));
    setParserChecked([]); setParserSort("none"); setParserProgress(null); setWordListError(null);
    stoppedRef.current = false; setIsStopped(false);
    pendingQueueRef.current = []; partialResultsRef.current = [];
  }, []);

  const handleCheckParsed = useCallback(async (resumeQueue?: string[], resumePartial?: CheckResult[]) => {
    const isResume = !!resumeQueue;
    if (!isResume && !parserList.length) return;

    stoppedRef.current = false; pausedRef.current = false;
    setIsStopped(false); setIsPaused(false);
    setParserChecking(true);
    if (!isResume) { setParserChecked([]); setParserSort("none"); setParserProgress(null); }
    activeCheckMode.current = "parser";

    const baseUsernames = isResume
      ? resumeQueue!
      : parserSweepMode !== "off"
        ? parserList.flatMap(w => buildSweepCandidates(w, parserSweepMode as SweepMode))
        : parserList;

    const alreadyDone = isResume ? (resumePartial?.length ?? 0) : 0;
    const total = baseUsernames.length + alreadyDone;
    setParserProgress({ done: alreadyDone, total });

    try {
      const { results, stopped, remaining } = await checkInChunksInterruptible(
        baseUsernames, alreadyDone,
        (done, tot, partial) => { setParserProgress({ done, total: tot }); setParserChecked(partial); },
        resumePartial ?? []
      );
      setParserChecked(results);
      if (stopped) {
        pendingQueueRef.current = remaining;
        partialResultsRef.current = results;
      } else {
        pendingQueueRef.current = []; partialResultsRef.current = [];
        void loadHistory();
      }
    } catch (e) { console.error("Parser check error:", e); }
    finally {
      setParserChecking(false);
      if (!stoppedRef.current) setParserProgress(null);
    }
  }, [parserList, parserSweepMode, loadHistory, checkInChunksInterruptible]);

  const resumeParser = useCallback(() => {
    if (!pendingQueueRef.current.length) return;
    stoppedRef.current = false; setIsStopped(false);
    void handleCheckParsed(pendingQueueRef.current, partialResultsRef.current);
  }, [handleCheckParsed]);

  const handleCopyParsed = useCallback(() => {
    navigator.clipboard.writeText(parserList.join("\n")).then(() => {
      setParserCopied(true); setTimeout(() => setParserCopied(false), 1500);
    });
  }, [parserList]);

  const TABS = [
    { key: "single" as const, label: "Single" }, { key: "batch" as const, label: "Batch" },
    { key: "sweep" as const, label: "Sweep" }, { key: "parser" as const, label: "Parser" },
    { key: "history" as const, label: "History" },
  ];

  const ghostBtn = (danger = false, active = false): React.CSSProperties => ({
    background: active ? (danger ? "rgba(240,64,64,0.08)" : C.bg3) : "transparent",
    border: `0.5px solid ${active ? (danger ? "rgba(240,64,64,0.35)" : C.lineHi) : C.line}`,
    borderRadius: "2px", padding: "4px 10px",
    color: active ? (danger ? "#f04040" : C.t0) : C.t2,
    fontSize: "11px", fontWeight: 600, cursor: "pointer",
    display: "flex", alignItems: "center", gap: "5px", transition: "all 100ms ease", ...CSS.font,
  });

  const sweepRequestCount = parserSweepMode === "off" ? parserList.length
    : parserSweepMode === "digit-suffix" ? parserList.length * 11 : parserList.length * 27;
  const remainingWords = allWordsRef.current.length > 0 ? allWordsRef.current.length - shownIndices.current.size : 0;
  const batchLineCount = batchInput.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).length;

  const isCheckRunning  = loading || parserChecking;
  const hasPendingQueue = pendingQueueRef.current.length > 0;

  const renderControlBar = (progressData: { done: number; total: number } | null, onResume: () => void) => {
    if (!progressData && !isStopped && !isPaused) return null;
    return (
      <div style={{ marginBottom: "10px" }}>
        {progressData && (
          <ProgressBar done={progressData.done} total={progressData.total} paused={isPaused} />
        )}
        {(isCheckRunning || isStopped || isPaused) && (
          <div style={{ display: "flex", gap: "5px", marginTop: "6px" }}>
            {isCheckRunning && !isStopped && (
              <button onClick={handleStop} style={{
                ...ghostBtn(true),
                borderColor: "rgba(240,64,64,0.35)",
                color: "#f04040",
              }}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
                  <rect x="1" y="1" width="8" height="8" rx="1"/>
                </svg>
                Stop
              </button>
            )}
            {isStopped && hasPendingQueue && (
              <button onClick={onResume} style={{
                ...ghostBtn(),
                background: "rgba(0,152,234,0.08)",
                borderColor: "rgba(0,152,234,0.3)",
                color: C.ton,
              }}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
                  <polygon points="2,1 9,5 2,9"/>
                </svg>
                Resume ({pendingQueueRef.current.length} left)
              </button>
            )}
            {isStopped && !hasPendingQueue && (
              <span style={{ fontSize: "11px", color: C.t2, display: "flex", alignItems: "center", ...CSS.font }}>
                ✕ Stopped
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <style>{`
        html { zoom: 1.2; background: ${C.bg0} !important; }
        body { background: ${C.bg0} !important; color: ${C.t0} !important; }
        body::before { display: none !important; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 0.7s linear infinite; }
        @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes shimmer {
          0%   { background-position: -500px 0; }
          100% { background-position:  500px 0; }
        }
        .title-shimmer {
          display: inline-block;
          background: linear-gradient(
            90deg,
            #f0f0f2 0%,
            #f0f0f2 20%,
            #6b6b7a 38%,
            #ffffff 50%,
            #6b6b7a 62%,
            #f0f0f2 80%,
            #f0f0f2 100%
          );
          background-size: 500px 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 4s ease-in-out infinite;
        }
        * { box-sizing: border-box; } textarea { box-sizing: border-box; }
        ::selection { background: ${C.tonDim}; color: ${C.t0}; }
        ::-webkit-scrollbar { width:3px; height:3px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.lineHi}; border-radius:0; }
        input::placeholder { color: ${C.t2}; } textarea::placeholder { color: ${C.t2}; }
      `}</style>

      <div style={{ minHeight: "100vh", background: C.bg0, color: C.t0, display: "flex", flexDirection: "column" }}>
        <main style={{ maxWidth: "620px", width: "100%", margin: "0 auto", padding: "32px 24px 80px", flex: 1 }}>

          {/* Header */}
          <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: `0.5px solid ${C.line}` }}>
            <h1 className="title-shimmer" style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 5px", letterSpacing: "-0.01em", ...CSS.font }}>Username Tool</h1>
            <p style={{ fontSize: "12px", color: C.t2, margin: 0, ...CSS.font }}>Search Fragment for available Telegram usernames. Real-time availability data.</p>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `0.5px solid ${C.line}`, marginBottom: "24px", overflowX: "auto" }}>
            {TABS.map(({ key, label }) => {
              const active = mode === key;
              return (
                <button key={key} onClick={() => { setMode(key); resetState(); if (key === "history") void loadHistory(); }} style={{
                  padding: "7px 14px", border: "none", borderBottom: `1.5px solid ${active ? C.t0 : "transparent"}`,
                  background: "transparent", color: active ? C.t0 : C.t2,
                  fontWeight: active ? 700 : 400, fontSize: "12px", letterSpacing: "0.04em",
                  cursor: "pointer", marginBottom: "-0.5px", transition: "color 100ms ease, border-color 100ms ease",
                  whiteSpace: "nowrap", flexShrink: 0, ...CSS.font,
                }}>{label}</button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: "9px 12px", border: "0.5px solid rgba(240,64,64,0.3)", background: "rgba(240,64,64,0.07)", borderRadius: "2px", color: "#f04040", fontSize: "12px", marginBottom: "14px", display: "flex", alignItems: "flex-start", gap: "8px", animation: "fadeUp 0.15s ease forwards", ...CSS.font }}>
              <span style={{ flexShrink: 0, marginTop: "1px" }}>✕</span><span>{error}</span>
            </div>
          )}

          {/* ── Single ── */}
          {mode === "single" && (
            <div>
              <InputRow style={{ marginBottom: "5px" }}>
                <span style={{ padding: "0 4px 0 13px", color: C.t2, fontSize: "15px", userSelect: "none", flexShrink: 0, ...CSS.font }}>@</span>
                <input ref={inputRef} type="text" value={input}
                  onChange={e => { setInput(e.target.value); setResult(null); setError(null); }}
                  onKeyDown={e => { if (e.key === "Enter") void checkSingle(); }}
                  placeholder="username" autoFocus
                  autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                  style={TEXT_INPUT}
                />
                <PrimaryBtn onClick={() => void checkSingle()} disabled={loading || !input.trim()} loading={loading}>
                  {loading ? "Checking" : "Check"}
                </PrimaryBtn>
              </InputRow>
              <p style={{ fontSize: "10px", color: C.t3, marginBottom: "24px", marginTop: "4px", ...CSS.font }}>
                3–32 chars · letters, numbers, underscores · press Enter
              </p>
              {result && !error && (
                <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", background: C.bg1, animation: "fadeUp 0.15s ease forwards" }}>
                  <div style={{ padding: "8px 13px", background: C.bg2, borderBottom: `0.5px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <span style={{ fontSize: "10px", color: C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...CSS.font }}>fragment.com/username/{result.username}</span>
                    <StatusPill status={result.status} />
                  </div>
                  <div style={{ padding: "14px 13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "11px", marginBottom: "14px" }}>
                      <Avatar username={result.username} photo={result.photo} size={40} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ fontSize: "15px", fontWeight: 700, color: C.t0, ...CSS.font }}>@{result.username}</span>
                          {result.hasPremium && <PremiumStar />}
                        </div>
                        {result.name && <div style={{ fontSize: "12px", color: C.t1, marginTop: "2px", ...CSS.font }}>{result.name}</div>}
                        {result.status === "Reserved" && <div style={{ fontSize: "11px", color: "#6b8cff", marginTop: "4px", ...CSS.font }}>Reserved by Telegram · cannot be registered</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                      {[
                        { href: `https://fragment.com/username/${result.username}`, label: "View on Fragment", icon: <TonLogo size={11} /> },
                        { href: `https://t.me/${result.username}`, label: "Open in Telegram", icon: null },
                      ].map(({ href, label, icon }) => (
                        <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{
                          display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px",
                          border: `0.5px solid ${C.line}`, borderRadius: "2px", background: C.bg2, color: C.t1,
                          textDecoration: "none", fontSize: "11px", fontWeight: 600,
                          transition: "background 100ms ease, border-color 100ms ease", ...CSS.font,
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = C.bg3; e.currentTarget.style.borderColor = C.lineHi; }}
                          onMouseLeave={e => { e.currentTarget.style.background = C.bg2; e.currentTarget.style.borderColor = C.line; }}
                        >{icon}{label}</a>
                      ))}
                    </div>
                  </div>
                  {result.source && <div style={{ padding: "5px 13px", borderTop: `0.5px solid ${C.line}`, background: C.bg2, fontSize: "10px", color: C.t3, ...CSS.font }}>source: {result.source}</div>}
                </div>
              )}
            </div>
          )}

          {/* ── Batch ── */}
          {mode === "batch" && (
            <div>
              <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", marginBottom: "10px", background: C.bg1 }}>
                <div style={{ padding: "6px 12px", background: C.bg2, borderBottom: `0.5px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "10px", color: C.t2, letterSpacing: "0.04em", ...CSS.font }}>One username per line, or comma/semicolon separated</span>
                  <span style={{ fontSize: "11px", color: C.t1, fontWeight: 600, ...CSS.font }}>
                    {batchLineCount}<span style={{ color: batchLineCount > 1000 ? "#f04040" : C.t3, fontWeight: 400 }}>/1000</span>
                  </span>
                </div>
                <textarea value={batchInput} onChange={e => { setBatchInput(e.target.value); setError(null); setBatchRes([]); }}
                  placeholder={"username1\nusername2\nusername3"} rows={8}
                  style={{ width: "100%", background: C.bg1, border: "none", outline: "none", color: C.t0, fontSize: "13px", fontWeight: 600, padding: "10px 12px", resize: "vertical", lineHeight: 1.7, ...CSS.font }}
                />
              </div>
              {renderControlBar(batchProgress, resumeBatch)}
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

          {/* ── Sweep ── */}
          {mode === "sweep" && (
            <div>
              <div style={{ padding: "9px 12px", background: C.tonDim, border: `0.5px solid rgba(0,152,234,0.25)`, borderRadius: "2px", fontSize: "12px", color: C.t1, marginBottom: "18px", lineHeight: 1.55, ...CSS.font }}>
                {sweepMode === "digit-suffix"
                  ? <>Checks the exact username + all 10 digit variants (0–9). <span style={{ color: C.t0, fontWeight: 700 }}>11 requests total.</span></>
                  : <>Checks the exact username + all 26 letter variants (a–z). <span style={{ color: C.t0, fontWeight: 700 }}>27 requests total.</span> <span style={{ color: C.ton }}>Blue dot = commonly available suffix.</span></>
                }
              </div>
              <InputRow style={{ marginBottom: "9px" }}>
                <span style={{ padding: "0 4px 0 13px", color: C.t2, fontSize: "15px", userSelect: "none", flexShrink: 0, ...CSS.font }}>@</span>
                <input type="text" value={sweepInput}
                  onChange={e => { setSweepInput(e.target.value); setError(null); setSweepRes([]); }}
                  onKeyDown={e => { if (e.key === "Enter") void checkSweep(); }}
                  placeholder="username" autoFocus
                  autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                  style={TEXT_INPUT}
                />
                <PrimaryBtn onClick={() => void checkSweep()} disabled={loading || !sweepInput.trim()} loading={loading}>
                  {loading ? "Sweeping…" : "Sweep"}
                </PrimaryBtn>
              </InputRow>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px" }}>
                <SegmentedControl<SweepMode> label="Mode" value={sweepMode} onChange={v => { setSweepMode(v); setSweepRes([]); }}
                  options={[{ k: "alpha-suffix", label: "word + a" }, { k: "alpha-prefix", label: "a + word" }, { k: "digit-suffix", label: "word + 1" }]}
                />
              </div>
              {sweepRes.length > 0 && (
                <div style={{ animation: "fadeUp 0.15s ease forwards" }}>
                  {sweepRes[0] && (
                    <div style={{ marginBottom: "14px" }}>
                      <div style={{ fontSize: "9px", fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px", ...CSS.font }}>Original</div>
                      <div style={{ border: `0.5px solid rgba(0,152,234,0.2)`, borderRadius: "2px", overflow: "hidden", background: C.bg1 }}>
                        <ResultRow r={sweepRes[0]} last />
                      </div>
                    </div>
                  )}
                  {sweepRes.length > 1 && (
                    <div>
                      <SweepVariantGrid base={sweepInput.trim().replace(/^@/, "").toLowerCase()} mode={sweepMode} results={sweepRes.slice(1)} />
                      <Results results={sweepRes.slice(1)} sort={sweepSort} setSort={setSweepSort} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Parser ── */}
          {mode === "parser" && (
            <div style={{ animation: "fadeUp 0.15s ease forwards" }}>
              <div style={{ padding: "9px 12px", background: C.tonDim, border: `0.5px solid rgba(0,152,234,0.25)`, borderRadius: "2px", fontSize: "12px", color: C.t1, marginBottom: "20px", lineHeight: 1.55, ...CSS.font }}>
                Load a word list from a URL (Pastebin or any raw text). Each click of &quot;Next 100&quot; shows a new batch without repeats.
              </div>
              <div style={{ background: C.bg1, border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", marginBottom: "14px" }}>
                <div style={{ background: C.bg2, borderBottom: `0.5px solid ${C.line}`, padding: "7px 13px", fontSize: "10px", color: C.t3, letterSpacing: "0.06em", ...CSS.font }}>source · pastebin / raw url</div>
                <div style={{ padding: "14px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input type="text" value={wordListUrl}
                      onChange={e => { setWordListUrl(e.target.value); setWordListError(null); setWordListInfo(null); allWordsRef.current = []; shownIndices.current = new Set(); }}
                      onKeyDown={e => { if (e.key === "Enter") void handleFetchWordList(); }}
                      placeholder="https://pastebin.com/xxxxxxxx"
                      style={{ flex: 1, background: C.bg2, border: `0.5px solid ${wordListError ? "rgba(240,64,64,0.4)" : C.line}`, borderRadius: "2px", padding: "7px 10px", color: C.t0, fontSize: "12px", fontWeight: 600, outline: "none", ...CSS.font }}
                    />
                    <button onClick={() => void handleFetchWordList()} disabled={wordListFetching || !wordListUrl.trim()} style={{
                      padding: "0 14px",
                      background: wordListFetching || !wordListUrl.trim() ? "rgba(240,240,242,0.05)" : C.tonDim,
                      border: `0.5px solid ${wordListFetching || !wordListUrl.trim() ? C.line : "rgba(0,152,234,0.3)"}`,
                      borderRadius: "2px", color: wordListFetching || !wordListUrl.trim() ? C.t3 : C.ton,
                      fontSize: "11px", fontWeight: 700, cursor: wordListFetching || !wordListUrl.trim() ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "5px", transition: "all 100ms ease", ...CSS.font,
                    }}>
                      {wordListFetching ? <><Spinner size={10} />Loading…</> : "Load"}
                    </button>
                  </div>
                  {wordListError && <div style={{ fontSize: "11px", color: "#f04040", marginTop: "6px", ...CSS.font }}>✕ {wordListError}</div>}
                  {wordListInfo && !wordListError && <div style={{ fontSize: "11px", color: "#35c96b", marginTop: "6px", ...CSS.font }}>{wordListInfo}</div>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
                <button onClick={handleNextPage} disabled={!allWordsRef.current.length} style={{
                  background: allWordsRef.current.length ? C.t0 : "rgba(240,240,242,0.05)",
                  color: allWordsRef.current.length ? C.bg0 : C.t3, border: "none", borderRadius: "2px",
                  padding: "9px 20px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em",
                  cursor: allWordsRef.current.length ? "pointer" : "not-allowed", transition: "background 120ms ease", ...CSS.font,
                }}
                  onMouseEnter={e => { if (allWordsRef.current.length) (e.currentTarget as HTMLButtonElement).style.background = "rgba(240,240,242,0.85)"; }}
                  onMouseLeave={e => { if (allWordsRef.current.length) (e.currentTarget as HTMLButtonElement).style.background = C.t0; }}
                >
                  {parserList.length === 0 ? "Show first 100" : "Next 100"}
                </button>
                {allWordsRef.current.length > 0 && (
                  <span style={{ fontSize: "11px", color: C.t2, ...CSS.font }}>
                    remaining <span style={{ color: remainingWords === 0 ? "#f04040" : C.t0, fontWeight: 700 }}>{remainingWords}</span> of {allWordsRef.current.length}
                  </span>
                )}
                {!allWordsRef.current.length && <span style={{ fontSize: "10px", color: C.t3, ...CSS.font }}>load a word list first</span>}
              </div>

              {parserList.length > 0 && (
                <div style={{ animation: "fadeUp 0.15s ease forwards" }}>
                  <div style={{ background: C.bg1, border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", marginBottom: "10px" }}>
                    <div style={{ background: C.bg2, borderBottom: `0.5px solid ${C.line}`, padding: "7px 13px", fontSize: "10px", color: C.t3, letterSpacing: "0.06em", ...CSS.font }}>check mode</div>
                    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <SegmentedControl<GenSweepMode> label="Sweep" value={parserSweepMode}
                        onChange={v => { setParserSweepMode(v); setParserChecked([]); }}
                        options={[{ k: "off", label: "Exact" }, { k: "alpha-suffix", label: "word + a–z" }, { k: "alpha-prefix", label: "a–z + word" }, { k: "digit-suffix", label: "word + 0–9" }]}
                      />
                      {parserSweepMode !== "off" && (
                        <div style={{ fontSize: "10px", color: C.t2, ...CSS.font }}>
                          {sweepRequestCount} requests · chunks of {API_CHUNK} · auto-retry on rate-limit
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "5px", marginBottom: "10px", flexWrap: "wrap" }}>
                    <button onClick={handleCopyParsed} style={ghostBtn(false, parserCopied)}>
                      {parserCopied ? "✓ Copied" : "Copy"}
                    </button>
                    <button onClick={() => void handleCheckParsed()} disabled={parserChecking} style={{
                      ...ghostBtn(), background: parserChecking ? "transparent" : C.tonDim,
                      borderColor: parserChecking ? C.line : "rgba(0,152,234,0.3)",
                      color: parserChecking ? C.t2 : C.ton, cursor: parserChecking ? "not-allowed" : "pointer",
                    }}>
                      {parserChecking ? <><Spinner size={10} />Checking…</> : "Check availability"}
                    </button>
                    <span style={{ fontSize: "11px", color: C.t2, display: "flex", alignItems: "center", marginLeft: "4px", ...CSS.font }}>{parserList.length} words</span>
                  </div>
                  {renderControlBar(parserProgress, resumeParser)}
                  {parserChecked.length > 0 ? (
                    <Results results={parserChecked} sort={parserSort} setSort={setParserSort} />
                  ) : (
                    <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", background: C.bg1 }}>
                      {parserList.map((u, i) => (
                        <div key={u + i} style={{ display: "grid", gridTemplateColumns: "28px 1fr 14px", alignItems: "center", padding: "7px 13px", gap: "10px", ...(i < parserList.length - 1 ? ROW_BORDER : {}), transition: "background 100ms ease" }}
                          onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = C.bg3)}
                          onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                        >
                          <Avatar username={u} size={22} />
                          <span style={{ fontSize: "13px", fontWeight: 600, color: C.t0, ...CSS.font }}>@{u}</span>
                          <ExtLink href={`https://fragment.com/username/${u}`} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {parserList.length === 0 && allWordsRef.current.length === 0 && (
                <div style={{ padding: "40px 16px", textAlign: "center", border: `0.5px solid ${C.line}`, borderRadius: "2px", color: C.t2, fontSize: "12px", background: C.bg1, ...CSS.font }}>
                  Load a word list from a URL to get started
                </div>
              )}
            </div>
          )}

          {/* ── History ── */}
          {mode === "history" && (
            <div style={{ animation: "fadeUp 0.15s ease forwards" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", color: C.t2, ...CSS.font }}>Recent checks</span>
                <div style={{ display: "flex", gap: "3px" }}>
                  <button onClick={() => void loadHistory()} style={ghostBtn()}>
                    {histLoad ? <Spinner size={10} /> : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    Refresh
                  </button>
                  {history.length > 0 && (
                    <button onClick={() => void clearHistory()} style={ghostBtn(true, clearOk)}>
                      {clearOk ? "Confirm?" : "Clear"}
                    </button>
                  )}
                </div>
              </div>
              {history.length === 0 ? (
                <div style={{ padding: "40px 16px", textAlign: "center", border: `0.5px solid ${C.line}`, borderRadius: "2px", color: C.t2, fontSize: "12px", background: C.bg1, ...CSS.font }}>No checks yet.</div>
              ) : (
                <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", background: C.bg1 }}>
                  {history.map((item, i) => (
                    <div key={item.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto 14px", alignItems: "center", padding: "8px 13px", gap: "10px", ...(i < history.length - 1 ? ROW_BORDER : {}), transition: "background 100ms ease" }}
                      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = C.bg3)}
                      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                    >
                      <Avatar username={item.username} size={22} />
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", color: C.t0, ...CSS.font }}>
                          @{item.username}{item.hasPremium === "true" && <PremiumStar />}
                        </div>
                        <div style={{ fontSize: "10px", color: C.t3, ...CSS.font }}>{fmtDate(item.checkedAt)}</div>
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

        <footer style={{ borderTop: `0.5px solid ${C.line}`, padding: "10px 24px", background: C.bg1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <TonLogo size={11} />
            <span style={{ fontSize: "10px", color: C.t3, ...CSS.font }}>Unofficial tool · Not affiliated with Telegram or Fragment</span>
            <span style={{ color: C.t3, fontSize: "10px" }}>·</span>
            <a href="https://fragment.com" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "10px", color: C.t2, textDecoration: "none", transition: "color 100ms ease", ...CSS.font }}
              onMouseEnter={e => (e.currentTarget.style.color = C.t0)}
              onMouseLeave={e => (e.currentTarget.style.color = C.t2)}
            >fragment.com</a>
          </div>
        </footer>
      </div>
    </>
  );
}