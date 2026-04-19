
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

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  Available: {
    label: "Available",
    color: "#2ec45e",
    bg: "rgba(46,196,94,0.08)",
    border: "rgba(46,196,94,0.25)",
    icon: "✓",
  },
  Taken: {
    label: "Taken",
    color: "#e05252",
    bg: "rgba(224,82,82,0.08)",
    border: "rgba(224,82,82,0.25)",
    icon: "✕",
  },
  "For Sale": {
    label: "For Sale / Auction",
    color: "#f5a623",
    bg: "rgba(245,166,35,0.08)",
    border: "rgba(245,166,35,0.25)",
    icon: "◆",
  },
  Sold: {
    label: "Sold",
    color: "#7ea8c4",
    bg: "rgba(126,168,196,0.08)",
    border: "rgba(126,168,196,0.25)",
    icon: "●",
  },
  Invalid: {
    label: "Invalid",
    color: "#e05252",
    bg: "rgba(224,82,82,0.08)",
    border: "rgba(224,82,82,0.25)",
    icon: "!",
  },
  Unknown: {
    label: "Unknown",
    color: "#7ea8c4",
    bg: "rgba(126,168,196,0.08)",
    border: "rgba(126,168,196,0.25)",
    icon: "?",
  },
};

const STATUS_GROUP_ORDER = ["Available", "For Sale", "Sold", "Taken", "Unknown", "Invalid"];

function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[status] ?? {
      label: status,
      color: "#7ea8c4",
      bg: "rgba(126,168,196,0.08)",
      border: "rgba(126,168,196,0.25)",
      icon: "?",
    }
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = getStatusConfig(status);
  return (
    <span
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: "6px",
        padding: "2px 10px",
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0.03em",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: "10px" }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function TonLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="28" r="28" fill="#0098EA" />
      <path
        d="M38.82 17H17.18C13.64 17 11.43 20.85 13.2 23.9L26.37 46.59C27.14 47.93 29.07 47.93 29.83 46.59L43 23.9C44.57 20.85 42.36 17 38.82 17ZM25.4 35.46L19.68 25.3H25.4V35.46ZM25.4 23.3H18.03L25.4 19.5V23.3ZM30.6 35.46V25.3H36.32L30.6 35.46ZM30.6 23.3V19.5L37.97 23.3H30.6Z"
        fill="white"
      />
    </svg>
  );
}

function FragmentLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#3dabf5" />
      <path d="M8 10h10v3H11v2.5h6v3h-6V23H8V10z" fill="white" />
      <path d="M20 10h4v13h-4V10z" fill="white" opacity="0.6" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(61,171,245,0.2)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#3dabf5" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function PremiumStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
      <path
        d="M10 1l2.39 4.84 5.35.78-3.87 3.77.91 5.31L10 13.27l-4.78 2.51.91-5.31L2.26 6.62l5.35-.78L10 1z"
        fill="#FFD700" stroke="#e6be00" strokeWidth="0.5"
      />
    </svg>
  );
}

