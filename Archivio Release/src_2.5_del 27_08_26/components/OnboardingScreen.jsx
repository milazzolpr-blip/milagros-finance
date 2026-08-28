import React, { useState } from "react";
import { Home, Ticket } from "lucide-react";
import { C } from "../theme";
import { supabase } from "../lib/supabase";

const SCOPI = [
  { key: "famiglia", label: "Famiglia" },
  { key: "business", label: "Attività / lavoro" },
  { key: "gruppo", label: "Gruppo" },
  { key: "altro", label: "Altro" },
];

export default function OnboardingScreen({ createWorkspace, reload, switchWorkspace }) {
  const [mode, setMode] = useState(null); // null | "crea" | "invito"
  const [nome, setNome] = useState("");
  const [scopo, setScopo] = useState("famiglia");
  const [codice, setCodice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createWorkspace(nome.trim(), scopo);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleRedeem = async () => {
    if (!codice.trim()) return;
    setSaving(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("redeem_invite", { invite_code: codice.trim().toUpperCase() });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message.replace(/^.*: /, ""));
      return;
    }
    await reload();
    if (data?.workspace_id) switchWorkspace(data.workspace_id);
  };

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #a78bfa, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}>🏠</div>
          <h1 style={{ color: C.text, fontSize: 20, fontWeight: 700, margin: 0 }}>Benvenuto</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Non fai ancora parte di nessun workspace</p>
        </div>

        {mode === null && (
          <div className="space-y-3">
            <button onClick={() => setMode("crea")} className="w-full flex items-center gap-3" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, textAlign: "left" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.purpleSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Home size={18} style={{ color: C.purple }} /></div>
              <div>
                <div className="text-sm font-medium" style={{ color: C.text }}>Crea il tuo primo workspace</div>
                <div className="text-xs" style={{ color: C.muted }}>Famiglia, attività, o quello che vuoi</div>
              </div>
            </button>
            <button onClick={() => setMode("invito")} className="w-full flex items-center gap-3" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, textAlign: "left" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${C.green}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ticket size={18} style={{ color: C.green }} /></div>
              <div>
                <div className="text-sm font-medium" style={{ color: C.text }}>Ho un codice invito</div>
                <div className="text-xs" style={{ color: C.muted }}>Qualcuno ti ha invitato nel suo workspace</div>
              </div>
            </button>
          </div>
        )}

        {mode === "crea" && (
          <div style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20 }}>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (es. Famiglia Rossi)"
              style={{ width: "100%", backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />
            <div className="flex flex-wrap gap-2 mb-4">
              {SCOPI.map((s) => {
                const active = scopo === s.key;
                return (
                  <button key={s.key} onClick={() => setScopo(s.key)} className="font-medium" style={{
                    padding: "8px 14px", borderRadius: 10, fontSize: 12,
                    backgroundColor: active ? C.purple : C.panel2, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? C.purple : C.border}`,
                  }}>{s.label}</button>
                );
              })}
            </div>
            {error && <div className="text-xs mb-3" style={{ color: C.red }}>{error}</div>}
            <button onClick={handleCreate} disabled={!nome.trim() || saving} className="w-full font-semibold"
              style={{ padding: "13px 0", borderRadius: 12, border: "none", backgroundColor: C.purple, color: "#0a0b0f", fontWeight: 600, fontSize: 14, opacity: saving ? 0.6 : 1 }}>
              {saving ? "Creazione..." : "Crea workspace"}
            </button>
            <button onClick={() => { setMode(null); setError(""); }} style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", color: C.muted, fontSize: 12 }}>Indietro</button>
          </div>
        )}

        {mode === "invito" && (
          <div style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20 }}>
            <input value={codice} onChange={(e) => setCodice(e.target.value.toUpperCase())} placeholder="Codice invito"
              style={{ width: "100%", backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: C.text, outline: "none", marginBottom: 12, boxSizing: "border-box", letterSpacing: "0.1em", textAlign: "center", fontFamily: "monospace" }} />
            {error && <div className="text-xs mb-3" style={{ color: C.red }}>{error}</div>}
            <button onClick={handleRedeem} disabled={!codice.trim() || saving} className="w-full font-semibold"
              style={{ padding: "13px 0", borderRadius: 12, border: "none", backgroundColor: C.green, color: "#0a0b0f", fontWeight: 600, fontSize: 14, opacity: saving ? 0.6 : 1 }}>
              {saving ? "Verifica..." : "Entra nel workspace"}
            </button>
            <button onClick={() => { setMode(null); setError(""); }} style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", color: C.muted, fontSize: 12 }}>Indietro</button>
          </div>
        )}
      </div>
    </div>
  );
}
