import React, { useEffect, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { C, todayLocal } from "../theme";
import { Sheet } from "./ui";
import { supabase } from "../lib/supabase";

const SUGGERIMENTI = {
  figlio: ["Pediatra", "Scuola", "Sport", "Compleanno"],
  cane: ["Veterinario", "Passeggiata", "Toelettatura"],
  gatto: ["Veterinario", "Toelettatura"],
  tartaruga: ["Veterinario"],
  personalizzato: [],
};

export default function AttivitaFiglioSheet({ workspace, defaultDate, onClose, onSaved }) {
  const [entita, setEntita] = useState([]);
  const [members, setMembers] = useState([]);
  const [entitaId, setEntitaId] = useState(null);
  const [titolo, setTitolo] = useState("");
  const [data, setData] = useState(defaultDate || todayLocal());
  const [ora, setOra] = useState("");
  const [accompagnaId, setAccompagnaId] = useState(null);
  const [riprendeId, setRiprendeId] = useState(null);
  const [luogo, setLuogo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("entita_familiari").select("*").eq("workspace_id", workspace.id).order("nome"),
      supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
    ]).then(([entRes, memRes]) => {
      setEntita(entRes.data || []);
      setMembers(memRes.data || []);
      if (entRes.data?.length) setEntitaId(entRes.data[0].id);
    });
  }, [workspace.id]);

  const entitaSel = entita.find((e) => e.id === entitaId);
  const suggerimenti = entitaSel ? SUGGERIMENTI[entitaSel.tipo] || [] : [];
  const valido = entitaId && titolo.trim().length > 0 && data;

  const handleSave = async () => {
    if (!valido) return;
    setSaving(true);
    setError("");
    const { error: insError } = await supabase.from("entita_attivita").insert({
      workspace_id: workspace.id,
      entita_id: entitaId,
      titolo: titolo.trim(),
      data,
      ora: ora || null,
      chi_accompagna_id: accompagnaId,
      chi_riprende_id: riprendeId,
      luogo: luogo.trim() || null,
    });
    setSaving(false);
    if (insError) { setError(insError.message); return; }
    onSaved();
  };

  if (entita.length === 0) {
    return (
      <Sheet onClose={onClose} title="Attività">
        <div className="text-sm mb-4" style={{ color: C.muted }}>Non hai ancora aggiunto nessuno (figlio, animale...). Crealo prima da Attività → Figli.</div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} title="Nuova attività">
      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Per chi</div>
      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
        {entita.map((e) => {
          const active = entitaId === e.id;
          return (
            <button key={e.id} onClick={() => setEntitaId(e.id)} className="font-medium" style={{ padding: "9px 14px", borderRadius: 12, fontSize: 13, backgroundColor: active ? (e.colore || C.orange) : C.panel, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? (e.colore || C.orange) : C.border}` }}>
              {e.icona || "👤"} {e.nome}
            </button>
          );
        })}
      </div>

      {suggerimenti.length > 0 && (
        <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
          {suggerimenti.map((s) => (
            <button key={s} onClick={() => setTitolo(s)} className="text-xs" style={{ padding: "5px 10px", borderRadius: 9999, backgroundColor: C.panel2, color: C.muted, border: `1px solid ${C.border}` }}>{s}</button>
          ))}
        </div>
      )}
      <input value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Cosa (es. Visita pediatrica)"
        style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />

      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <CalendarDays size={14} style={{ color: C.muted }} />
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: C.text, width: "100%", colorScheme: "dark" }} />
        </div>
        <div className="flex-1 flex items-center gap-2" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <Clock size={14} style={{ color: C.muted }} />
          <input type="time" value={ora} onChange={(e) => setOra(e.target.value)} style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: C.text, width: "100%", colorScheme: "dark" }} />
        </div>
      </div>

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Chi accompagna</div>
      <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
        {members.map((m) => (
          <button key={m.id} onClick={() => setAccompagnaId(accompagnaId === m.id ? null : m.id)} className="text-xs font-medium" style={{ padding: "6px 12px", borderRadius: 9999, backgroundColor: accompagnaId === m.id ? (m.colore || C.purple) : C.panel, color: accompagnaId === m.id ? "#0a0b0f" : C.muted, border: `1px solid ${accompagnaId === m.id ? (m.colore || C.purple) : C.border}` }}>{m.display_name}</button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Chi riprende</div>
      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
        {members.map((m) => (
          <button key={m.id} onClick={() => setRiprendeId(riprendeId === m.id ? null : m.id)} className="text-xs font-medium" style={{ padding: "6px 12px", borderRadius: 9999, backgroundColor: riprendeId === m.id ? (m.colore || C.purple) : C.panel, color: riprendeId === m.id ? "#0a0b0f" : C.muted, border: `1px solid ${riprendeId === m.id ? (m.colore || C.purple) : C.border}` }}>{m.display_name}</button>
        ))}
      </div>

      <input value={luogo} onChange={(e) => setLuogo(e.target.value)} placeholder="Luogo (opzionale)"
        style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

      {error && <div className="text-xs mb-3" style={{ color: C.red }}>{error}</div>}
      <button onClick={handleSave} disabled={!valido || saving} className="w-full font-semibold"
        style={{ padding: "14px 0", borderRadius: 14, fontSize: 14, backgroundColor: valido ? C.purple : C.panel, color: valido ? "#0a0b0f" : C.muted, opacity: (valido && !saving) ? 1 : 0.6, border: "none" }}>
        {saving ? "Salvataggio..." : "Salva attività"}
      </button>
    </Sheet>
  );
}