function ResultRow({ r, isLast }: { r: CheckResult; isLast: boolean }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", padding: "12px 16px",
        borderBottom: isLast ? "none" : "1px solid var(--border-color)",
        gap: "12px", transition: "background 0.1s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
    >
      {r.photo ? (
        <img src={r.photo} alt={r.username} style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #3dabf5 0%, #0052a3 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "white", flexShrink: 0 }}>
          {r.username[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>@{r.username}</span>
          {r.hasPremium && <PremiumStar />}
        </div>
        {r.name && (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.name}
          </div>
        )}
      </div>
      <StatusBadge status={r.status} />
      {r.status !== "Invalid" && (
        <a
          href={`https://fragment.com/username/${r.username}`}
          target="_blank" rel="noopener noreferrer"
          style={{ color: "var(--text-muted)", textDecoration: "none", display: "flex", alignItems: "center", flexShrink: 0, transition: "color 0.15s" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--accent-blue)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)")}
        >
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
            <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </a>
      )}
    </div>
  );
}

// ── Alpha Sweep letter pill ──
function LetterPill({ letter, status }: { letter: string; status: string | null }) {
  if (!status) {
    return (
      <div style={{ width: "38px", height: "38px", borderRadius: "8px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "var(--text-muted)", position: "relative" }}>
        {letter}
      </div>
    );
  }
  const cfg = getStatusConfig(status);
  return (
    <div
      title={`@...${letter} — ${status}`}
      style={{ width: "38px", height: "38px", borderRadius: "8px", background: cfg.bg, border: `1.5px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: cfg.color, position: "relative", cursor: "default", transition: "transform 0.1s" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.transform = "scale(1.1)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.transform = "scale(1)")}
    >
      {letter}
    </div>
  );
}

export default function HomePage() {
  const [input, setInput] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [sweepInput, setSweepInput] = useState("");
  const [mode, setMode] = useState<"single" | "batch" | "sweep">("single");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [batchResults, setBatchResults] = useState<CheckResult[]>([]);
  const [sweepResults, setSweepResults] = useState<CheckResult[]>([]);
  const [sweepProgress, setSweepProgress] = useState<number>(0); // 0-26
  const [sweepRunning, setSweepRunning] = useState(false);
  const [sortMode, setSortMode] = useState<"none" | "az" | "za" | "group">("none");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sweepAbortRef = useRef(false);

  const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

  const sortedResults = (() => {
    if (sortMode === "az") return [...batchResults].sort((a, b) => a.username.localeCompare(b.username));
    if (sortMode === "za") return [...batchResults].sort((a, b) => b.username.localeCompare(a.username));
    return batchResults;
  })();

  const groupedRows = (() => {
    if (sortMode !== "group") return null;
    const groups: { status: string; items: CheckResult[] }[] = [];
    for (const s of STATUS_GROUP_ORDER) {
      const items = batchResults.filter((r) => r.status === s).sort((a, b) => a.username.localeCompare(b.username));
      if (items.length > 0) groups.push({ status: s, items });
    }
    const known = new Set(STATUS_GROUP_ORDER);
    const extra = batchResults.filter((r) => !known.has(r.status));
    if (extra.length > 0) groups.push({ status: "Other", items: extra });
    return groups;
  })();

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/history");
      const data = (await res.json()) as { history: HistoryItem[] };
      setHistory(data.history ?? []);
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { void fetchHistory(); }, [fetchHistory]);

  const checkSingle = useCallback(async () => {
    const username = input.trim().replace(/^@/, "");
    if (!username) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/check-username?username=${encodeURIComponent(username)}`);
      const data = (await res.json()) as CheckResult & { error?: string };
      if (!res.ok) setError((data as { error?: string }).error ?? "Something went wrong");
      else { setResult(data as CheckResult); void fetchHistory(); }
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }, [input, fetchHistory]);

  const checkBatch = useCallback(async () => {
    const lines = batchInput.split(/[\n,;]+/).map((s) => s.trim().replace(/^@/, "")).filter(Boolean);
    if (lines.length === 0) return;
    if (lines.length > 100) { setError("Max 100 usernames per batch."); return; }
    setLoading(true); setError(null); setBatchResults([]); setSortMode("none");
    try {
      const res = await fetch("/api/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: lines }),
      });
      const data = (await res.json()) as { results?: CheckResult[]; error?: string };
      if (!res.ok) setError(data.error ?? "Something went wrong");
      else { setBatchResults(data.results ?? []); void fetchHistory(); }
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }, [batchInput, fetchHistory]);

  // Alpha sweep: appends a–z one at a time, streaming results
  const startAlphaSweep = useCallback(async () => {
    const base = sweepInput.trim().replace(/^@/, "");
    if (!base) return;
    sweepAbortRef.current = false;
    setSweepRunning(true);
    setSweepResults([]);
    setSweepProgress(0);
    setError(null);

    // Build 26 usernames
    const usernames = ALPHABET.map((l) => base + l);

    try {
      const res = await fetch("/api/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames }),
      });
      const data = (await res.json()) as { results?: CheckResult[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        // Animate results streaming in one by one
        const results = data.results ?? [];
        for (let i = 0; i < results.length; i++) {
          if (sweepAbortRef.current) break;
          setSweepResults((prev) => [...prev, results[i]]);
          setSweepProgress(i + 1);
          await new Promise((r) => setTimeout(r, 60));
        }
        void fetchHistory();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSweepRunning(false);
    }
  }, [sweepInput, fetchHistory, ALPHABET]);

  const stopSweep = () => {
    sweepAbortRef.current = true;
    setSweepRunning(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void checkSingle();
  };

  const handleSweepKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void startAlphaSweep();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const sortButtons: { key: typeof sortMode; label: string }[] = [
    { key: "none", label: "Default" },
    { key: "az", label: "A → Z" },
    { key: "za", label: "Z → A" },
    { key: "group", label: "By Status" },
  ];

  // Sweep summary counts
  const sweepCounts = sweepResults.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>

      {/* ── Header ── */}
      <header style={{ borderBottom: "1px solid var(--border-color)", background: "rgba(21,30,39,0.95)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 24px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FragmentLogo />
            <span style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Fragment</span>
            <span style={{ fontSize: "13px", color: "var(--text-muted)", paddingLeft: "8px", borderLeft: "1px solid var(--border-color)", marginLeft: "4px" }}>Username Checker</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <a href="https://fragment.com" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "13px", color: "var(--text-secondary)", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px", transition: "color 0.15s" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--accent-blue)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)")}
            >
              fragment.com
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </a>
            <button
              onClick={() => { setShowHistory(!showHistory); if (!showHistory) void fetchHistory(); }}
              style={{ background: showHistory ? "rgba(61,171,245,0.12)" : "transparent", border: `1px solid ${showHistory ? "rgba(61,171,245,0.3)" : "var(--border-color)"}`, borderRadius: "7px", padding: "5px 12px", color: showHistory ? "var(--accent-blue)" : "var(--text-secondary)", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", transition: "all 0.15s" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              History
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ padding: "72px 24px 48px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-100px", left: "50%", transform: "translateX(-50%)", width: "600px", height: "400px", background: "radial-gradient(ellipse at center, rgba(0,152,234,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(61,171,245,0.08)", border: "1px solid rgba(61,171,245,0.2)", borderRadius: "20px", padding: "4px 12px", fontSize: "12px", color: "var(--accent-blue)", marginBottom: "24px", fontWeight: 500 }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2ec45e", display: "inline-block", boxShadow: "0 0 6px #2ec45e" }} />
            Powered by Fragment API
          </div>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 46px)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: "0 0 14px", lineHeight: 1.15 }}>
            Check Telegram Username <span style={{ color: "var(--accent-blue)" }}>Availability</span>
          </h1>
          <p style={{ fontSize: "16px", color: "var(--text-secondary)", margin: "0 auto", maxWidth: "480px", lineHeight: 1.6 }}>
            Instantly check if a Telegram username is available, taken, for sale, or sold on the{" "}
            <a href="https://fragment.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-blue)", textDecoration: "none" }}>Fragment</a> marketplace.
          </p>
        </div>
      </section>

      {/* ── Main ── */}
      <main style={{ maxWidth: "720px", margin: "0 auto", padding: "0 24px 80px" }}>

        {/* Mode Toggle */}
        <div style={{ display: "flex", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "4px", marginBottom: "24px" }}>
          {(["single", "batch"] as const).map((m) => (
          {(["single", "batch", "sweep"] as const).map((m) => (
            <button key={m}
              onClick={() => { setMode(m); setResult(null); setBatchResults([]); setError(null); }}
              style={{ flex: 1, padding: "8px", borderRadius: "7px", border: "none", background: mode === m ? "rgba(61,171,245,0.15)" : "transparent", color: mode === m ? "var(--accent-blue)" : "var(--text-secondary)", fontWeight: mode === m ? 600 : 400, fontSize: "14px", cursor: "pointer", transition: "all 0.15s", outline: mode === m ? "1px solid rgba(61,171,245,0.3)" : "none" }}
              onClick={() => { setMode(m); setResult(null); setBatchResults([]); setSweepResults([]); setError(null); }}
              style={{ flex: 1, padding: "8px", borderRadius: "7px", border: "none", background: mode === m ? "rgba(61,171,245,0.15)" : "transparent", color: mode === m ? "var(--accent-blue)" : "var(--text-secondary)", fontWeight: mode === m ? 600 : 400, fontSize: "13px", cursor: "pointer", transition: "all 0.15s", outline: mode === m ? "1px solid rgba(61,171,245,0.3)" : "none", whiteSpace: "nowrap" }}
            >
              {m === "single" ? "Single Check" : "Batch Check (up to 100)"}
              {m === "single" ? "Single Check" : m === "batch" ? "Batch (up to 100)" : "🔤 Alpha Sweep"}
            </button>
          ))}
        </div>

        {/* ── Single Mode ── */}
        {mode === "single" && (
          <div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "6px 6px 6px 20px", display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "18px", fontWeight: 500, userSelect: "none", flexShrink: 0 }}>@</span>
              <input ref={inputRef} type="text" value={input}
                onChange={(e) => { setInput(e.target.value); setResult(null); setError(null); }}
                onKeyDown={handleKeyDown} placeholder="username" autoFocus
                autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: "18px", fontWeight: 500, letterSpacing: "0.01em" }}
              />
              <button onClick={() => void checkSingle()} disabled={loading || !input.trim()}
                style={{ background: loading ? "rgba(61,171,245,0.15)" : "linear-gradient(135deg, #3dabf5 0%, #0098ea 100%)", color: "white", border: "none", borderRadius: "9px", padding: "10px 22px", fontSize: "14px", fontWeight: 600, cursor: loading || !input.trim() ? "not-allowed" : "pointer", opacity: !input.trim() ? 0.5 : 1, display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {loading ? (<><Spinner />Checking...</>) : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Check</>)}
              </button>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "24px", textAlign: "center" }}>
              Press <kbd style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "4px", padding: "1px 6px", fontSize: "11px", color: "var(--text-secondary)" }}>Enter</kbd> to check · 3–32 characters · letters, numbers, underscores
            </p>
            {error && (
              <div className="animate-fade-in" style={{ background: "rgba(224,82,82,0.08)", border: "1px solid rgba(224,82,82,0.25)", borderRadius: "10px", padding: "14px 18px", color: "#e05252", fontSize: "14px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>⚠</span>{error}
              </div>
            )}
            {result && !error && (
              <div className="animate-fade-in" style={{ background: "var(--bg-card)", border: `1px solid ${getStatusConfig(result.status).border}`, borderRadius: "14px", padding: "24px", boxShadow: `0 4px 32px ${getStatusConfig(result.status).bg}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                  {result.photo ? (
                    <img src={result.photo} alt={result.username} style={{ width: "56px", height: "56px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border-color)", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "linear-gradient(135deg, #3dabf5 0%, #0052a3 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 700, color: "white", flexShrink: 0, border: "2px solid var(--border-color)" }}>
                      {result.username[0]?.toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>@{result.username}</span>
                      {result.hasPremium && <PremiumStar />}
                      <StatusBadge status={result.status} />
                    </div>
                    {result.name && <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>{result.name}</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "12px", flexWrap: "wrap" }}>
                      <a href={`https://fragment.com/username/${result.username}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(61,171,245,0.1)", border: "1px solid rgba(61,171,245,0.25)", borderRadius: "7px", padding: "6px 12px", color: "var(--accent-blue)", textDecoration: "none", fontSize: "13px", fontWeight: 500 }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "rgba(61,171,245,0.18)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "rgba(61,171,245,0.1)")}
                      >
                        <TonLogo />View on Fragment
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      </a>
                      <a href={`https://t.me/${result.username}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(0,152,234,0.08)", border: "1px solid rgba(0,152,234,0.2)", borderRadius: "7px", padding: "6px 12px", color: "#0098ea", textDecoration: "none", fontSize: "13px", fontWeight: 500 }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,152,234,0.14)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,152,234,0.08)")}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="#0098ea"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                        Open in Telegram
                      </a>
                    </div>
                  </div>
                </div>
                {result.source && (
                  <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border-color)", fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    Data source: {result.source}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Batch Mode ── */}
        {mode === "batch" && (
          <div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "14px", overflow: "hidden", marginBottom: "16px", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>Enter usernames (one per line, comma or semicolon separated)</span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {batchInput.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).length} / 100
                </span>
              </div>
              <textarea value={batchInput}
                onChange={(e) => { setBatchInput(e.target.value); setError(null); setBatchResults([]); }}
                placeholder={"username1\nusername2\nusername3"} rows={8}
                style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: "14px", fontFamily: "monospace", padding: "16px", resize: "vertical", lineHeight: 1.7 }}
              />
            </div>

            <button onClick={() => void checkBatch()} disabled={loading || !batchInput.trim()}
              style={{ width: "100%", background: loading ? "rgba(61,171,245,0.1)" : "linear-gradient(135deg, #3dabf5 0%, #0098ea 100%)", color: "white", border: "none", borderRadius: "10px", padding: "13px", fontSize: "15px", fontWeight: 600, cursor: loading || !batchInput.trim() ? "not-allowed" : "pointer", opacity: !batchInput.trim() ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "24px" }}
            >
              {loading ? (<><Spinner /> Checking usernames...</>) : (<><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Check All Usernames</>)}
            </button>

            {error && (
              <div className="animate-fade-in" style={{ background: "rgba(224,82,82,0.08)", border: "1px solid rgba(224,82,82,0.25)", borderRadius: "10px", padding: "14px 18px", color: "#e05252", fontSize: "14px", marginBottom: "20px" }}>
                ⚠ {error}
              </div>
            )}

            {batchResults.length > 0 && (
              <div className="animate-fade-in">
                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", marginBottom: "18px" }}>
                  {(["Available", "Taken", "For Sale", "Sold", "Unknown", "Invalid"] as const).map((s) => {
                    const count = batchResults.filter((r) => r.status === s).length;
                    if (count === 0) return null;
                    const cfg = getStatusConfig(s);
                    return (
                      <div key={s} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: "10px", padding: "12px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: "24px", fontWeight: 700, color: cfg.color }}>{count}</div>
                        <div style={{ fontSize: "11px", color: cfg.color, opacity: 0.8 }}>{cfg.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Sort controls */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px", gap: "6px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Sort:</span>
                  {sortButtons.map(({ key, label }) => (
                    <button key={key} onClick={() => setSortMode(key)}
                      style={{ background: sortMode === key ? "rgba(61,171,245,0.15)" : "transparent", border: `1px solid ${sortMode === key ? "rgba(61,171,245,0.3)" : "var(--border-color)"}`, borderRadius: "6px", padding: "4px 10px", color: sortMode === key ? "var(--accent-blue)" : "var(--text-secondary)", fontSize: "12px", fontWeight: sortMode === key ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Results */}
                {sortMode === "group" && groupedRows ? (
                  <div>
                    {groupedRows.map((group) => {
                      const cfg = getStatusConfig(group.status);
                      return (
                        <div key={group.status} style={{ marginBottom: "16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", padding: "0 4px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                              {cfg.icon} {cfg.label}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "1px 7px" }}>
                              {group.items.length}
                            </span>
                            <div style={{ flex: 1, height: "1px", background: cfg.border }} />
                          </div>
                          <div style={{ background: "var(--bg-card)", border: `1px solid ${cfg.border}`, borderRadius: "12px", overflow: "hidden" }}>
                            {group.items.map((r, i) => (
                              <ResultRow key={r.username} r={r} isLast={i === group.items.length - 1} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "12px", overflow: "hidden" }}>
                    {sortedResults.map((r, i) => (
                      <ResultRow key={i} r={r} isLast={i === sortedResults.length - 1} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Alpha Sweep Mode ── */}
        {mode === "sweep" && (
          <div>
            {/* Info banner */}
            <div style={{ background: "rgba(61,171,245,0.06)", border: "1px solid rgba(61,171,245,0.18)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "18px", flexShrink: 0 }}>🔤</span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent-blue)", marginBottom: "2px" }}>Alpha Sweep</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Enter a base username and we&apos;ll check all 26 variants with each letter of the alphabet appended.
                  Example: <span style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>username</span> →{" "}
                  <span style={{ fontFamily: "monospace", color: "var(--accent-blue)" }}>usernamea, usernameb … usernamez</span>
                </div>
              </div>
            </div>

            {/* Input */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "6px 6px 6px 20px", display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "18px", fontWeight: 500, userSelect: "none", flexShrink: 0 }}>@</span>
              <input
                type="text" value={sweepInput}
                onChange={(e) => { setSweepInput(e.target.value); setSweepResults([]); setError(null); }}
                onKeyDown={handleSweepKeyDown}
                placeholder="base_username"
                autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                disabled={sweepRunning}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: "18px", fontWeight: 500, letterSpacing: "0.01em", opacity: sweepRunning ? 0.6 : 1 }}
              />
              {/* Preview suffix */}
              {sweepInput.trim() && !sweepRunning && (
                <span style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: "monospace", flexShrink: 0, paddingRight: "8px" }}>
                  + a…z
                </span>
              )}
              {sweepRunning ? (
                <button onClick={stopSweep}
                  style={{ background: "rgba(224,82,82,0.15)", color: "#e05252", border: "1px solid rgba(224,82,82,0.3)", borderRadius: "9px", padding: "10px 18px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="2" width="8" height="8" rx="1" fill="#e05252" /></svg>
                  Stop
                </button>
              ) : (
                <button onClick={() => void startAlphaSweep()} disabled={!sweepInput.trim()}
                  style={{ background: !sweepInput.trim() ? "rgba(61,171,245,0.1)" : "linear-gradient(135deg, #3dabf5 0%, #0098ea 100%)", color: "white", border: "none", borderRadius: "9px", padding: "10px 22px", fontSize: "14px", fontWeight: 600, cursor: !sweepInput.trim() ? "not-allowed" : "pointer", opacity: !sweepInput.trim() ? 0.5 : 1, display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="white" /></svg>
                  Sweep
                </button>
              )}
            </div>

            {error && (
              <div className="animate-fade-in" style={{ background: "rgba(224,82,82,0.08)", border: "1px solid rgba(224,82,82,0.25)", borderRadius: "10px", padding: "14px 18px", color: "#e05252", fontSize: "14px", marginBottom: "20px" }}>
                ⚠ {error}
              </div>
            )}

            {/* Progress bar */}
            {(sweepRunning || sweepResults.length > 0) && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {sweepRunning ? `Checking… ${sweepProgress}/26` : `Complete — ${sweepProgress}/26 checked`}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {sweepInput.trim().replace(/^@/, "")}a…{sweepInput.trim().replace(/^@/, "")}z
                  </span>
                </div>
                <div style={{ height: "4px", background: "var(--bg-secondary)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(sweepProgress / 26) * 100}%`, background: "linear-gradient(90deg, #3dabf5, #2ec45e)", borderRadius: "2px", transition: "width 0.15s ease" }} />
                </div>
              </div>
            )}

            {/* Letter grid */}
            {(sweepRunning || sweepResults.length > 0) && (
              <div style={{ marginBottom: "24px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "10px", fontWeight: 500 }}>Overview</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {ALPHABET.map((letter, i) => {
                    const res = sweepResults.find((r) => r.username.endsWith(letter) && r.username.slice(0, -1) === sweepInput.trim().replace(/^@/, ""));
                    return (
                      <LetterPill key={letter} letter={letter} status={i < sweepProgress ? (res?.status ?? "Unknown") : null} />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Summary counts */}
            {sweepResults.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "8px", marginBottom: "20px" }}>
                {Object.entries(sweepCounts).map(([status, count]) => {
                  const cfg = getStatusConfig(status);
                  return (
                    <div key={status} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: "10px", padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: "22px", fontWeight: 700, color: cfg.color }}>{count}</div>
                      <div style={{ fontSize: "11px", color: cfg.color, opacity: 0.8 }}>{cfg.label}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full results list */}
            {sweepResults.length > 0 && (
              <div className="animate-fade-in">
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "10px", fontWeight: 500 }}>
                  All results
                </div>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "12px", overflow: "hidden" }}>
                  {sweepResults.map((r, i) => (
                    <ResultRow key={r.username} r={r} isLast={i === sweepResults.length - 1} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── History Panel ── */}
        {showHistory && (
          <div className="animate-fade-in" style={{ marginTop: "40px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--text-secondary)" strokeWidth="2" /><path d="M12 6v6l4 2" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" /></svg>
                Recent Checks
              </h2>
              <button onClick={() => void fetchHistory()}
                style={{ background: "transparent", border: "1px solid var(--border-color)", borderRadius: "7px", padding: "4px 10px", color: "var(--text-muted)", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
              >
                {historyLoading ? <Spinner /> : "↻"} Refresh
              </button>
            </div>
            {history.length === 0 ? (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                No checks yet. Start by searching a username above.
              </div>
            ) : (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "12px", overflow: "hidden" }}>
                {history.map((item, i) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderBottom: i < history.length - 1 ? "1px solid var(--border-color)" : "none", gap: "12px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #3dabf5 0%, #0052a3 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "white", flexShrink: 0 }}>
                      {item.username[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                        @{item.username}{item.hasPremium === "true" && <PremiumStar />}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatDate(item.checkedAt)}</div>
                    </div>
                    <StatusBadge status={item.status} />
                    <a href={`https://fragment.com/username/${item.username}`} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--text-muted)", textDecoration: "none", flexShrink: 0, transition: "color 0.15s" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--accent-blue)")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)")}
                    >
                      <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border-color)", padding: "24px", textAlign: "center" }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", flexWrap: "wrap" }}>
          <span>Built with</span><TonLogo />
          <a href="https://fragment.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-blue)", textDecoration: "none" }}>Fragment</a>
          <span>·</span><span>Unofficial tool · Not affiliated with Telegram or Fragment</span>
        </p>
      </footer>
    </div>
  );
}
