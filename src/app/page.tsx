"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  C, FONT, STATUS_ORDER, PAGE_SIZE, API_CHUNK,
  getOrCreateUserId, buildSweepCandidates, fmtDate,
  saveCheckResume, loadCheckResume, clearCheckResume,
  type CheckResult, type HistoryItem, type Sort, type SweepMode, type GenSweepMode, type ResumeState,
} from "@/lib/ui-constants";
import {
  TonLogo, Spinner, PremiumStar, ExtLink, StatusPill, Avatar,
  InputRow, PrimaryBtn, SegmentedControl, ProgressBar,
  ResultRow, Results, SweepVariantGrid, ghostBtn,
  TEXT_INPUT,
} from "@/components/ui";

const ROW_BORDER: React.CSSProperties = { borderBottom: `0.5px solid ${C.line}` };

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

  // Persistence refs
  const isRunningRef       = useRef(false);
  const currentProgressRef = useRef<{ mode: "batch" | "parser"; remaining: string[]; partial: CheckResult[] } | null>(null);
  const [resumeState, setResumeState] = useState<ResumeState | null>(null);

  const allWordsRef  = useRef<string[]>([]);
  const shownIndices = useRef<Set<number>>(new Set());

  const [parserList, setParserList]           = useState<string[]>([]);
  const [parserChecked, setParserChecked]     = useState<CheckResult[]>([]);
  const [parserSort, setParserSort]           = useState<Sort>("none");
  const [parserChecking, setParserChecking]   = useState(false);
  const [parserCopied, setParserCopied]       = useState(false);
  const [parserSweepMode, setParserSweepMode] = useState<GenSweepMode>("off");
  const [parserProgress, setParserProgress]   = useState<{ done: number; total: number } | null>(null);
  const [batchProgress, setBatchProgress]     = useState<{ done: number; total: number } | null>(null);

  const [wordListUrl, setWordListUrl]           = useState("");
  const [wordListFetching, setWordListFetching] = useState(false);
  const [wordListError, setWordListError]       = useState<string | null>(null);
  const [wordListInfo, setWordListInfo]         = useState<string | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const uid = getOrCreateUserId();
    userIdRef.current = uid;
    setUserIdDisplay(uid);
  }, []);

  // Load saved resume state on mount
  useEffect(() => {
    const saved = loadCheckResume();
    if (saved) setResumeState(saved);
  }, []);

  // Pause on tab hide
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (loading || parserChecking) { pausedRef.current = true; setIsPaused(true); }
      } else {
        if (pausedRef.current) { pausedRef.current = false; setIsPaused(false); }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loading, parserChecking]);

  // ── Persistence: save on beforeunload (close tab / navigate away) ─────────

  const saveProgress = useCallback(() => {
    if (currentProgressRef.current?.remaining.length) {
      saveCheckResume(currentProgressRef.current);
    }
  }, []);

  useEffect(() => {
    const handler = () => { if (isRunningRef.current) saveProgress(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveProgress]);

  // Save on component unmount (Next.js internal navigation)
  useEffect(() => {
    return () => {
      if (isRunningRef.current && currentProgressRef.current?.remaining.length) {
        saveProgress();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auth / helpers ────────────────────────────────────────────────────────

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

  // Heartbeat
  useEffect(() => {
    const ping = () => { void fetch("/api/admin/presence", { method: "POST" }); };
    ping();
    const id = setInterval(ping, 30_000);
    return () => clearInterval(id);
  }, []);

  const clearHistory = useCallback(async () => {
    if (!clearOk) { setClearOk(true); setTimeout(() => setClearOk(false), 3000); return; }
    try {
      await fetch("/api/history", { method: "DELETE", headers: authHeaders() });
      setHistory([]); setClearOk(false);
    } catch { /**/ }
  }, [clearOk, authHeaders]);

  // ── State management ──────────────────────────────────────────────────────

  const resetState = useCallback(() => {
    // Stop any running check FIRST so background requests are cancelled
    stoppedRef.current = true;
    pausedRef.current = false;
    isRunningRef.current = false;
    currentProgressRef.current = null;

    setResult(null); setBatchRes([]); setSweepRes([]);
    setParserList([]); setParserChecked([]); setError(null);
    setWordListError(null); setWordListInfo(null);
    setBatchProgress(null); setParserProgress(null);
    setIsPaused(false); setIsStopped(false);
    setLoading(false); setParserChecking(false);

    pendingQueueRef.current = []; partialResultsRef.current = [];
    activeCheckMode.current = null;
  }, []);

  const handleModeChange = useCallback((key: typeof mode) => {
    // Save progress before switching away if a check is running
    if (isRunningRef.current && currentProgressRef.current?.remaining.length) {
      saveProgress();
    }
    resetState();
    setMode(key);
    if (key === "history") void loadHistory();
  }, [resetState, saveProgress, loadHistory]);

  const handleStop = useCallback(() => {
    stoppedRef.current = true; pausedRef.current = false;
    setIsStopped(true); setIsPaused(false);
    setLoading(false); setParserChecking(false);
    isRunningRef.current = false;
    // Save whatever is left so user can resume later
    if (currentProgressRef.current?.remaining.length) saveProgress();
    setBatchProgress(null); setParserProgress(null);
  }, [saveProgress]);

  // ── Core check engine ─────────────────────────────────────────────────────

  const waitIfPaused = useCallback((): Promise<boolean> => {
    return new Promise(resolve => {
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
      if (!canContinue || stoppedRef.current)
        return { results: allResults, stopped: true, remaining: usernames.slice(i) };

      const chunk = usernames.slice(i, i + API_CHUNK);
      try {
        const res = await fetch("/api/check-username", {
          method: "POST", headers: authHeaders(), body: JSON.stringify({ usernames: chunk }),
        });
        const d = await res.json() as { results?: CheckResult[]; error?: string };
        if (!res.ok) throw new Error(d.error ?? "Something went wrong");
        allResults.push(...(d.results ?? []));

        // Track progress for persistence after every chunk
        const remaining = usernames.slice(i + API_CHUNK);
        if (activeCheckMode.current) {
          currentProgressRef.current = {
            mode: activeCheckMode.current,
            remaining,
            partial: [...allResults],
          };
        }

        onProgress(startDone + allResults.length - existingResults.length, total, [...allResults]);
      } catch (e) {
        if (stoppedRef.current) return { results: allResults, stopped: true, remaining: usernames.slice(i) };
        throw e;
      }
      if (stoppedRef.current)
        return { results: allResults, stopped: true, remaining: usernames.slice(i + API_CHUNK) };
    }
    return { results: allResults, stopped: false, remaining: [] };
  }, [authHeaders, waitIfPaused]);

  // ── Single check ──────────────────────────────────────────────────────────

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

  // ── Batch check ───────────────────────────────────────────────────────────

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
    isRunningRef.current = true;

    const alreadyDone = isResume ? (resumePartial?.length ?? 0) : 0;
    setBatchProgress({ done: alreadyDone, total: lines.length + alreadyDone });

    // Init progress ref
    currentProgressRef.current = { mode: "batch", remaining: lines, partial: resumePartial ?? [] };

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
        currentProgressRef.current = null;
        clearCheckResume();
        void loadHistory();
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Network error."); }
    finally {
      setLoading(false);
      isRunningRef.current = false;
      if (!stoppedRef.current) setBatchProgress(null);
    }
  }, [batchInput, loadHistory, checkInChunksInterruptible]);

  const resumeBatch = useCallback(() => {
    if (!pendingQueueRef.current.length) return;
    stoppedRef.current = false; setIsStopped(false);
    void checkBatch(pendingQueueRef.current, partialResultsRef.current);
  }, [checkBatch]);

  // ── Sweep check ───────────────────────────────────────────────────────────

  const checkSweep = useCallback(async () => {
    const base = sweepInput.trim().replace(/^@/, "").toLowerCase();
    if (!base) return;
    setLoading(true); setError(null); setSweepRes([]); setSweepSort("none");
    try {
      const res = await fetch("/api/check-username", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ usernames: buildSweepCandidates(base, sweepMode) }),
      });
      const d = await res.json() as { results?: CheckResult[]; error?: string };
      if (!res.ok) setError(d.error ?? "Something went wrong");
      else { setSweepRes(d.results ?? []); void loadHistory(); }
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [sweepInput, sweepMode, loadHistory, authHeaders]);

  // ── Parser word list ──────────────────────────────────────────────────────

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
    const available = Array.from({ length: all.length }, (_, i) => i).filter(i => !shownIndices.current.has(i));
    if (!available.length) { setWordListError(`All ${all.length} words have been shown.`); return; }

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

  // ── Parser check ──────────────────────────────────────────────────────────

  const handleCheckParsed = useCallback(async (resumeQueue?: string[], resumePartial?: CheckResult[]) => {
    const isResume = !!resumeQueue;
    if (!isResume && !parserList.length) return;

    stoppedRef.current = false; pausedRef.current = false;
    setIsStopped(false); setIsPaused(false);
    setParserChecking(true);
    if (!isResume) { setParserChecked([]); setParserSort("none"); setParserProgress(null); }
    activeCheckMode.current = "parser";
    isRunningRef.current = true;

    const baseUsernames = isResume
      ? resumeQueue!
      : parserSweepMode !== "off"
        ? parserList.flatMap(w => buildSweepCandidates(w, parserSweepMode as SweepMode))
        : parserList;

    const alreadyDone = isResume ? (resumePartial?.length ?? 0) : 0;
    setParserProgress({ done: alreadyDone, total: baseUsernames.length + alreadyDone });

    // Init progress ref
    currentProgressRef.current = { mode: "parser", remaining: baseUsernames, partial: resumePartial ?? [] };

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
        currentProgressRef.current = null;
        clearCheckResume();
        void loadHistory();
      }
    } catch (e) { console.error("Parser check error:", e); }
    finally {
      setParserChecking(false);
      isRunningRef.current = false;
      if (!stoppedRef.current) setParserProgress(null);
    }
  }, [parserList, parserSweepMode, loadHistory, checkInChunksInterruptible]);

  const resumeParser = useCallback(() => {
    if (!pendingQueueRef.current.length) return;
    stoppedRef.current = false; setIsStopped(false);
    void handleCheckParsed(pendingQueueRef.current, partialResultsRef.current);
  }, [handleCheckParsed]);

  // ── Resume saved check ────────────────────────────────────────────────────

  const handleResumeFromSave = useCallback(() => {
    if (!resumeState) return;
    clearCheckResume();
    const state = resumeState;
    setResumeState(null);
    if (state.mode === "batch") {
      setMode("batch");
      // Restore partial results to UI immediately
      setBatchRes(state.partial);
      void checkBatch(state.remaining, state.partial);
    } else {
      setMode("parser");
      setParserChecked(state.partial);
      void handleCheckParsed(state.remaining, state.partial);
    }
  }, [resumeState, checkBatch, handleCheckParsed]);

  const handleDismissResume = useCallback(() => {
    clearCheckResume();
    setResumeState(null);
  }, []);

  // ── Parser copy ───────────────────────────────────────────────────────────

  const handleCopyParsed = useCallback(() => {
    navigator.clipboard.writeText(parserList.join("\n")).then(() => {
      setParserCopied(true); setTimeout(() => setParserCopied(false), 1500);
    });
  }, [parserList]);

  // ── Derived values ────────────────────────────────────────────────────────

  const TABS = [
    { key: "single" as const, label: "Single" }, { key: "batch" as const, label: "Batch" },
    { key: "sweep" as const, label: "Sweep" }, { key: "parser" as const, label: "Parser" },
    { key: "history" as const, label: "History" },
  ];

  const sweepRequestCount = parserSweepMode === "off" ? parserList.length
    : parserSweepMode === "digit-suffix" ? parserList.length * 11 : parserList.length * 27;
  const remainingWords = allWordsRef.current.length > 0 ? allWordsRef.current.length - shownIndices.current.size : 0;
  const batchLineCount = batchInput.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).length;
  const isCheckRunning = loading || parserChecking;
  const hasPendingQueue = pendingQueueRef.current.length > 0;

  const renderControlBar = (progressData: { done: number; total: number } | null, onResume: () => void) => {
    if (!progressData && !isStopped && !isPaused) return null;
    return (
      <div style={{ marginBottom: "10px" }}>
        {progressData && <ProgressBar done={progressData.done} total={progressData.total} paused={isPaused} />}
        {(isCheckRunning || isStopped || isPaused) && (
          <div style={{ display: "flex", gap: "5px", marginTop: "6px" }}>
            {isCheckRunning && !isStopped && (
              <button onClick={handleStop} style={{ ...ghostBtn(true), borderColor: "rgba(240,64,64,0.35)", color: "#f04040" }}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="8" height="8" rx="1" /></svg>
                Stop
              </button>
            )}
            {isStopped && hasPendingQueue && (
              <button onClick={onResume} style={{ ...ghostBtn(), background: "rgba(0,152,234,0.08)", borderColor: "rgba(0,152,234,0.3)", color: C.ton }}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 9,5 2,9" /></svg>
                Resume ({pendingQueueRef.current.length} left)
              </button>
            )}
            {isStopped && !hasPendingQueue && (
              <span style={{ fontSize: "11px", color: C.t2, display: "flex", alignItems: "center", ...FONT }}>✕ Stopped</span>
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
          background: linear-gradient(90deg, #f0f0f2 0%, #f0f0f2 20%, #6b6b7a 38%, #ffffff 50%, #6b6b7a 62%, #f0f0f2 80%, #f0f0f2 100%);
          background-size: 500px 100%;
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
          animation: shimmer 4s ease-in-out infinite;
        }
        * { box-sizing: border-box; } textarea { box-sizing: border-box; }
        ::selection { background: ${C.tonDim}; color: ${C.t0}; }
        ::-webkit-scrollbar { width:3px; height:3px; }
        ::-webkit-scrollbar-thumb { background: ${C.lineHi}; border-radius:0; }
        input::placeholder { color: ${C.t2}; } textarea::placeholder { color: ${C.t2}; }
      `}</style>

      <div style={{ minHeight: "100vh", background: C.bg0, color: C.t0, display: "flex", flexDirection: "column" }}>
        <main style={{ maxWidth: "620px", width: "100%", margin: "0 auto", padding: "32px 24px 80px", flex: 1 }}>

          {/* Header */}
          <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: `0.5px solid ${C.line}` }}>
            <h1 className="title-shimmer" style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 5px", letterSpacing: "-0.01em", ...FONT }}>
              Username Tool
            </h1>
            <p style={{ fontSize: "12px", color: C.t2, margin: 0, ...FONT }}>
              Search Fragment for available Telegram usernames. Real-time availability data.
            </p>
          </div>

          {/* Resume banner */}
          {resumeState && (
            <div style={{
              marginBottom: "16px", padding: "12px 14px",
              background: "rgba(0,152,234,0.07)", border: "0.5px solid rgba(0,152,234,0.3)",
              borderRadius: "2px", display: "flex", alignItems: "center",
              justifyContent: "space-between", gap: "12px", flexWrap: "wrap",
              animation: "fadeUp 0.2s ease forwards",
            }}>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: C.t0, marginBottom: "2px", ...FONT }}>
                  Unfinished check found
                </div>
                <div style={{ fontSize: "11px", color: C.t2, ...FONT }}>
                  {resumeState.mode === "batch" ? "Batch" : "Parser"} check ·{" "}
                  <span style={{ color: C.ton, fontWeight: 700 }}>{resumeState.remaining.length}</span> usernames remaining ·{" "}
                  <span style={{ color: C.t3 }}>{resumeState.partial.length} already checked</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                <button
                  onClick={handleResumeFromSave}
                  style={{
                    padding: "5px 14px", background: C.ton,
                    border: "none", borderRadius: "2px", color: "#fff",
                    fontSize: "11px", fontWeight: 700, cursor: "pointer",
                    letterSpacing: "0.04em", transition: "opacity 100ms ease", ...FONT,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                >
                  Resume
                </button>
                <button
                  onClick={handleDismissResume}
                  style={{
                    padding: "5px 10px", background: "transparent",
                    border: `0.5px solid ${C.line}`, borderRadius: "2px",
                    color: C.t2, fontSize: "11px", cursor: "pointer",
                    transition: "all 100ms ease", ...FONT,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.t0; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.t2; }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `0.5px solid ${C.line}`, marginBottom: "24px", overflowX: "auto" }}>
            {TABS.map(({ key, label }) => {
              const active = mode === key;
              return (
                <button key={key} onClick={() => handleModeChange(key)} style={{
                  padding: "7px 14px", border: "none", borderBottom: `1.5px solid ${active ? C.t0 : "transparent"}`,
                  background: "transparent", color: active ? C.t0 : C.t2,
                  fontWeight: active ? 700 : 400, fontSize: "12px", letterSpacing: "0.04em",
                  cursor: "pointer", marginBottom: "-0.5px", transition: "color 100ms ease, border-color 100ms ease",
                  whiteSpace: "nowrap", flexShrink: 0, ...FONT,
                }}>{label}</button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "9px 12px", border: "0.5px solid rgba(240,64,64,0.3)",
              background: "rgba(240,64,64,0.07)", borderRadius: "2px", color: "#f04040",
              fontSize: "12px", marginBottom: "14px", display: "flex", alignItems: "flex-start",
              gap: "8px", animation: "fadeUp 0.15s ease forwards", ...FONT,
            }}>
              <span style={{ flexShrink: 0, marginTop: "1px" }}>✕</span><span>{error}</span>
            </div>
          )}

          {/* ── Single ── */}
          {mode === "single" && (
            <div>
              <InputRow style={{ marginBottom: "5px" }}>
                <span style={{ padding: "0 4px 0 13px", color: C.t2, fontSize: "15px", userSelect: "none", flexShrink: 0, ...FONT }}>@</span>
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
              <p style={{ fontSize: "10px", color: C.t3, marginBottom: "24px", marginTop: "4px", ...FONT }}>
                3–32 chars · letters, numbers, underscores · press Enter
              </p>
              {result && !error && (
                <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", background: C.bg1, animation: "fadeUp 0.15s ease forwards" }}>
                  <div style={{ padding: "8px 13px", background: C.bg2, borderBottom: `0.5px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <span style={{ fontSize: "10px", color: C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...FONT }}>
                      fragment.com/username/{result.username}
                    </span>
                    <StatusPill status={result.status} />
                  </div>
                  <div style={{ padding: "14px 13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "11px", marginBottom: "14px" }}>
                      <Avatar username={result.username} photo={result.photo} size={40} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ fontSize: "15px", fontWeight: 700, color: C.t0, ...FONT }}>@{result.username}</span>
                          {result.hasPremium && <PremiumStar />}
                        </div>
                        {result.name && <div style={{ fontSize: "12px", color: C.t1, marginTop: "2px", ...FONT }}>{result.name}</div>}
                        {result.status === "Reserved" && <div style={{ fontSize: "11px", color: "#6b8cff", marginTop: "4px", ...FONT }}>Reserved by Telegram · cannot be registered</div>}
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
                          transition: "background 100ms ease, border-color 100ms ease", ...FONT,
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = C.bg3; e.currentTarget.style.borderColor = C.lineHi; }}
                          onMouseLeave={e => { e.currentTarget.style.background = C.bg2; e.currentTarget.style.borderColor = C.line; }}
                        >{icon}{label}</a>
                      ))}
                    </div>
                  </div>
                  {result.source && (
                    <div style={{ padding: "5px 13px", borderTop: `0.5px solid ${C.line}`, background: C.bg2, fontSize: "10px", color: C.t3, ...FONT }}>
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
                <div style={{ padding: "6px 12px", background: C.bg2, borderBottom: `0.5px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "10px", color: C.t2, letterSpacing: "0.04em", ...FONT }}>One username per line, or comma/semicolon separated</span>
                  <span style={{ fontSize: "11px", color: C.t1, fontWeight: 600, ...FONT }}>
                    {batchLineCount}<span style={{ color: batchLineCount > 1000 ? "#f04040" : C.t3, fontWeight: 400 }}>/1000</span>
                  </span>
                </div>
                <textarea value={batchInput}
                  onChange={e => { setBatchInput(e.target.value); setError(null); setBatchRes([]); }}
                  placeholder={"username1\nusername2\nusername3"} rows={8}
                  style={{ width: "100%", background: C.bg1, border: "none", outline: "none", color: C.t0, fontSize: "13px", fontWeight: 600, padding: "10px 12px", resize: "vertical", lineHeight: 1.7, ...FONT }}
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
              <div style={{ padding: "9px 12px", background: C.tonDim, border: `0.5px solid rgba(0,152,234,0.25)`, borderRadius: "2px", fontSize: "12px", color: C.t1, marginBottom: "18px", lineHeight: 1.55, ...FONT }}>
                {sweepMode === "digit-suffix"
                  ? <>Checks the exact username + all 10 digit variants (0–9). <span style={{ color: C.t0, fontWeight: 700 }}>11 requests total.</span></>
                  : <>Checks the exact username + all 26 letter variants (a–z). <span style={{ color: C.t0, fontWeight: 700 }}>27 requests total.</span> <span style={{ color: C.ton }}>Blue dot = commonly available suffix.</span></>
                }
              </div>
              <InputRow style={{ marginBottom: "9px" }}>
                <span style={{ padding: "0 4px 0 13px", color: C.t2, fontSize: "15px", userSelect: "none", flexShrink: 0, ...FONT }}>@</span>
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
                      <div style={{ fontSize: "9px", fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px", ...FONT }}>Original</div>
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
              <div style={{ padding: "9px 12px", background: C.tonDim, border: `0.5px solid rgba(0,152,234,0.25)`, borderRadius: "2px", fontSize: "12px", color: C.t1, marginBottom: "20px", lineHeight: 1.55, ...FONT }}>
                Load a word list from a URL (Pastebin or any raw text). Each click of &quot;Next 100&quot; shows a new batch without repeats.
              </div>

              {/* URL loader */}
              <div style={{ background: C.bg1, border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", marginBottom: "14px" }}>
                <div style={{ background: C.bg2, borderBottom: `0.5px solid ${C.line}`, padding: "7px 13px", fontSize: "10px", color: C.t3, letterSpacing: "0.06em", ...FONT }}>
                  source · pastebin / raw url
                </div>
                <div style={{ padding: "14px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input type="text" value={wordListUrl}
                      onChange={e => { setWordListUrl(e.target.value); setWordListError(null); setWordListInfo(null); allWordsRef.current = []; shownIndices.current = new Set(); }}
                      onKeyDown={e => { if (e.key === "Enter") void handleFetchWordList(); }}
                      placeholder="https://pastebin.com/xxxxxxxx"
                      style={{ flex: 1, background: C.bg2, border: `0.5px solid ${wordListError ? "rgba(240,64,64,0.4)" : C.line}`, borderRadius: "2px", padding: "7px 10px", color: C.t0, fontSize: "12px", fontWeight: 600, outline: "none", ...FONT }}
                    />
                    <button onClick={() => void handleFetchWordList()} disabled={wordListFetching || !wordListUrl.trim()} style={{
                      padding: "0 14px",
                      background: wordListFetching || !wordListUrl.trim() ? "rgba(240,240,242,0.05)" : C.tonDim,
                      border: `0.5px solid ${wordListFetching || !wordListUrl.trim() ? C.line : "rgba(0,152,234,0.3)"}`,
                      borderRadius: "2px", color: wordListFetching || !wordListUrl.trim() ? C.t3 : C.ton,
                      fontSize: "11px", fontWeight: 700, cursor: wordListFetching || !wordListUrl.trim() ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "5px",
                      transition: "all 100ms ease", ...FONT,
                    }}>
                      {wordListFetching ? <><Spinner size={10} />Loading…</> : "Load"}
                    </button>
                  </div>
                  {wordListError && <div style={{ fontSize: "11px", color: "#f04040", marginTop: "6px", ...FONT }}>✕ {wordListError}</div>}
                  {wordListInfo && !wordListError && <div style={{ fontSize: "11px", color: "#35c96b", marginTop: "6px", ...FONT }}>{wordListInfo}</div>}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
                <button onClick={handleNextPage} disabled={!allWordsRef.current.length} style={{
                  background: allWordsRef.current.length ? C.t0 : "rgba(240,240,242,0.05)",
                  color: allWordsRef.current.length ? C.bg0 : C.t3,
                  border: "none", borderRadius: "2px", padding: "9px 20px",
                  fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em",
                  cursor: allWordsRef.current.length ? "pointer" : "not-allowed",
                  transition: "background 120ms ease", ...FONT,
                }}
                  onMouseEnter={e => { if (allWordsRef.current.length) (e.currentTarget as HTMLButtonElement).style.background = "rgba(240,240,242,0.85)"; }}
                  onMouseLeave={e => { if (allWordsRef.current.length) (e.currentTarget as HTMLButtonElement).style.background = C.t0; }}
                >
                  {parserList.length === 0 ? "Show first 100" : "Next 100"}
                </button>
                {allWordsRef.current.length > 0 && (
                  <span style={{ fontSize: "11px", color: C.t2, ...FONT }}>
                    remaining <span style={{ color: remainingWords === 0 ? "#f04040" : C.t0, fontWeight: 700 }}>{remainingWords}</span> of {allWordsRef.current.length}
                  </span>
                )}
                {!allWordsRef.current.length && (
                  <span style={{ fontSize: "10px", color: C.t3, ...FONT }}>load a word list first</span>
                )}
              </div>

              {parserList.length > 0 && (
                <div style={{ animation: "fadeUp 0.15s ease forwards" }}>
                  <div style={{ background: C.bg1, border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", marginBottom: "10px" }}>
                    <div style={{ background: C.bg2, borderBottom: `0.5px solid ${C.line}`, padding: "7px 13px", fontSize: "10px", color: C.t3, letterSpacing: "0.06em", ...FONT }}>check mode</div>
                    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <SegmentedControl<GenSweepMode> label="Sweep" value={parserSweepMode}
                        onChange={v => { setParserSweepMode(v); setParserChecked([]); }}
                        options={[{ k: "off", label: "Exact" }, { k: "alpha-suffix", label: "word + a–z" }, { k: "alpha-prefix", label: "a–z + word" }, { k: "digit-suffix", label: "word + 0–9" }]}
                      />
                      {parserSweepMode !== "off" && (
                        <div style={{ fontSize: "10px", color: C.t2, ...FONT }}>
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
                      ...ghostBtn(),
                      background: parserChecking ? "transparent" : C.tonDim,
                      borderColor: parserChecking ? C.line : "rgba(0,152,234,0.3)",
                      color: parserChecking ? C.t2 : C.ton,
                      cursor: parserChecking ? "not-allowed" : "pointer",
                    }}>
                      {parserChecking ? <><Spinner size={10} />Checking…</> : "Check availability"}
                    </button>
                    <span style={{ fontSize: "11px", color: C.t2, display: "flex", alignItems: "center", marginLeft: "4px", ...FONT }}>
                      {parserList.length} words
                    </span>
                  </div>
                  {renderControlBar(parserProgress, resumeParser)}
                  {parserChecked.length > 0 ? (
                    <Results results={parserChecked} sort={parserSort} setSort={setParserSort} />
                  ) : (
                    <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", background: C.bg1 }}>
                      {parserList.map((u, i) => (
                        <div key={u + i} style={{
                          display: "grid", gridTemplateColumns: "28px 1fr 14px",
                          alignItems: "center", padding: "7px 13px", gap: "10px",
                          ...(i < parserList.length - 1 ? ROW_BORDER : {}), transition: "background 100ms ease",
                        }}
                          onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = C.bg3)}
                          onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                        >
                          <Avatar username={u} size={22} />
                          <span style={{ fontSize: "13px", fontWeight: 600, color: C.t0, ...FONT }}>@{u}</span>
                          <ExtLink href={`https://fragment.com/username/${u}`} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {parserList.length === 0 && allWordsRef.current.length === 0 && (
                <div style={{ padding: "40px 16px", textAlign: "center", border: `0.5px solid ${C.line}`, borderRadius: "2px", color: C.t2, fontSize: "12px", background: C.bg1, ...FONT }}>
                  Load a word list from a URL to get started
                </div>
              )}
            </div>
          )}

          {/* ── History ── */}
          {mode === "history" && (
            <div style={{ animation: "fadeUp 0.15s ease forwards" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", color: C.t2, ...FONT }}>Recent checks</span>
                <div style={{ display: "flex", gap: "3px" }}>
                  <button onClick={() => void loadHistory()} style={ghostBtn()}>
                    {histLoad ? <Spinner size={10} /> : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                <div style={{ padding: "40px 16px", textAlign: "center", border: `0.5px solid ${C.line}`, borderRadius: "2px", color: C.t2, fontSize: "12px", background: C.bg1, ...FONT }}>
                  No checks yet.
                </div>
              ) : (
                <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "2px", overflow: "hidden", background: C.bg1 }}>
                  {history.map((item, i) => (
                    <div key={item.id} style={{
                      display: "grid", gridTemplateColumns: "24px 1fr auto 14px",
                      alignItems: "center", padding: "8px 13px", gap: "10px",
                      ...(i < history.length - 1 ? ROW_BORDER : {}), transition: "background 100ms ease",
                    }}
                      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = C.bg3)}
                      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                    >
                      <Avatar username={item.username} size={22} />
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", color: C.t0, ...FONT }}>
                          @{item.username}{item.hasPremium === "true" && <PremiumStar />}
                        </div>
                        <div style={{ fontSize: "10px", color: C.t3, ...FONT }}>{fmtDate(item.checkedAt)}</div>
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
            <span style={{ fontSize: "10px", color: C.t3, ...FONT }}>Unofficial tool · Not affiliated with Telegram or Fragment</span>
            <span style={{ color: C.t3, fontSize: "10px" }}>·</span>
            <a href="https://fragment.com" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "10px", color: C.t2, textDecoration: "none", transition: "color 100ms ease", ...FONT }}
              onMouseEnter={e => (e.currentTarget.style.color = C.t0)}
              onMouseLeave={e => (e.currentTarget.style.color = C.t2)}
            >fragment.com</a>
          </div>
        </footer>
      </div>
    </>
  );
}