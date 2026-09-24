import React, { useState } from "react";
import { Check, Plus } from "lucide-react";
import { C } from "../theme";
import { Sheet } from "./ui";

const SCOPI = [
  { key: "famiglia", label: "Famiglia" },
  { key: "business", label: "Attività / lavoro" },
  { key: "gruppo", label: "Gruppo" },
  { key: "altro", label: "Altro" },
];

export default function WorkspaceSwitcherSheet({ workspaces, currentWorkspaceId, onSwitch, onCreate, onClose }) {
  const [creating, setCreating] = useState(false);
  const [nome, setNome] = useState("");
  const [scopo, setScopo] = useState("famiglia");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onCreate(nome.trim(), scopo);
      onClose();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  if (creating) {
    return (
      <Sheet onClose={() => setCreating(false)} title="Nuovo workspace">
        <div className="text-xs mb-4" style={{ color: C.muted }}>
          Uno spazio separato con i suoi membri, le sue categorie e le sue transazioni — indipendente dagli altri workspace a cui appartieni.
        </div>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome (es. La mia attività)"
          style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", marginBottom: 12, boxSizing: "border-box" }}
        />
        <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Tipo</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {SCOPI.map((s) => {
            const active = scopo === s.key;
            return (
              <button key={s.key} onClick={() => setScopo(s.key)} className="font-medium" style={{
                padding: "8px 14px", borderRadius: 10, fontSize: 12,
                backgroundColor: active ? C.purple : C.panel, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? C.purple : C.border}`,
              }}>
                {s.label}
              </button>
            );
          })}
        </div>
        {error && <div className="text-xs mb-3" style={{ color: C.red }}>{error}</div>}
        <button onClick={handleCreate} disabled={!nome.trim() || saving} className="w-full font-semibold"
          style={{ padding: "14px 0", borderRadius: 14, fontSize: 14, backgroundColor: nome.trim() ? C.purple : C.panel, color: nome.trim() ? "#0a0b0f" : C.muted, opacity: saving ? 0.6 : 1, border: "none" }}>
          {saving ? "Creazione..." : "Crea workspace"}
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} title="I tuoi workspace">
      <div className="space-y-2 mb-4">
        {workspaces.map((w) => {
          const active = w.id === currentWorkspaceId;
          return (
            <button key={w.id} onClick={() => { onSwitch(w.id); onClose(); }} className="w-full flex items-center gap-3"
              style={{ backgroundColor: C.panel, border: `1px solid ${active ? C.purple : C.border}`, borderRadius: 14, padding: 12, textAlign: "left" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #a78bfa, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>🏠</div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="text-sm font-medium truncate" style={{ color: C.text }}>{w.nome}</div>
                <div className="text-xs" style={{ color: C.muted }}>{w._membership?.display_name} · {w._membership?.role === "admin" ? "Admin" : "Membro"}</div>
              </div>
              {active && <Check size={16} style={{ color: C.purple, flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      <button onClick={() => setCreating(true)} className="w-full flex items-center justify-center gap-2" style={{ border: `1px dashed ${C.border}`, borderRadius: 14, padding: 14, color: C.muted, background: "none" }}>
        <Plus size={16} /><span className="text-sm font-medium">Nuovo workspace</span>
      </button>
    </Sheet>
  );
}
