import React, { useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { C, todayLocal } from "../theme";
import { Sheet } from "./ui";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { notificaAltriMembri } from "../lib/notificaAltriMembri";

export default function EventoGenericoSheet({ workspace, existing, defaultDate, onClose, onSaved, onDeleted }) {
  const showToast = useToast();
  const { user } = useAuth();
  const isEdit = !!existing;
  const [members, setMembers] = useState([]);
  const [titolo, setTitolo] = useState(existing?.titolo || "");
  const [data, setData] = useState(existing?.data || defaultDate || todayLocal());
  const [oraInizio, setOraInizio] = useState(existing?.ora_inizio || "");
  const [oraFine, setOraFine] = useState(existing?.ora_fine || "");
  const [personaIds, setPersonaIds] = useState(existing?.member_ids || []);
  const [luogo, setLuogo] = useState(existing?.luogo || "");
  const [note, setNote] = useState(existing?.note || "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("workspace_members").select("id, user_id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active")
      .then(({ data }) => setMembers(data || []));
  }, [workspace.id]);

  const valido = titolo.trim().length > 0 && data;

  const handleSave = async () => {
    if (!valido) return;
    setSaving(true);
    setError("");
    const payload = {
      workspace_id: workspace.id,
      titolo: titolo.trim(),
      data,
      ora_inizio: oraInizio || null,
      ora_fine: oraFine || null,
      member_ids: personaIds,
      luogo: luogo.trim() || null,
      note: note.trim() || null,
    };
    const result = isEdit
      ? await supabase.from("eventi_generici").update(payload).eq("id", existing.id)
      : await supabase.from("eventi_generici").insert(payload);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    if (!isEdit) {
      const mioNome = members.find((m) => m.user_id === user.id)?.display_name || "Qualcuno";
      notificaAltriMembri({
        workspaceId: workspace.id, escludiUserId: user.id, entityType: "evento",
        title: `${mioNome} ha aggiunto un appuntamento`,
        body: `${payload.titolo} · ${payload.data}${payload.ora_inizio ? ` alle ${payload.ora_inizio.slice(0, 5)}` : ""}`,
        navigateTo: "/app/calendario",
      });
    }
    showToast(isEdit ? "Appuntamento aggiornato" : "Appuntamento salvato");
    onSaved();
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    const { error: delError } = await supabase.from("eventi_generici").delete().eq("id", existing.id);
    if (delError) { setError(delError.message); return; }
    showToast("Appuntamento eliminato");
    onDeleted ? onDeleted() : onSaved();
  };

  return (
    <Sheet onClose={onClose} title={isEdit ? "Modifica appuntamento" : "Nuovo appuntamento"} zIndex={56}>
      <input value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Cosa (es. Visita dentista)"
        style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />

      <div className="flex items-center gap-2 mb-3" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px" }}>
        <CalendarDays size={15} style={{ color: C.muted }} />
        <input type="date" value={data} onChange={(e) => setData(e.target.value)}
          style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: C.text, width: "100%", colorScheme: "dark" }} />
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <Clock size={14} style={{ color: C.muted }} />
          <input type="time" value={oraInizio} onChange={(e) => setOraInizio(e.target.value)} style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: C.text, width: "100%", colorScheme: "dark" }} />
        </div>
        <div className="flex-1 flex items-center gap-2" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <Clock size={14} style={{ color: C.muted }} />
          <input type="time" value={oraFine} onChange={(e) => setOraFine(e.target.value)} style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: C.text, width: "100%", colorScheme: "dark" }} />
        </div>
      </div>

      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Chi (puoi sceglierne più di uno)</div>
      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
        {members.map((m) => {
          const active = personaIds.includes(m.id);
          return (
            <button key={m.id} onClick={() => setPersonaIds((prev) => (prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]))} className="font-medium" style={{ padding: "9px 14px", borderRadius: 12, fontSize: 13, backgroundColor: active ? (m.colore || C.purple) : C.panel, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? (m.colore || C.purple) : C.border}` }}>
              {m.display_name}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px" }}>
        <MapPin size={14} style={{ color: C.muted, flexShrink: 0 }} />
        <input value={luogo} onChange={(e) => setLuogo(e.target.value)} placeholder="Luogo (opzionale)"
          style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: C.text, width: "100%" }} />
      </div>

      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (opzionale)" rows={2}
        style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", marginBottom: 16, boxSizing: "border-box", resize: "none", fontFamily: "inherit" }} />

      {error && <div className="text-xs mb-3" style={{ color: C.red }}>{error}</div>}
      <button onClick={handleSave} disabled={!valido || saving} className="w-full font-semibold"
        style={{ padding: "14px 0", borderRadius: 14, fontSize: 14, backgroundColor: valido ? C.purple : C.panel, color: valido ? "#0a0b0f" : C.muted, opacity: (valido && !saving) ? 1 : 0.6, border: "none", marginBottom: isEdit ? 10 : 0 }}>
        {saving ? "Salvataggio..." : isEdit ? "Salva modifiche" : "Salva — confluisce nel Calendario"}
      </button>
      {isEdit && (
        <button onClick={handleDelete} className="w-full font-medium" style={{ padding: "12px 0", borderRadius: 14, fontSize: 13, backgroundColor: confirmDelete ? C.red : "transparent", color: confirmDelete ? "#0a0b0f" : C.red, border: confirmDelete ? "none" : `1px solid ${C.red}` }}>
          {confirmDelete ? "Conferma eliminazione" : "Elimina"}
        </button>
      )}
    </Sheet>
  );
}
