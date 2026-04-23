"use client";

import { useState } from "react";
import { C, FONT, STATUS_CFG, STATUS_ORDER, FREE_STATUSES, getS, ALPHA, DIGITS, SUFFIX_HOT, PREFIX_HOT } from "@/lib/ui-constants";
import type { CheckResult, Sort, SweepMode } from "@/lib/ui-constants";

// ── Atoms ──────────────────────────────────────────────────────────────────

export function TonLogo({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="28" cy="28" r="28" fill="#0098EA" />
      <path d="M38.82 17H17.18C13.64 17 11.43 20.85 13.2 23.9L26.37 46.59C27.14 47.93 29.07 47.93 29.83 46.59L43 23.9C44.57 20.85 42.36 17 38.82 17ZM25.4 35.46L19.68 25.3H25.4V35.46ZM25.4 23.3H18.03L25.4 19.5V23.3ZM30.6 35.46V25.3H36.32L30.6 35.46ZM30.6 23.3V19.5L37.97 23.3H30.6Z" fill="white" />
    </svg>
  );
}

export function Spinner({ size = 13 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(240,240,242,0.12)" strokeWidth="2.5" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="rgba(240,240,242,0.75)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function PremiumStar() {
  return (
    <svg width="10" height="10" viewBox="0 0 20 20" fill="none" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <path d="M10 1l2.39 4.84 5.35.78-3.87 3.77.91 5.31L10 13.27l-4.78 2.51.91-5.31L2.26 6.62l5.35-.78L10 1z" fill="#E8A030" stroke="#c8830a" strokeWidth="0.5" />
    </svg>
  );
}

export function ExtLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ color: C.t3, textDecoration: "none", flexShrink: 0, transition: "color 120ms ease", display: "flex", alignItems: "center" }}
      onMouseEnter={e => (e.currentTarget.style.color = C.t0)}
      onMouseLeave={e => (e.currentTarget.style.color = C.t3)}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </a>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cfg = getS(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "2px 7px 2px 5px", background: cfg.bg,
      border: `0.5px solid ${cfg.border}`, borderRadius: "2px",
      fontSize: "11px", fontWeight: 600, color: cfg.color,
      letterSpacing: "0.02em", whiteSpace: "nowrap", ...FONT,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%", background: cfg.dot, flexShrink: 0,
        animation: status === "Available" ? "pulse-dot 2s ease-in-out infinite" : "none",
      }} />
      {cfg.label}
    </span>
  );
}

export function Avatar({ username, photo, size = 26 }: { username: string; photo?: string | null; size?: number }) {
  const letter = username[0]?.toUpperCase() ?? "?";
  if (photo) return (
    <img src={photo} alt={username}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `0.5px solid ${C.lineHi}` }}
    />
  );
  const hue = (letter.charCodeAt(0) * 47) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue}, 10%, 18%)`, border: `0.5px solid ${C.lineHi}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.38) + "px", fontWeight: 700,
      color: `hsl(${hue}, 40%, 65%)`, flexShrink: 0, ...FONT,
    }}>{letter}</div>
  );
}

// ── Input primitives ───────────────────────────────────────────────────────

export const TEXT_INPUT: React.CSSProperties = {
  flex: 1, background: "transparent", border: "none", outline: "none",
  color: C.t0, fontSize: "13px", fontWeight: 600, padding: "9px 8px",
  fontFamily: "var(--font-mono)",
};

export function InputRow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      style={{
        display: "flex", alignItems: "center",
        border: `0.5px solid ${focused ? C.lineHi : C.line}`,
        borderRadius: "2px", background: C.bg1,
        transition: "border-color 120ms ease", overflow: "hidden", ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PrimaryBtn({ onClick, disabled, loading, children }: {
  onClick: () => void; disabled: boolean; loading?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? "rgba(240,240,242,0.05)" : C.t0,
      color: disabled ? C.t3 : C.bg0,
      border: "none", borderRadius: "0", padding: "0 16px", height: "100%", minHeight: "38px",
      fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em",
      cursor: disabled ? "not-allowed" : "pointer",
      display: "flex", alignItems: "center", gap: "6px",
      whiteSpace: "nowrap", flexShrink: 0,
      transition: "background 120ms ease, color 120ms ease",
      fontFamily: "var(--font-mono)", borderLeft: `0.5px solid ${C.line}`,
    }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "rgba(240,240,242,0.85)"; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = C.t0; }}
    >
      {loading ? <Spinner size={11} /> : null}{children}
    </button>
  );
}

