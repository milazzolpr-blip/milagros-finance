import React, { useEffect, useState } from "react";
import { CalendarDays, Clock, X, Plus, Pencil, FileText, Upload } from "lucide-react";
import { C, todayLocal } from "../theme";
import { Sheet } from "./ui";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";

export default function AttivitaFiglioSheet({ workspace, defaultDate, onClose, onSaved }) {
  const showToast = useToast();
  const [entita, setEntita] = useState([]);
  const [members, setMembers] = useState([]);
  const [suggerimenti, setSuggerimenti] = useState([]);
  const [entitaId, setEntitaId] = useState(null);
  const [titolo, setTitolo] = useState("");
  const [data, setData] = useState(defaultDate || todayLocal());
  const [ora, setOra] = useState("");
  const [accompagnaIds, setAccompagnaIds] = useState([]);
  const [riprendeIds, setRiprendeIds] = useState([]);
  const [luogo, setLuogo] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [modificaSuggerimenti, setModificaSuggerimenti] = useState(false);
  const [nuovoSuggerimento, setNuovoSuggerimento] = useState("");

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

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

  const caricaSuggerimenti = React.useCallback(() => {
    if (!entitaSel) return;
    supabase.from("attivita_suggerite").select("*").eq("workspace_id", workspace.id).eq("tipo", entitaSel.tipo).order("nome")
      .then(({ data }) => setSuggerimenti(data || []));
  }, [workspace.id, entitaSel?.tipo]); // eslint-disable-line

  useEffect(() => { caricaSuggerimenti(); }, [caricaSuggerimenti]);

  const valido = entitaId && titolo.trim().length > 0 && data;

  const toggleAccompagna = (id) => setAccompagnaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleRiprende = (id) => setRiprendeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleAggiungiSuggerimento = async () => {
    if (!nuovoSuggerimento.trim() || !entitaSel) return;
    const { error: err } = await supabase.from("attivita_suggerite").insert({ workspace_id: workspace.id, tipo: entitaSel.tipo, nome: nuovoSuggerimento.trim() });
    if (err) { showToast("Salvataggio non riuscito: " + err.message, "error"); return; }
    setNuovoSuggerimento("");
    caricaSuggerimenti();
  };
  const handleEliminaSuggerimento = async (id) => {
    const { error: err } = await supabase.from("attivita_suggerite").delete().eq("id", id);
    if (err) { showToast("Eliminazione non riuscita: " + err.message, "error"); return; }
    caricaSuggerimenti();
  };

  const handleSave = async () => {
    if (!valido) return;
    setSaving(true);
    setError("");

    let allegatoUrl = null, allegatoNome = null;
    if (file) {
      setUploading(true);
      const path = `${workspace.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("attivita-allegati").upload(path, file);
      setUploading(false);
      if (upErr) { setSaving(false); setError("Upload allegato fallito: " + upErr.message); return; }
      allegatoUrl = path;
      allegatoNome = file.name;
    }

    const { error: insError } = await supabase.from("entita_attivita").insert({
      workspace_id: workspace.id,
      entita_id: entitaId,
      titolo: titolo.trim(),
      data,
      ora: ora || null,
      chi_accompagna_ids: accompagnaIds,
      chi_riprende_ids: riprendeIds,
      luogo: luogo.trim() || null,
      note: note.trim() || null,
      allegato_url: allegatoUrl,
      allegato_nome: allegatoNome,
    });
    setSaving(false);
    if (insError) { setError(insError.message); return; }
    showToast("Attività salvata");
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

      <div className="flex items-center justify-between mb-2">
        <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600 }} className="uppercase">Suggerimenti</div>
        <button onClick={() => setModificaSuggerimenti((v) => !v)} className="flex items-center gap-1 text-xs font-medium" style={{ color: modificaSuggerimenti ? C.purple : C.muted, background: "none", border: "none" }}>
          <Pencil size={11} /> {modificaSuggerimenti ? "Fatto" : "Modifica"}
        </button>
      </div>
      <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
        {suggerimenti.map((s) => (
          <button key={s.id} onClick={() => (modificaSuggerimenti ? handleEliminaSuggerimento(s.id) : setTitolo(s.nome))} className="flex items-center gap-1 text-xs" style={{ padding: "5px 10px", borderRadius: 9999, backgroundColor: modificaSuggerimenti ? C.redSoft : C.panel2, color: modificaSuggerimenti ? C.red : C.muted, border: `1px solid ${modificaSuggerimenti ? C.red : C.border}` }}>
            {modificaSuggerimenti && <X size={10} />} {s.nome}
          </button>
        ))}
        {suggerimenti.length === 0 && !modificaSuggerimenti && <span className="text-xs" style={{ color: C.faint, fontStyle: "italic" }}>Nessun suggerimento ancora.</span>}
      </div>
      {modificaSuggerimenti && (
        <div className="flex gap-2 mb-4">
          <input value={nuovoSuggerimento} onChange={(e) => setNuovoSuggerimento(e.target.value)} placeholder="Nuovo suggerimento (es. Dentista)" onKeyDown={(e) => e.key === "Enter" && handleAggiungiSuggerimento()}
            style={{ flex: 1, backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 12, color: C.text, outline: "none" }} />
          <button onClick={handleAggiungiSuggerimento} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.purple, border: "none", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={16} color="#0a0b0f" /></button>
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

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Chi accompagna (puoi sceglierne più di uno)</div>
      <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
        {members.map((m) => (
          <button key={m.id} onClick={() => toggleAccompagna(m.id)} className="text-xs font-medium" style={{ padding: "6px 12px", borderRadius: 9999, backgroundColor: accompagnaIds.includes(m.id) ? (m.colore || C.purple) : C.panel, color: accompagnaIds.includes(m.id) ? "#0a0b0f" : C.muted, border: `1px solid ${accompagnaIds.includes(m.id) ? (m.colore || C.purple) : C.border}` }}>{m.display_name}</button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Chi riprende (puoi sceglierne più di uno)</div>
      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
        {members.map((m) => (
          <button key={m.id} onClick={() => toggleRiprende(m.id)} className="text-xs font-medium" style={{ padding: "6px 12px", borderRadius: 9999, backgroundColor: riprendeIds.includes(m.id) ? (m.colore || C.purple) : C.panel, color: riprendeIds.includes(m.id) ? "#0a0b0f" : C.muted, border: `1px solid ${riprendeIds.includes(m.id) ? (m.colore || C.purple) : C.border}` }}>{m.display_name}</button>
        ))}
      </div>

      <input value={luogo} onChange={(e) => setLuogo(e.target.value)} placeholder="Luogo (opzionale)"
        style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />

      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note aggiuntive (opzionale)" rows={2}
        style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", marginBottom: 12, boxSizing: "border-box", resize: "none", fontFamily: "inherit" }} />

      <label className="flex items-center gap-2 mb-4" style={{ backgroundColor: C.panel, border: `1px dashed ${C.border}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
        <input type="file" accept=".pdf,image/*" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
        {file ? <FileText size={15} style={{ color: C.purple }} /> : <Upload size={15} style={{ color: C.muted }} />}
        <span className="text-xs" style={{ color: file ? C.text : C.muted }}>{file ? file.name : "Allega un file (PDF, immagine...)"}</span>
      </label>

      {error && <div className="text-xs mb-3" style={{ color: C.red }}>{error}</div>}
      <button onClick={handleSave} disabled={!valido || saving} className="w-full font-semibold"
        style={{ padding: "14px 0", borderRadius: 14, fontSize: 14, backgroundColor: valido ? C.purple : C.panel, color: valido ? "#0a0b0f" : C.muted, opacity: (valido && !saving) ? 1 : 0.6, border: "none" }}>
        {saving ? (uploading ? "Caricamento allegato..." : "Salvataggio...") : "Salva attività"}
      </button>
    </Sheet>
  );
}
