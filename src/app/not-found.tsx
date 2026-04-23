"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const C = {
  bg0: "#0d0d0f", bg1: "#111113", bg2: "#161618",
  line: "rgba(255,255,255,0.07)", lineHi: "rgba(255,255,255,0.13)",
  t0: "#f0f0f2", t1: "rgba(240,240,242,0.6)",
  t2: "rgba(240,240,242,0.35)", t3: "rgba(240,240,242,0.18)",
  ton: "#0098ea", tonDim: "rgba(0,152,234,0.15)",
} as const;

const F: React.CSSProperties = { fontFamily: "var(--font-mono)" };

export default function NotFound() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (countdown <= 0) { router.push("/"); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, router]);

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: ${C.bg0}; }
        ::selection { background: ${C.tonDim}; color: ${C.t0}; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${C.lineHi}; }
      `}</style>

      <div style={{
        minHeight: "100vh", background: C.bg0, color: C.t0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px", position: "relative", overflow: "hidden", ...F,
      }}>
        {/* Grid background */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
          backgroundSize: "40px 40px", opacity: 0.4,
        }} />

        {/* Subtle glow */}
        <div style={{
          position: "absolute", top: "40%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "400px", height: "300px",
          background: "radial-gradient(ellipse at center, rgba(0,152,234,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{
          position: "relative", maxWidth: "420px", width: "100%", textAlign: "center",
          animation: mounted ? "fadeUp 0.3s ease forwards" : "none",
          opacity: mounted ? 1 : 0,
        }}>
          {/* 404 display */}
          <div style={{
            fontSize: "72px", fontWeight: 700, letterSpacing: "-0.04em",
            color: C.t3, lineHeight: 1, marginBottom: "20px",
            userSelect: "none", ...F,
          }}>
            404
          </div>

          {/* Card */}
          <div style={{
            background: C.bg1, border: `0.5px solid ${C.line}`,
            borderRadius: "4px", overflow: "hidden", marginBottom: "20px",
          }}>
            {/* Traffic lights bar */}
            <div style={{
              background: C.bg2, borderBottom: `0.5px solid ${C.line}`,
              padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px",
            }}>
              {(["#f04040", "#e8a030", "#35c96b"] as const).map(c => (
                <div key={c} style={{ width: 7, height: 7, borderRadius: "50%", background: c, opacity: 0.7 }} />
              ))}
              <span style={{ fontSize: "10px", color: C.t3, marginLeft: "6px", letterSpacing: "0.06em", ...F }}>
                404 · page not found
              </span>
            </div>

            <div style={{ padding: "28px 24px" }}>
              {/* Icon */}
              <div style={{ marginBottom: "16px", display: "flex", justifyContent: "center" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "4px",
                  background: "rgba(240,64,64,0.07)", border: "0.5px solid rgba(240,64,64,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(240,64,64,0.7)" strokeWidth="1.5" />
                    <path d="M12 7v6M12 17h.01" stroke="rgba(240,64,64,0.9)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              <h1 style={{ fontSize: "15px", fontWeight: 700, color: C.t0, margin: "0 0 8px", letterSpacing: "-0.01em", ...F }}>
                Page not found
              </h1>
              <p style={{ fontSize: "12px", color: C.t2, margin: "0 0 24px", lineHeight: 1.6, ...F }}>
                This page doesn&apos;t exist. You&apos;ll be redirected to the main page in{" "}
                <span style={{ color: C.t0, fontWeight: 700, animation: "pulse 1s ease-in-out infinite" }}>
                  {countdown}s
                </span>
              </p>

              {/* Progress bar for countdown */}
              <div style={{ height: "2px", background: C.bg2, borderRadius: "1px", overflow: "hidden", marginBottom: "20px" }}>
                <div style={{
                  height: "100%", background: C.ton, borderRadius: "1px",
                  width: `${(countdown / 5) * 100}%`,
                  transition: "width 1s linear",
                }} />
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                <button
                  onClick={() => router.push("/")}
                  style={{
                    padding: "9px 20px", background: C.t0, color: C.bg0,
                    border: "none", borderRadius: "2px", fontSize: "12px",
                    fontWeight: 700, letterSpacing: "0.05em", cursor: "pointer",
                    transition: "background 120ms ease", ...F,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(240,240,242,0.85)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.t0; }}
                >
                  Go home now
                </button>
                <button
                  onClick={() => router.back()}
                  style={{
                    padding: "9px 20px", background: "transparent",
                    border: `0.5px solid ${C.line}`, borderRadius: "2px",
                    color: C.t2, fontSize: "12px", fontWeight: 600,
                    cursor: "pointer", transition: "all 120ms ease", ...F,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.t0; (e.currentTarget as HTMLButtonElement).style.borderColor = C.lineHi; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.t2; (e.currentTarget as HTMLButtonElement).style.borderColor = C.line; }}
                >
                  Go back
                </button>
              </div>
            </div>
          </div>

          <p style={{ fontSize: "10px", color: C.t3, margin: 0, ...F }}>
            Unofficial tool · Not affiliated with Telegram or Fragment
          </p>
        </div>
      </div>
    </>
  );
}