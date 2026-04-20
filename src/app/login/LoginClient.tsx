"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const C = {
  bg0:    "#0d0d0f",
  bg1:    "#111113",
  bg2:    "#161618",
  bg3:    "#1b1b1e",
  line:   "rgba(255,255,255,0.07)",
  lineHi: "rgba(255,255,255,0.13)",
  t0:     "#f0f0f2",
  t1:     "rgba(240,240,242,0.6)",
  t2:     "rgba(240,240,242,0.35)",
  t3:     "rgba(240,240,242,0.18)",
  ton:    "#0098ea",
  tonDim: "rgba(0,152,234,0.15)",
  green:  "#35c96b",
  red:    "#f04040",
};

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

function TonLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="28" fill="#0098EA" />
      <path
        d="M38.82 17H17.18C13.64 17 11.43 20.85 13.2 23.9L26.37 46.59C27.14 47.93 29.07 47.93 29.83 46.59L43 23.9C44.57 20.85 42.36 17 38.82 17ZM25.4 35.46L19.68 25.3H25.4V35.46ZM25.4 23.3H18.03L25.4 19.5V23.3ZM30.6 35.46V25.3H36.32L30.6 35.46ZM30.6 23.3V19.5L37.97 23.3H30.6Z"
        fill="white"
      />
    </svg>
  );
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      style={{ animation: "spin 0.7s linear infinite" }}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="rgba(240,240,242,0.15)" strokeWidth="2.5" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="rgba(240,240,242,0.8)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";

  const [apiKey, setApiKey]   = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleLogin = async () => {
    const key = apiKey.trim();
    if (!key || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Authentication failed");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => { router.push(from); router.refresh(); }, 600);
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: ${C.bg0}; }
        input::placeholder { color: ${C.t2}; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${C.lineHi}; }
        ::selection { background: ${C.tonDim}; color: ${C.t0}; }
        :focus-visible { outline: 1px solid ${C.ton}; outline-offset: 2px; }
      `}</style>

      <div style={{
        minHeight: "100vh", background: C.bg0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px", fontFamily: "var(--font-mono)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
          backgroundSize: "40px 40px", opacity: 0.5, pointerEvents: "none",
        }} />
        {/* Glow */}
        <div style={{
          position: "absolute", top: "30%", left: "50%",
          transform: "translate(-50%, -50%)", width: "500px", height: "300px",
          background: "radial-gradient(ellipse at center, rgba(0,152,234,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{
          position: "relative", width: "100%", maxWidth: "380px",
          animation: mounted ? "fadeUp 0.25s ease forwards" : "none",
          opacity: mounted ? 1 : 0,
        }}>
          {/* Header */}
          <div style={{ marginBottom: "28px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <div style={{
                width: 44, height: 44, borderRadius: "4px",
                background: C.bg2, border: `0.5px solid ${C.lineHi}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <TonLogo size={22} />
              </div>
            </div>
            <h1 style={{ fontSize: "18px", fontWeight: 700, color: C.t0, margin: "0 0 6px", letterSpacing: "-0.01em", ...MONO }}>
              Username Tool
            </h1>
            <p style={{ fontSize: "11px", color: C.t2, margin: 0, letterSpacing: "0.03em", ...MONO }}>
              Enter your API key to continue
            </p>
          </div>

          {/* Card */}
          <div style={{ background: C.bg1, border: `0.5px solid ${C.line}`, borderRadius: "4px", overflow: "hidden" }}>
            {/* Top bar */}
            <div style={{
              background: C.bg2, borderBottom: `0.5px solid ${C.line}`,
              padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px",
            }}>
              {["#f04040","#e8a030","#35c96b"].map(c => (
                <div key={c} style={{ width: 7, height: 7, borderRadius: "50%", background: c, opacity: 0.7 }} />
              ))}
              <span style={{ fontSize: "10px", color: C.t3, marginLeft: "6px", letterSpacing: "0.06em", ...MONO }}>
                auth · api key
              </span>
            </div>

            <div style={{ padding: "20px 18px 18px" }}>
              {error && (
                <div style={{
                  padding: "8px 11px", background: "rgba(240,64,64,0.07)",
                  border: "0.5px solid rgba(240,64,64,0.28)", borderRadius: "2px",
                  color: C.red, fontSize: "11px", marginBottom: "14px",
                  display: "flex", gap: "7px", alignItems: "flex-start",
                  animation: "fadeUp 0.15s ease forwards", ...MONO,
                }}>
                  <span style={{ flexShrink: 0 }}>✕</span>
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div style={{
                  padding: "8px 11px", background: "rgba(53,201,107,0.07)",
                  border: "0.5px solid rgba(53,201,107,0.28)", borderRadius: "2px",
                  color: C.green, fontSize: "11px", marginBottom: "14px",
                  display: "flex", gap: "7px", alignItems: "center",
                  animation: "fadeUp 0.15s ease forwards", ...MONO,
                }}>
                  <span>✓</span><span>Authenticated · redirecting…</span>
                </div>
              )}

              <label style={{
                display: "block", fontSize: "10px", color: C.t2,
                letterSpacing: "0.08em", marginBottom: "6px",
                textTransform: "uppercase", ...MONO,
              }}>
                API Key
              </label>

              <div style={{
                display: "flex", alignItems: "center",
                background: C.bg2,
                border: `0.5px solid ${focused ? C.lineHi : C.line}`,
                borderRadius: "2px", overflow: "hidden",
                transition: "border-color 120ms ease", marginBottom: "12px",
              }}>
                <div style={{ padding: "0 0 0 12px", color: C.t2, flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setError(null); }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={e => { if (e.key === "Enter") void handleLogin(); }}
                  placeholder="sk-••••••••••••••••••••••••••••••••"
                  autoComplete="current-password"
                  spellCheck={false}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    color: C.t0, fontSize: "13px", padding: "10px 10px", ...MONO,
                    letterSpacing: showKey ? "normal" : "0.05em",
                  }}
                />
                <button
                  onClick={() => setShowKey(v => !v)}
                  style={{
                    background: "transparent", border: "none",
                    borderLeft: `0.5px solid ${C.line}`,
                    padding: "0 12px", height: "100%", minHeight: "40px",
                    color: C.t2, cursor: "pointer",
                    display: "flex", alignItems: "center",
                    transition: "color 100ms ease", flexShrink: 0,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.t0)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.t2)}
                >
                  {showKey ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  )}
                </button>
              </div>

              <button
                onClick={() => void handleLogin()}
                disabled={loading || !apiKey.trim() || success}
                style={{
                  width: "100%", padding: "11px",
                  background: loading || !apiKey.trim() || success ? "rgba(240,240,242,0.06)" : C.t0,
                  color: loading || !apiKey.trim() || success ? C.t3 : C.bg0,
                  border: "none", borderRadius: "2px",
                  fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em",
                  cursor: loading || !apiKey.trim() || success ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  transition: "background 120ms ease, color 120ms ease", ...MONO,
                }}
                onMouseEnter={e => { if (!loading && apiKey.trim() && !success) (e.currentTarget as HTMLButtonElement).style.background = "rgba(240,240,242,0.87)"; }}
                onMouseLeave={e => { if (!loading && apiKey.trim() && !success) (e.currentTarget as HTMLButtonElement).style.background = C.t0; }}
              >
                {loading ? <><Spinner size={12} />Verifying…</> : success ? "✓ Authenticated" : "Sign in"}
              </button>
            </div>

            <div style={{ padding: "8px 18px 10px", borderTop: `0.5px solid ${C.line}`, background: C.bg2 }}>
              <p style={{ fontSize: "10px", color: C.t3, margin: 0, ...MONO }}>
                Keys are stored in Supabase · contact admin for access
              </p>
            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: "10px", color: C.t3, marginTop: "18px", ...MONO }}>
            Unofficial tool · Not affiliated with Telegram or Fragment
          </p>
        </div>
      </div>
    </>
  );
}
