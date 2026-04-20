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

const CSS = {
  font: { fontFamily: "var(--font-mono)" } as React.CSSProperties,
};

const C = {
  bg0:     "#0d0d0f",
  bg1:     "#111113",
  bg2:     "#161618",
  bg3:     "#1b1b1e",
  line:    "rgba(255,255,255,0.07)",
  lineHi:  "rgba(255,255,255,0.13)",
  t0:      "#f0f0f2",
  t1:      "rgba(240,240,242,0.6)",
  t2:      "rgba(240,240,242,0.35)",
  t3:      "rgba(240,240,242,0.18)",
  ton:     "#0098ea",
  tonDim:  "rgba(0,152,234,0.15)",
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

const STATUS_ORDER = ["Available", "For Sale", "Reserved", "Sold", "Taken", "Unknown", "Invalid"];
const ALPHA  = "abcdefghijklmnopqrstuvwxyz".split("");
const DIGITS = "0123456789".split("");

const PAGE_SIZE = 200;

function getOrCreateUserId(): string {
  try {
    const key = "username_tool_uid";
    let uid = localStorage.getItem(key);
    if (!uid) {
      uid = crypto.randomUUID();
      localStorage.setItem(key, uid);
    }
    return uid;
  } catch {
    return "anonymous";
  }
}

function buildSweepCandidates(base: string, mode: SweepMode): string[] {
  const chars = mode === "digit-suffix" ? DIGITS : ALPHA;
  const variants = chars.map(c => mode === "alpha-prefix" ? `${c}${base}` : `${base}${c}`);
  return [base, ...variants];
}

// ── Components ────────────────────────────────────────────────────────────────

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
  if (photo) {
    return <img src={photo} alt={username} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `0.5px solid ${C.lineHi}` }} />;
  }
  const hue = (letter.charCodeAt(0) * 47) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue}, 10%, 18%)`,
      border: `0.5px solid ${C.lineHi}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.38) + "px",
      fontWeight: 700,
      color: `hsl(${hue}, 40%, 65%)`,
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
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = C.bg3)}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
    >
      <Avatar username={r.username} photo={r.photo} size={22} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: C.t0, ...CSS.font }}>@{r.username}</span>
          {r.hasPremium && <PremiumStar />}
        </div>
        {r.name && (
          <div style={{ fontSize: "11px", color: C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...CSS.font }}>
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
            <span style={{ fontSize: "11px", fontWeight: 700, color: C.t0, ...CSS.font }}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

function SortBar({ sort, setSort }: { sort: Sort; setSort: (s: Sort) => void }) {
  const opts: { k: Sort; label: string }[] = [
    { k: "none",  label: "Default" },
    { k: "az",    label: "A → Z" },
    { k: "za",    label: "Z → A" },
    { k: "group", label: "Group" },
  ];
  return (
    <div style={{ display: "flex", gap: "2px", alignItems: "center", justifyContent: "flex-end", marginBottom: "8px" }}>
      <span style={{ fontSize: "10px", color: C.t2, marginRight: "4px", letterSpacing: "0.06em", ...CSS.font }}>Sort</span>
      {opts.map(({ k, label }) => (
        <button key={k} onClick={() => setSort(k)} style={{
          background: sort === k ? C.bg3 : "transparent",
          border: `0.5px solid ${sort === k ? C.lineHi : C.line}`,
          borderRadius: "2px",
          padding: "2px 8px",
          color: sort === k ? C.t0 : C.t2,
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
      <SortBar sort={sort} setSort={setSort} />
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
    <div
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      style={{
        display: "flex", alignItems: "center",
        border: `0.5px solid ${focused ? C.lineHi : C.line}`,
        borderRadius: "2px",
        background: C.bg1,
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
  color: C.t0,
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
        background: disabled ? "rgba(240,240,242,0.05)" : C.t0,
        color: disabled ? C.t3 : C.bg0,
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
        borderLeft: `0.5px solid ${C.line}`,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "rgba(240,240,242,0.85)"; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = C.t0; }}
    >
      {loading ? <Spinner size={11} /> : null}
      {children}
    </button>
  );
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { k: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
      <span style={{ fontSize: "10px", color: C.t2, letterSpacing: "0.05em", marginRight: "5px", ...CSS.font }}>{label}</span>
      {options.map(({ k, label: lbl }) => (
        <button key={k} onClick={() => onChange(k)} style={{
          background: value === k ? C.bg3 : "transparent",
          border: `0.5px solid ${value === k ? C.lineHi : C.line}`,
          borderRadius: "2px",
          padding: "3px 9px",
          color: value === k ? C.t0 : C.t2,
          fontSize: "11px",
          fontWeight: value === k ? 700 : 400,
          cursor: "pointer",
          transition: "all 100ms ease",
          ...CSS.font,
        }}>
          {lbl}
        </button>
      ))}
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

  // Parser state
  // allWords holds the full list loaded from URL, seenIndices tracks which pages were already shown
  const allWordsRef    = useRef<string[]>([]);   // full deduplicated word list from server
  const shownIndices   = useRef<Set<number>>(new Set()); // which word indices have been shown already

  const [parserList, setParserList]         = useState<string[]>([]);   // current page being shown
  const [parserChecked, setParserChecked]   = useState<CheckResult[]>([]);
  const [parserSort, setParserSort]         = useState<Sort>("none");
  const [parserChecking, setParserChecking] = useState(false);
  const [parserCopied, setParserCopied]     = useState(false);
  const [parserSweepMode, setParserSweepMode] = useState<GenSweepMode>("off");

  const [wordListUrl, setWordListUrl]           = useState("");
  const [wordListFetching, setWordListFetching] = useState(false);
  const [wordListError, setWordListError]       = useState<string | null>(null);
  const [wordListInfo, setWordListInfo]         = useState<string | null>(null);

  useEffect(() => {
    const uid = getOrCreateUserId();
    userIdRef.current = uid;
    setUserIdDisplay(uid);
  }, []);

  const authHeaders = useCallback((): HeadersInit => ({
    "Content-Type": "application/json",
    ...(userIdRef.current ? { "x-user-id": userIdRef.current } : {}),
  }), []);

  const loadHistory = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    setHistLoad(true);
    try {
      const d = await (
        await fetch("/api/history", { headers: { "x-user-id": uid } })
      ).json() as { history: HistoryItem[] };
      setHistory(d.history ?? []);
    } catch { /**/ }
    finally { setHistLoad(false); }
  }, []);

  useEffect(() => {
    if (userIdDisplay) void loadHistory();
  }, [userIdDisplay, loadHistory]);

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
  };

  const checkSingle = useCallback(async () => {
    const u = input.trim().replace(/^@/, "").toLowerCase();
    if (!u) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/check-username?username=${encodeURIComponent(u)}`, {
        headers: authHeaders(),
      });
      const d = await res.json() as CheckResult & { error?: string };
      if (!res.ok) setError(d.error ?? "Something went wrong");
      else { setResult(d as CheckResult); void loadHistory(); }
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [input, loadHistory, authHeaders]);

  const checkBatch = useCallback(async () => {
    const lines = batchInput.split(/[\n,;]+/).map(s => s.trim().replace(/^@/, "").toLowerCase()).filter(Boolean);
    if (!lines.length) return;
    if (lines.length > 200) { setError("Max 200 usernames."); return; }
    setLoading(true); setError(null); setBatchRes([]); setBatchSort("none");
    try {
      const res = await fetch("/api/check-username", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ usernames: lines }),
      });
      const d = await res.json() as { results?: CheckResult[]; error?: string };
      if (!res.ok) setError(d.error ?? "Something went wrong");
      else { setBatchRes(d.results ?? []); void loadHistory(); }
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [batchInput, loadHistory, authHeaders]);

  const checkSweep = useCallback(async () => {
    const base = sweepInput.trim().replace(/^@/, "").toLowerCase();
    if (!base) return;
    const cands = buildSweepCandidates(base, sweepMode);
    setLoading(true); setError(null); setSweepRes([]); setSweepSort("none");
    try {
      const res = await fetch("/api/check-username", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ usernames: cands }),
      });
      const d = await res.json() as { results?: CheckResult[]; error?: string };
      if (!res.ok) setError(d.error ?? "Something went wrong");
      else { setSweepRes(d.results ?? []); void loadHistory(); }
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [sweepInput, sweepMode, loadHistory, authHeaders]);

  // ── Parser: fetch word list via server proxy ───────────────────────────────
  const handleFetchWordList = useCallback(async () => {
    if (!wordListUrl.trim()) return;
    setWordListFetching(true);
    setWordListError(null);
    setWordListInfo(null);
    allWordsRef.current = [];
    shownIndices.current = new Set();
    setParserList([]);
    setParserChecked([]);

    try {
      const res = await fetch(
        `/api/fetch-wordlist?url=${encodeURIComponent(wordListUrl.trim())}`
      );
      const data = await res.json() as { words?: string[]; total?: number; error?: string };
      if (!res.ok || data.error) {
        setWordListError(data.error ?? "Failed to load word list");
      } else {
        allWordsRef.current = data.words ?? [];
        shownIndices.current = new Set();
        setWordListInfo(
          `✓ Загружено ${data.total ?? data.words?.length ?? 0} слов · показывается по ${PAGE_SIZE} без повторений`
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWordListError(`Ошибка сети: ${msg}`);
    } finally {
      setWordListFetching(false);
    }
  }, [wordListUrl]);

  // Pick next PAGE_SIZE unique words never shown before in this session
  const handleNextPage = useCallback(() => {
    const all = allWordsRef.current;
    if (!all.length) {
      setWordListError("Сначала загрузите список слов");
      return;
    }

    // Gather indices not yet shown
    const available: number[] = [];
    for (let i = 0; i < all.length; i++) {
      if (!shownIndices.current.has(i)) available.push(i);
    }

    if (available.length === 0) {
      setWordListError(`Все ${all.length} слов были показаны. Загрузите новый список или перезагрузите страницу.`);
      return;
    }

    // Shuffle available indices and pick PAGE_SIZE
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    const picked = available.slice(0, PAGE_SIZE);
    picked.forEach(idx => shownIndices.current.add(idx));

    const words = picked.map(idx => all[idx]);
    setParserList(words);
    setParserChecked([]);
    setParserSort("none");
    setWordListError(null);
  }, []);

  const handleCheckParsed = useCallback(async () => {
    if (!parserList.length) return;
    setParserChecking(true); setParserChecked([]); setParserSort("none");
    try {
      let usernames: string[];
      if (parserSweepMode !== "off") {
        usernames = parserList.flatMap(w => buildSweepCandidates(w, parserSweepMode as SweepMode));
      } else {
        usernames = parserList;
      }
      usernames = usernames.slice(0, 200);
      const res = await fetch("/api/check-username", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ usernames }),
      });
      const d = await res.json() as { results?: CheckResult[]; error?: string };
      if (d.results) { setParserChecked(d.results); void loadHistory(); }
    } catch { /**/ }
    finally { setParserChecking(false); }
  }, [parserList, parserSweepMode, loadHistory, authHeaders]);

  const handleCopyParsed = useCallback(() => {
    navigator.clipboard.writeText(parserList.join("\n")).then(() => {
      setParserCopied(true);
      setTimeout(() => setParserCopied(false), 1500);
    });
  }, [parserList]);

  const fmtDate = (s: string) => {
    try {
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : d.toLocaleString("ru-RU", {
        timeZone: "Europe/Moscow",
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return s; }
  };

  const TABS = [
    { key: "single"   as const, label: "Single" },
    { key: "batch"    as const, label: "Batch" },
    { key: "sweep"    as const, label: "Sweep" },
    { key: "parser"   as const, label: "Parser" },
    { key: "history"  as const, label: "History" },
  ];

  const ghostBtn = (danger = false, active = false): React.CSSProperties => ({
    background: active ? (danger ? "rgba(240,64,64,0.08)" : C.bg3) : "transparent",
    border: `0.5px solid ${active ? (danger ? "rgba(240,64,64,0.35)" : C.lineHi) : C.line}`,
    borderRadius: "2px",
    padding: "4px 10px",
    color: active ? (danger ? "#f04040" : C.t0) : C.t2,
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex", alignItems: "center", gap: "5px",
    transition: "all 100ms ease",
    ...CSS.font,
  });

  const sweepRequestCount = parserSweepMode === "off"
    ? parserList.length
    : parserSweepMode === "digit-suffix"
      ? parserList.length * 11
      : parserList.length * 27;

  const remainingWords = allWordsRef.current.length > 0
    ? allWordsRef.current.length - shownIndices.current.size
    : 0;

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
        * { box-sizing: border-box; }
        textarea { box-sizing: border-box; }
        ::selection { background: ${C.tonDim}; color: ${C.t0}; }
        ::-webkit-scrollbar { width:3px; height:3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.lineHi}; border-radius:0; }
        input::placeholder { color: ${C.t2}; }
        textarea::placeholder { color: ${C.t2}; }
      `}</style>

      <div style={{ minHeight: "100vh", background: C.bg0, color: C.t0, display: "flex", flexDirection: "column" }}>
        <main style={{ maxWidth: "620px", width: "100%", margin: "0 auto", padding: "32px 24px 80px", flex: 1 }}>

          {/* Header */}
          <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: `0.5px solid ${C.line}` }}>
            <h1 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 5px", letterSpacing: "-0.01em", color: C.t0, ...CSS.font }}>
              Username Tool
            </h1>
            <p style={{ fontSize: "12px", color: C.t2, margin: 0, ...CSS.font }}>
              Search Fragment for available Telegram usernames. Real-time availability data.
            </p>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `0.5px solid ${C.line}`, marginBottom: "24px", overflowX: "auto" }}>
            {TABS.map(({ key, label }) => {
              const active = mode === key;
              return (
                <button key={key}
                  onClick={() => { setMode(key); resetState(); if (key === "history") void loadHistory(); }}
                  style={{
                    padding: "7px 14px",
                    border: "none",
                    borderBottom: `1.5px solid ${active ? C.t0 : "transparent"}`,
                    background: "transparent",
                    color: active ? C.t0 : C.t2,
                    fontWeight: active ? 700 : 400,
                    fontSize: "12px",
                    letterSpacing: "0.04em",
                    cursor: "pointer",
                    marginBottom: "-0.5px",
                    transition: "color 100ms ease, border-color 100ms ease",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    ...CSS.font,
                  }}
                >{label}</button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "9px 12px",
              border: "0.5px solid rgba(240,64,64,0.3)",
              background: "rgba(240,64,64,0.07)",
              borderRadius: "2px",
              color: "#f04040",
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

          {/* ── Single ── */}
          {mode === "single" && (
            <div>
              <InputRow style={{ marginBottom: "5px" }}>
                <span style={{ padding: "0 4px 0 13px", color: C.t2, fontSize: "15px", userSelect: "none", flexShrink: 0, ...CSS.font }}>@</span>
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
              <p style={{ fontSize: "10px", color: C.t3, marginBottom: "24px", marginTop: "4px", ...CSS.font }}>
                3–32 chars · letters, numbers, underscores · press Enter
              </p>

              {result && !error && (
                <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", background: C.bg1, animation: "fadeUp 0.15s ease forwards" }}>
                  <div style={{
                    padding: "8px 13px",
                    background: C.bg2,
                    borderBottom: `0.5px solid ${C.line}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                  }}>
                    <span style={{ fontSize: "10px", color: C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...CSS.font }}>
                      fragment.com/username/{result.username}
                    </span>
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
                        {result.name && (
                          <div style={{ fontSize: "12px", color: C.t1, marginTop: "2px", ...CSS.font }}>{result.name}</div>
                        )}
                        {result.status === "Reserved" && (
                          <div style={{ fontSize: "11px", color: "#6b8cff", marginTop: "4px", ...CSS.font }}>
                            Reserved by Telegram · cannot be registered
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
                            border: `0.5px solid ${C.line}`,
                            borderRadius: "2px",
                            background: C.bg2,
                            color: C.t1,
                            textDecoration: "none",
                            fontSize: "11px",
                            fontWeight: 600,
                            transition: "background 100ms ease, border-color 100ms ease",
                            ...CSS.font,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = C.bg3; e.currentTarget.style.borderColor = C.lineHi; }}
                          onMouseLeave={e => { e.currentTarget.style.background = C.bg2; e.currentTarget.style.borderColor = C.line; }}
                        >
                          {icon}{label}
                        </a>
                      ))}
                    </div>
                  </div>
                  {result.source && (
                    <div style={{ padding: "5px 13px", borderTop: `0.5px solid ${C.line}`, background: C.bg2, fontSize: "10px", color: C.t3, ...CSS.font }}>
                      source: {result.source}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Batch ── */}
          {mode === "batch" && (
            <div>
              <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", marginBottom: "10px", background: C.bg1 }}>
                <div style={{
                  padding: "6px 12px",
                  background: C.bg2,
                  borderBottom: `0.5px solid ${C.line}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: "10px", color: C.t2, letterSpacing: "0.04em", ...CSS.font }}>One username per line, or comma/semicolon separated</span>
                  <span style={{ fontSize: "11px", color: C.t1, fontWeight: 600, ...CSS.font }}>
                    {batchInput.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).length}
                    <span style={{ color: C.t3, fontWeight: 400 }}>/200</span>
                  </span>
                </div>
                <textarea
                  value={batchInput}
                  onChange={e => { setBatchInput(e.target.value); setError(null); setBatchRes([]); }}
                  placeholder={"username1\nusername2\nusername3"}
                  rows={8}
                  style={{
                    width: "100%",
                    background: C.bg1,
                    border: "none", outline: "none",
                    color: C.t0,
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

          {/* ── Sweep ── */}
          {mode === "sweep" && (
            <div>
              <div style={{
                padding: "9px 12px",
                background: C.tonDim,
                border: `0.5px solid rgba(0,152,234,0.25)`,
                borderRadius: "2px",
                fontSize: "12px",
                color: C.t1,
                marginBottom: "18px",
                lineHeight: 1.55,
                ...CSS.font,
              }}>
                {sweepMode === "digit-suffix"
                  ? <>Checks the exact username + all 10 digit variants (0–9). <span style={{ color: C.t0, fontWeight: 700 }}>11 requests total.</span></>
                  : <>Checks the exact username + all 26 letter variants (a–z). <span style={{ color: C.t0, fontWeight: 700 }}>27 requests total.</span></>
                }
              </div>

              <InputRow style={{ marginBottom: "9px" }}>
                <span style={{ padding: "0 4px 0 13px", color: C.t2, fontSize: "15px", userSelect: "none", flexShrink: 0, ...CSS.font }}>@</span>
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

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px" }}>
                <SegmentedControl<SweepMode>
                  label="Mode"
                  value={sweepMode}
                  onChange={v => { setSweepMode(v); setSweepRes([]); }}
                  options={[
                    { k: "alpha-suffix", label: "username + a" },
                    { k: "alpha-prefix", label: "a + username" },
                    { k: "digit-suffix", label: "username + 1" },
                  ]}
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
                      <div style={{ fontSize: "9px", fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px", ...CSS.font }}>
                        {sweepMode === "digit-suffix" ? "Digit variants 0–9" : sweepMode === "alpha-prefix" ? "Letter variants a–z (prefix)" : "Letter variants a–z"}
                      </div>
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
              <div style={{
                padding: "9px 12px",
                background: C.tonDim,
                border: `0.5px solid rgba(0,152,234,0.25)`,
                borderRadius: "2px",
                fontSize: "12px",
                color: C.t1,
                marginBottom: "20px",
                lineHeight: 1.55,
                ...CSS.font,
              }}>
                Загрузите список слов по ссылке (Pastebin или любой raw-текст). Каждый клик «Следующие 200» выдаёт новую порцию без повторений — даже если в списке 10&thinsp;000 слов.
              </div>

              {/* Word list URL */}
              <div style={{
                background: C.bg1,
                border: `0.5px solid ${C.line}`,
                borderRadius: "2px",
                overflow: "hidden",
                marginBottom: "14px",
              }}>
                <div style={{
                  background: C.bg2, borderBottom: `0.5px solid ${C.line}`,
                  padding: "7px 13px",
                  fontSize: "10px", color: C.t3, letterSpacing: "0.06em", ...CSS.font,
                }}>
                  источник · pastebin / raw-ссылка
                </div>
                <div style={{ padding: "14px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      value={wordListUrl}
                      onChange={e => {
                        setWordListUrl(e.target.value);
                        setWordListError(null);
                        setWordListInfo(null);
                        allWordsRef.current = [];
                        shownIndices.current = new Set();
                      }}
                      onKeyDown={e => { if (e.key === "Enter") void handleFetchWordList(); }}
                      placeholder="https://pastebin.com/xxxxxxxx"
                      style={{
                        flex: 1,
                        background: C.bg2,
                        border: `0.5px solid ${wordListError ? "rgba(240,64,64,0.4)" : C.line}`,
                        borderRadius: "2px",
                        padding: "7px 10px",
                        color: C.t0,
                        fontSize: "12px",
                        fontWeight: 600,
                        outline: "none",
                        ...CSS.font,
                      }}
                    />
                    <button
                      onClick={() => void handleFetchWordList()}
                      disabled={wordListFetching || !wordListUrl.trim()}
                      style={{
                        padding: "0 14px",
                        background: wordListFetching || !wordListUrl.trim() ? "rgba(240,240,242,0.05)" : C.tonDim,
                        border: `0.5px solid ${wordListFetching || !wordListUrl.trim() ? C.line : "rgba(0,152,234,0.3)"}`,
                        borderRadius: "2px",
                        color: wordListFetching || !wordListUrl.trim() ? C.t3 : C.ton,
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: wordListFetching || !wordListUrl.trim() ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                        display: "flex", alignItems: "center", gap: "5px",
                        transition: "all 100ms ease",
                        ...CSS.font,
                      }}
                    >
                      {wordListFetching ? <><Spinner size={10} />Загрузка…</> : "Загрузить"}
                    </button>
                  </div>
                  {wordListError && (
                    <div style={{ fontSize: "11px", color: "#f04040", marginTop: "6px", ...CSS.font }}>✕ {wordListError}</div>
                  )}
                  {wordListInfo && !wordListError && (
                    <div style={{ fontSize: "11px", color: "#35c96b", marginTop: "6px", ...CSS.font }}>{wordListInfo}</div>
                  )}
                </div>
              </div>

              {/* Next page button */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
                <button
                  onClick={handleNextPage}
                  disabled={!allWordsRef.current.length}
                  style={{
                    background: allWordsRef.current.length ? C.t0 : "rgba(240,240,242,0.05)",
                    color: allWordsRef.current.length ? C.bg0 : C.t3,
                    border: "none",
                    borderRadius: "2px",
                    padding: "9px 20px",
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    cursor: allWordsRef.current.length ? "pointer" : "not-allowed",
                    transition: "background 120ms ease",
                    ...CSS.font,
                  }}
                  onMouseEnter={e => { if (allWordsRef.current.length) (e.currentTarget as HTMLButtonElement).style.background = "rgba(240,240,242,0.85)"; }}
                  onMouseLeave={e => { if (allWordsRef.current.length) (e.currentTarget as HTMLButtonElement).style.background = C.t0; }}
                >
                  {parserList.length === 0 ? "Показать первые 200" : "Следующие 200"}
                </button>
                {allWordsRef.current.length > 0 && (
                  <span style={{ fontSize: "11px", color: C.t2, ...CSS.font }}>
                    осталось <span style={{ color: remainingWords === 0 ? "#f04040" : C.t0, fontWeight: 700 }}>{remainingWords}</span> из {allWordsRef.current.length}
                  </span>
                )}
                {!allWordsRef.current.length && (
                  <span style={{ fontSize: "10px", color: C.t3, ...CSS.font }}>сначала загрузите список</span>
                )}
              </div>

              {/* Parser list */}
              {parserList.length > 0 && (
                <div style={{ animation: "fadeUp 0.15s ease forwards" }}>
                  {/* Sweep mode */}
                  <div style={{
                    background: C.bg1,
                    border: `0.5px solid ${C.line}`,
                    borderRadius: "2px",
                    overflow: "hidden",
                    marginBottom: "10px",
                  }}>
                    <div style={{
                      background: C.bg2, borderBottom: `0.5px solid ${C.line}`,
                      padding: "7px 13px",
                      fontSize: "10px", color: C.t3, letterSpacing: "0.06em", ...CSS.font,
                    }}>
                      режим проверки
                    </div>
                    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <SegmentedControl<GenSweepMode>
                        label="Sweep"
                        value={parserSweepMode}
                        onChange={v => { setParserSweepMode(v); setParserChecked([]); }}
                        options={[
                          { k: "off",          label: "Точно" },
                          { k: "alpha-suffix", label: "слово + a–z" },
                          { k: "alpha-prefix", label: "a–z + слово" },
                          { k: "digit-suffix", label: "слово + 0–9" },
                        ]}
                      />
                      {parserSweepMode !== "off" && (
                        <div style={{ fontSize: "10px", color: C.t2, ...CSS.font }}>
                          {sweepRequestCount} запросов
                          {sweepRequestCount > 200 && (
                            <span style={{ color: "#e8a030", marginLeft: "6px" }}>· обрезается до 200</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action bar */}
                  <div style={{ display: "flex", gap: "5px", marginBottom: "10px", flexWrap: "wrap" }}>
                    <button onClick={handleCopyParsed} style={ghostBtn(false, parserCopied)}>
                      {parserCopied ? "✓ Скопировано" : "Скопировать"}
                    </button>
                    <button
                      onClick={() => void handleCheckParsed()}
                      disabled={parserChecking}
                      style={{
                        ...ghostBtn(),
                        background: parserChecking ? "transparent" : C.tonDim,
                        borderColor: parserChecking ? C.line : "rgba(0,152,234,0.3)",
                        color: parserChecking ? C.t2 : C.ton,
                        cursor: parserChecking ? "not-allowed" : "pointer",
                      }}
                    >
                      {parserChecking ? <><Spinner size={10} />Проверка…</> : "Проверить доступность"}
                    </button>
                    <span style={{ fontSize: "11px", color: C.t2, display: "flex", alignItems: "center", marginLeft: "4px", ...CSS.font }}>
                      {parserList.length} слов
                    </span>
                  </div>

                  {parserChecked.length > 0 ? (
                    <Results results={parserChecked} sort={parserSort} setSort={setParserSort} />
                  ) : (
                    <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", background: C.bg1 }}>
                      {parserList.map((u, i) => (
                        <div
                          key={u + i}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "28px 1fr 14px",
                            alignItems: "center",
                            padding: "7px 13px",
                            gap: "10px",
                            ...(i < parserList.length - 1 ? ROW_BORDER : {}),
                            transition: "background 100ms ease",
                          }}
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
                <div style={{
                  padding: "40px 16px",
                  textAlign: "center",
                  border: `0.5px solid ${C.line}`,
                  borderRadius: "2px",
                  color: C.t2,
                  fontSize: "12px",
                  background: C.bg1,
                  ...CSS.font,
                }}>
                  Загрузите список слов по ссылке, чтобы начать
                </div>
              )}
            </div>
          )}

          {/* ── History ── */}
          {mode === "history" && (
            <div style={{ animation: "fadeUp 0.15s ease forwards" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", color: C.t2, ...CSS.font }}>
                    Your recent checks
                  </span>
                  {userIdDisplay && (
                    <div style={{ fontSize: "9px", color: C.t3, marginTop: "2px", letterSpacing: "0.04em", ...CSS.font }}>
                      private · stored by device ID
                    </div>
                  )}
                </div>
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
                <div style={{
                  padding: "40px 16px",
                  textAlign: "center",
                  border: `0.5px solid ${C.line}`,
                  borderRadius: "2px",
                  color: C.t2,
                  fontSize: "12px",
                  background: C.bg1,
                  ...CSS.font,
                }}>
                  No checks yet.
                </div>
              ) : (
                <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", background: C.bg1 }}>
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

        <footer style={{
          borderTop: `0.5px solid ${C.line}`,
          padding: "10px 24px",
          background: C.bg1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <TonLogo size={11} />
            <span style={{ fontSize: "10px", color: C.t3, ...CSS.font }}>Unofficial tool · Not affiliated with Telegram or Fragment</span>
            <span style={{ color: C.t3, fontSize: "10px" }}>·</span>
            <a
              href="https://fragment.com"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "10px", color: C.t2, textDecoration: "none", transition: "color 100ms ease", ...CSS.font }}
              onMouseEnter={e => (e.currentTarget.style.color = C.t0)}
              onMouseLeave={e => (e.currentTarget.style.color = C.t2)}
            >
              fragment.com
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}