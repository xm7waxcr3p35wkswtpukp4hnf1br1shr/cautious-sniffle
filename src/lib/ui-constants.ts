// ── Types ──────────────────────────────────────────────────────────────────

export type CheckResult = {
  username: string;
  status: "Available" | "Taken" | "For Sale" | "Sold" | "Reserved" | "Unknown" | "Invalid" | string;
  name?: string | null;
  photo?: string | null;
  hasPremium?: boolean | null;
  source?: string;
  error?: boolean;
};

export type HistoryItem = {
  id: string;
  username: string;
  status: string;
  name?: string | null;
  photo?: string | null;
  hasPremium?: string | null;
  checkedAt: string;
};

export type Sort = "none" | "az" | "za" | "group";
export type SweepMode = "alpha-suffix" | "alpha-prefix" | "digit-suffix";
export type GenSweepMode = "off" | "alpha-suffix" | "alpha-prefix" | "digit-suffix";

// ── Design tokens ──────────────────────────────────────────────────────────

export const C = {
  bg0: "#0d0d0f", bg1: "#111113", bg2: "#161618", bg3: "#1b1b1e",
  line: "rgba(255,255,255,0.07)", lineHi: "rgba(255,255,255,0.13)",
  t0: "#f0f0f2", t1: "rgba(240,240,242,0.6)",
  t2: "rgba(240,240,242,0.35)", t3: "rgba(240,240,242,0.18)",
  ton: "#0098ea", tonDim: "rgba(0,152,234,0.15)",
} as const;

export const FONT: React.CSSProperties = { fontFamily: "var(--font-mono)" };

// ── Status config ──────────────────────────────────────────────────────────

export const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  Available:  { label: "Available", color: "#35c96b", bg: "rgba(53,201,107,0.10)",  border: "rgba(53,201,107,0.28)",  dot: "#35c96b" },
  Taken:      { label: "Taken",     color: "#f04040", bg: "rgba(240,64,64,0.09)",   border: "rgba(240,64,64,0.26)",   dot: "#FF4900" },
  "For Sale": { label: "For Sale",  color: "#c07aff", bg: "rgba(165,61,231,0.10)",  border: "rgba(165,61,231,0.28)",  dot: "#c07aff" },
  Sold:       { label: "Sold",      color: "#7a7a88", bg: "rgba(120,120,136,0.10)", border: "rgba(120,120,136,0.22)", dot: "#7a7a88" },
  Reserved:   { label: "Reserved",  color: "#6b8cff", bg: "rgba(107,140,255,0.09)", border: "rgba(107,140,255,0.24)", dot: "#6b8cff" },
  Invalid:    { label: "Invalid",   color: "#f04040", bg: "rgba(240,64,64,0.09)",   border: "rgba(240,64,64,0.26)",   dot: "#FF4900" },
  Unknown:    { label: "Unknown",   color: "#7a7a88", bg: "rgba(120,120,136,0.10)", border: "rgba(120,120,136,0.22)", dot: "#7a7a88" },
};

export const STATUS_ORDER = ["Available", "For Sale", "Reserved", "Sold", "Taken", "Unknown", "Invalid"] as const;

export const FREE_STATUSES = new Set(["Available"]);

export const getS = (s: string) =>
  STATUS_CFG[s] ?? { label: s, color: "#7a7a88", bg: "rgba(120,120,136,0.10)", border: "rgba(120,120,136,0.22)", dot: "#7a7a88" };

// ── Constants ──────────────────────────────────────────────────────────────

export const ALPHA  = "abcdefghijklmnopqrstuvwxyz".split("");
export const DIGITS = "0123456789".split("");
export const SUFFIX_HOT = new Set(["s", "x", "z", "y", "0", "1", "2", "3"]);
export const PREFIX_HOT = new Set(["i", "e", "o", "a", "m", "t"]);
export const PAGE_SIZE = 100;
export const API_CHUNK = 100;

// ── Utilities ──────────────────────────────────────────────────────────────

export function getOrCreateUserId(): string {
  try {
    const key = "username_tool_uid";
    let uid = localStorage.getItem(key);
    if (!uid) { uid = crypto.randomUUID(); localStorage.setItem(key, uid); }
    return uid;
  } catch { return "anonymous"; }
}

export function buildSweepCandidates(base: string, mode: SweepMode): string[] {
  const chars = mode === "digit-suffix" ? DIGITS : ALPHA;
  return [base, ...chars.map(c => mode === "alpha-prefix" ? `${c}${base}` : `${base}${c}`)];
}

export function fmtDate(s: string): string {
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

export function downloadAvailable(results: CheckResult[], filename = "available_usernames.txt"): boolean {
  const lines = results.filter(r => FREE_STATUSES.has(r.status)).map(r => r.username);
  if (!lines.length) return false;
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" })),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}