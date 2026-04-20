"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const C = {
  bg0: "#0d0d0f", bg1: "#111113", bg2: "#161618", bg3: "#1b1b1e",
  line: "rgba(255,255,255,0.07)", lineHi: "rgba(255,255,255,0.13)",
  t0: "#f0f0f2", t1: "rgba(240,240,242,0.6)",
  t2: "rgba(240,240,242,0.35)", t3: "rgba(240,240,242,0.18)",
  ton: "#0098ea", green: "#35c96b", red: "#f04040", yellow: "#e8a030",
};
const F: React.CSSProperties = { fontFamily: "var(--font-mono)" };

type ApiKey = {
  id: string;
  label: string;
  role: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
};

function fmt(s: string | null) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

function Spinner({ size = 13 }: { size?: number }) {
  return (
    <svg style={{ animation: "spin 0.7s linear infinite" }} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(240,240,242,0.15)" strokeWidth="2.5" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="rgba(240,240,242,0.8)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Badge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "2px 7px", borderRadius: "2px", fontSize: "10px", fontWeight: 700,
      background: active ? "rgba(53,201,107,0.1)" : "rgba(240,64,64,0.09)",
      border: `0.5px solid ${active ? "rgba(53,201,107,0.3)" : "rgba(240,64,64,0.28)"}`,
      color: active ? C.green : C.red, ...F,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: active ? C.green : C.red }} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span style={{
      padding: "2px 7px", borderRadius: "2px", fontSize: "10px", fontWeight: 700,
      background: isAdmin ? "rgba(0,152,234,0.1)" : "rgba(120,120,136,0.1)",
      border: `0.5px solid ${isAdmin ? "rgba(0,152,234,0.3)" : "rgba(120,120,136,0.22)"}`,
      color: isAdmin ? C.ton : C.t2, ...F,
    }}>
      {role}
    </span>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={{
        background: C.bg2, border: `0.5px solid ${focused ? C.lineHi : C.line}`,
        borderRadius: "2px", padding: "8px 10px", color: C.t0,
        fontSize: "12px", outline: "none", width: "100%",
        transition: "border-color 120ms ease", ...F,
      }}
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { k: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      background: C.bg2, border: `0.5px solid ${C.line}`, borderRadius: "2px",
      padding: "8px 10px", color: C.t0, fontSize: "12px", outline: "none",
      width: "100%", cursor: "pointer", ...F,
    }}>
      {options.map(o => <option key={o.k} value={o.k}>{o.label}</option>)}
    </select>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Create form
  const [label, setLabel] = useState("");
  const [rawKey, setRawKey] = useState("");
  const [role, setRole] = useState("user");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/keys");
      if (res.status === 403) { router.push("/"); return; }
      if (res.status === 401) { router.push("/login"); return; }
      const data = (await res.json()) as { keys?: ApiKey[]; error?: string };
      if (data.error) { setError(data.error); return; }
      setKeys(data.keys ?? []);
    } catch { setError("Failed to load keys"); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (id: string, is_active: boolean) => {
    await fetch("/api/admin/keys", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active }),
    });
    setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active } : k));
  };

  const del = async (id: string) => {
    if (deleteConfirm !== id) { setDeleteConfirm(id); setTimeout(() => setDeleteConfirm(null), 3000); return; }
    await fetch(`/api/admin/keys?id=${id}`, { method: "DELETE" });
    setKeys(prev => prev.filter(k => k.id !== id));
    setDeleteConfirm(null);
  };

  const generate = () => {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    setRawKey(Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32));
  };

  const create = async () => {
    if (!label.trim() || !rawKey.trim()) { setCreateError("Label and key are required"); return; }
    setCreating(true); setCreateError(null); setCreateOk(false);
    try {
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), rawKey: rawKey.trim(), role, expiresAt: expiresAt || undefined }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) { setCreateError(data.error ?? "Failed"); return; }
      setCreateOk(true);
      setLabel(""); setRawKey(""); setRole("user"); setExpiresAt("");
      void load();
      setTimeout(() => setCreateOk(false), 2000);
    } catch { setCreateError("Network error"); }
    finally { setCreating(false); }
  };

  const sectionTitle = (t: string) => (
    <div style={{ fontSize: "9px", fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px", ...F }}>{t}</div>
  );

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        ::selection { background: rgba(0,152,234,0.15); color: #f0f0f2; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.13); }
        input::placeholder, textarea::placeholder { color: rgba(240,240,242,0.25); }
        select option { background: #161618; }
      `}</style>

      <div style={{ minHeight: "100vh", background: C.bg0, color: C.t0, ...F }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 24px 80px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px", paddingBottom: "20px", borderBottom: `0.5px solid ${C.line}` }}>
            <div>
              <h1 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em", color: C.t0, ...F }}>
                Admin Panel
              </h1>
              <p style={{ fontSize: "11px", color: C.t2, margin: 0, ...F }}>API key management</p>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <a href="/" style={{
                padding: "6px 12px", background: "transparent",
                border: `0.5px solid ${C.line}`, borderRadius: "2px",
                color: C.t2, fontSize: "11px", textDecoration: "none",
                transition: "all 100ms ease", ...F,
              }}
                onMouseEnter={e => { e.currentTarget.style.color = C.t0; e.currentTarget.style.borderColor = C.lineHi; }}
                onMouseLeave={e => { e.currentTarget.style.color = C.t2; e.currentTarget.style.borderColor = C.line; }}
              >
                ← Back to tool
              </a>
            </div>
          </div>

          {/* Create key form */}
          <div style={{ background: C.bg1, border: `0.5px solid ${C.line}`, borderRadius: "4px", overflow: "hidden", marginBottom: "24px" }}>
            <div style={{ background: C.bg2, borderBottom: `0.5px solid ${C.line}`, padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px" }}>
              {["#f04040", "#e8a030", "#35c96b"].map(c => (
                <div key={c} style={{ width: 7, height: 7, borderRadius: "50%", background: c, opacity: 0.7 }} />
              ))}
              <span style={{ fontSize: "10px", color: C.t3, marginLeft: "6px", letterSpacing: "0.06em", ...F }}>new api key</span>
            </div>

            <div style={{ padding: "18px" }}>
              {sectionTitle("Create new key")}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <div style={{ fontSize: "10px", color: C.t2, marginBottom: "5px", letterSpacing: "0.06em", textTransform: "uppercase", ...F }}>Label</div>
                  <Input value={label} onChange={setLabel} placeholder="e.g. johndoe" />
                </div>
                <div>
                  <div style={{ fontSize: "10px", color: C.t2, marginBottom: "5px", letterSpacing: "0.06em", textTransform: "uppercase", ...F }}>Role</div>
                  <Select value={role} onChange={setRole} options={[{ k: "user", label: "user" }, { k: "admin", label: "admin" }]} />
                </div>
              </div>

              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", color: C.t2, marginBottom: "5px", letterSpacing: "0.06em", textTransform: "uppercase", ...F }}>API Key (raw value)</div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <div style={{ flex: 1 }}>
                    <Input value={rawKey} onChange={setRawKey} placeholder="min 8 characters" />
                  </div>
                  <button onClick={generate} style={{
                    padding: "0 12px", background: C.bg3,
                    border: `0.5px solid ${C.lineHi}`, borderRadius: "2px",
                    color: C.t1, fontSize: "11px", cursor: "pointer",
                    whiteSpace: "nowrap", transition: "all 100ms ease", ...F,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = C.t0; }}
                    onMouseLeave={e => { e.currentTarget.style.color = C.t1; }}
                  >
                    Generate
                  </button>
                </div>
                {rawKey && (
                  <div style={{ fontSize: "10px", color: C.t3, marginTop: "4px", ...F }}>
                    ⚠ Save this key — it won't be shown again after creation
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "10px", color: C.t2, marginBottom: "5px", letterSpacing: "0.06em", textTransform: "uppercase", ...F }}>Expires at (optional)</div>
                <Input value={expiresAt} onChange={setExpiresAt} type="datetime-local" />
              </div>

              {createError && (
                <div style={{ padding: "7px 10px", background: "rgba(240,64,64,0.07)", border: "0.5px solid rgba(240,64,64,0.28)", borderRadius: "2px", color: C.red, fontSize: "11px", marginBottom: "10px", ...F }}>
                  ✕ {createError}
                </div>
              )}
              {createOk && (
                <div style={{ padding: "7px 10px", background: "rgba(53,201,107,0.07)", border: "0.5px solid rgba(53,201,107,0.28)", borderRadius: "2px", color: C.green, fontSize: "11px", marginBottom: "10px", ...F }}>
                  ✓ Key created successfully
                </div>
              )}

              <button onClick={() => void create()} disabled={creating || !label.trim() || !rawKey.trim()} style={{
                padding: "9px 18px", background: creating || !label.trim() || !rawKey.trim() ? "rgba(240,240,242,0.05)" : C.t0,
                color: creating || !label.trim() || !rawKey.trim() ? C.t3 : C.bg0,
                border: "none", borderRadius: "2px", fontSize: "12px", fontWeight: 700,
                letterSpacing: "0.05em", cursor: creating || !label.trim() || !rawKey.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "7px",
                transition: "background 120ms ease", ...F,
              }}
                onMouseEnter={e => { if (!creating && label.trim() && rawKey.trim()) (e.currentTarget as HTMLButtonElement).style.background = "rgba(240,240,242,0.87)"; }}
                onMouseLeave={e => { if (!creating && label.trim() && rawKey.trim()) (e.currentTarget as HTMLButtonElement).style.background = C.t0; }}
              >
                {creating ? <><Spinner size={11} />Creating…</> : "Create key"}
              </button>
            </div>
          </div>

          {/* Keys list */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              {sectionTitle(`All keys (${keys.length})`)}
              <button onClick={() => void load()} style={{
                background: "transparent", border: `0.5px solid ${C.line}`, borderRadius: "2px",
                padding: "3px 10px", color: C.t2, fontSize: "11px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "5px", marginBottom: "10px", ...F,
              }}>
                {loading ? <Spinner size={10} /> : "↻"} Refresh
              </button>
            </div>

            {error && (
              <div style={{ padding: "10px 12px", background: "rgba(240,64,64,0.07)", border: "0.5px solid rgba(240,64,64,0.28)", borderRadius: "2px", color: C.red, fontSize: "12px", marginBottom: "12px", ...F }}>
                ✕ {error}
              </div>
            )}

            {loading && !keys.length ? (
              <div style={{ padding: "40px", textAlign: "center", color: C.t2, fontSize: "12px", border: `0.5px solid ${C.line}`, borderRadius: "2px", background: C.bg1, ...F }}>
                <Spinner size={16} />
              </div>
            ) : keys.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: C.t2, fontSize: "12px", border: `0.5px solid ${C.line}`, borderRadius: "2px", background: C.bg1, ...F }}>
                No keys yet
              </div>
            ) : (
              <div style={{ border: `0.5px solid ${C.line}`, borderRadius: "4px", overflow: "hidden", background: C.bg1, animation: "fadeUp 0.15s ease forwards" }}>
                {/* Table header */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 70px 80px 130px 130px 120px",
                  padding: "7px 14px", background: C.bg2,
                  borderBottom: `0.5px solid ${C.line}`,
                  fontSize: "9px", color: C.t3, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.08em", ...F,
                }}>
                  <span>Label</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span>Created</span>
                  <span>Last used</span>
                  <span style={{ textAlign: "right" }}>Actions</span>
                </div>

                {keys.map((k, i) => (
                  <div key={k.id} style={{
                    display: "grid", gridTemplateColumns: "1fr 70px 80px 130px 130px 120px",
                    alignItems: "center", padding: "10px 14px", gap: "8px",
                    borderBottom: i < keys.length - 1 ? `0.5px solid ${C.line}` : "none",
                    transition: "background 100ms ease",
                  }}
                    onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = C.bg3)}
                    onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: C.t0, ...F }}>{k.label}</div>
                      {k.expires_at && (
                        <div style={{ fontSize: "10px", color: C.yellow, marginTop: "2px", ...F }}>
                          expires {fmt(k.expires_at)}
                        </div>
                      )}
                    </div>
                    <RoleBadge role={k.role} />
                    <Badge active={k.is_active} />
                    <span style={{ fontSize: "11px", color: C.t2, ...F }}>{fmt(k.created_at)}</span>
                    <span style={{ fontSize: "11px", color: C.t2, ...F }}>{fmt(k.last_used_at)}</span>
                    <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                      <button onClick={() => void toggle(k.id, !k.is_active)} style={{
                        padding: "3px 8px", background: "transparent",
                        border: `0.5px solid ${C.line}`, borderRadius: "2px",
                        color: k.is_active ? C.yellow : C.green,
                        fontSize: "10px", fontWeight: 600, cursor: "pointer",
                        transition: "all 100ms ease", ...F,
                      }}>
                        {k.is_active ? "Disable" : "Enable"}
                      </button>
                      <button onClick={() => void del(k.id)} style={{
                        padding: "3px 8px",
                        background: deleteConfirm === k.id ? "rgba(240,64,64,0.08)" : "transparent",
                        border: `0.5px solid ${deleteConfirm === k.id ? "rgba(240,64,64,0.35)" : C.line}`,
                        borderRadius: "2px",
                        color: deleteConfirm === k.id ? C.red : C.t2,
                        fontSize: "10px", fontWeight: 600, cursor: "pointer",
                        transition: "all 100ms ease", ...F,
                      }}>
                        {deleteConfirm === k.id ? "Sure?" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}