export function SegmentedControl<T extends string>({ label, options, value, onChange }: {
  label: string; options: { k: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
      <span style={{ fontSize: "10px", color: C.t2, letterSpacing: "0.05em", marginRight: "5px", ...FONT }}>{label}</span>
      {options.map(({ k, label: lbl }) => (
        <button key={k} onClick={() => onChange(k)} style={{
          background: value === k ? C.bg3 : "transparent",
          border: `0.5px solid ${value === k ? C.lineHi : C.line}`,
          borderRadius: "2px", padding: "3px 9px",
          color: value === k ? C.t0 : C.t2,
          fontSize: "11px", fontWeight: value === k ? 700 : 400,
          cursor: "pointer", transition: "all 100ms ease", ...FONT,
        }}>{lbl}</button>
      ))}
    </div>
  );
}

export function ProgressBar({ done, total, label, paused }: {
  done: number; total: number; label?: string; paused?: boolean;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "10px", color: paused ? "#e8a030" : C.t2, display: "flex", alignItems: "center", gap: "5px", ...FONT }}>
          {paused && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e8a030", display: "inline-block" }} />}
          {paused ? "Paused — switch back to resume" : (label ?? "Checking…")}
        </span>
        <span style={{ fontSize: "10px", color: C.t1, fontWeight: 600, ...FONT }}>
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

// ── Result display ─────────────────────────────────────────────────────────

const ROW_BORDER: React.CSSProperties = { borderBottom: `0.5px solid ${C.line}` };

export function ResultRow({ r, last }: { r: CheckResult; last: boolean }) {
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
          <span style={{ fontSize: "13px", fontWeight: 600, color: C.t0, ...FONT }}>@{r.username}</span>
          {r.hasPremium && <PremiumStar />}
        </div>
        {r.name && <div style={{ fontSize: "11px", color: C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...FONT }}>{r.name}</div>}
      </div>
      <StatusPill status={r.status} />
      {r.status !== "Invalid" ? <ExtLink href={`https://fragment.com/username/${r.username}`} /> : <span />}
    </div>
  );
}

export function StatsPills({ results }: { results: CheckResult[] }) {
  const counts = STATUS_ORDER
    .map(s => ({ s, n: results.filter(r => r.status === s).length }))
    .filter(x => x.n > 0);
  if (!counts.length) return null;
  return (
    <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", marginBottom: "10px" }}>
      {counts.map(({ s, n }) => {
        const cfg = getS(s);
        return (
          <div key={s} style={{ padding: "2px 8px", background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: "2px", display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "10px", color: cfg.color, fontWeight: 600, letterSpacing: "0.04em", ...FONT }}>{cfg.label}</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: C.t0, ...FONT }}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SortBar({ sort, setSort, results }: { sort: Sort; setSort: (s: Sort) => void; results: CheckResult[] }) {
  const opts: { k: Sort; label: string }[] = [
    { k: "none", label: "Default" }, { k: "az", label: "A → Z" },
    { k: "za", label: "Z → A" }, { k: "group", label: "Group" },
  ];
  const freeCount = results.filter(r => FREE_STATUSES.has(r.status)).length;
  return (
    <div style={{ display: "flex", gap: "2px", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
        <span style={{ fontSize: "10px", color: C.t2, marginRight: "4px", letterSpacing: "0.06em", ...FONT }}>Sort</span>
        {opts.map(({ k, label }) => (
          <button key={k} onClick={() => setSort(k)} style={{
            background: sort === k ? C.bg3 : "transparent",
            border: `0.5px solid ${sort === k ? C.lineHi : C.line}`,
            borderRadius: "2px", padding: "2px 8px",
            color: sort === k ? C.t0 : C.t2,
            fontSize: "11px", fontWeight: sort === k ? 700 : 400,
            cursor: "pointer", transition: "all 100ms ease", ...FONT,
          }}>{label}</button>
        ))}
      </div>
      {freeCount > 0 && (
        <button
          onClick={() => {
            const lines = results.filter(r => FREE_STATUSES.has(r.status)).map(r => r.username);
            const a = Object.assign(document.createElement("a"), {
              href: URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" })),
              download: "free_usernames.txt",
            });
            a.click(); URL.revokeObjectURL(a.href);
          }}
          style={{
            display: "flex", alignItems: "center", gap: "5px",
            background: "rgba(53,201,107,0.08)", border: "0.5px solid rgba(53,201,107,0.28)",
            borderRadius: "2px", padding: "3px 10px", color: "#35c96b",
            fontSize: "11px", fontWeight: 600, cursor: "pointer", transition: "all 100ms ease", ...FONT,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(53,201,107,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(53,201,107,0.08)"; }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {freeCount} free
        </button>
      )}
    </div>
  );
}

function GroupHeader({ status, count }: { status: string; count: number }) {
  const cfg = getS(status);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
      <span style={{ fontSize: "9px", fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.1em", ...FONT }}>{cfg.label}</span>
      <span style={{ fontSize: "10px", color: C.t2, ...FONT }}>{count}</span>
      <div style={{ flex: 1, height: "0.5px", background: C.line }} />
    </div>
  );
}

export function Results({ results, sort, setSort }: { results: CheckResult[]; sort: Sort; setSort: (s: Sort) => void }) {
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
    const known = new Set(STATUS_ORDER as readonly string[]);
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

export function SweepVariantGrid({ base, mode, results }: { base: string; mode: SweepMode; results: CheckResult[] }) {
  const chars = mode === "digit-suffix" ? DIGITS : ALPHA;
  const hotSet = mode === "alpha-prefix" ? PREFIX_HOT : SUFFIX_HOT;
  const byUsername = new Map(results.map(r => [r.username, r]));
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ fontSize: "9px", fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px", ...FONT }}>
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
              <span style={{ fontSize: "12px", fontWeight: 700, color: cfg ? cfg.color : C.t2, ...FONT }}>{c}</span>
              <span style={{ fontSize: "9px", color: cfg ? cfg.color : C.t3, opacity: 0.8, marginTop: "1px", ...FONT }}>
                {r ? (FREE_STATUSES.has(r.status) ? "free" : r.status.slice(0, 4)) : "···"}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ── Ghost button helper ────────────────────────────────────────────────────

export function ghostBtn(danger = false, active = false): React.CSSProperties {
  return {
    background: active ? (danger ? "rgba(240,64,64,0.08)" : C.bg3) : "transparent",
    border: `0.5px solid ${active ? (danger ? "rgba(240,64,64,0.35)" : C.lineHi) : C.line}`,
    borderRadius: "2px", padding: "4px 10px",
    color: active ? (danger ? "#f04040" : C.t0) : C.t2,
    fontSize: "11px", fontWeight: 600, cursor: "pointer",
    display: "flex", alignItems: "center", gap: "5px",
    transition: "all 100ms ease", ...FONT,
  };
}