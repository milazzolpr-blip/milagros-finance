import React, { useEffect, useState } from "react";
import { C } from "../theme";
import { Sheet } from "./ui";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";

export default function QuickAddListaSheet({ workspace, onClose, onSaved }) {
  const showToast = useToast();
  const [liste, setListe] = useState([]);
  const [listaId, setListaId] = useState(null);
  const [testo, setTesto] = useState("");
  const [luogo, setLuogo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("liste").select("id, nome").eq("workspace_id", workspace.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        setListe(data || []);
        if (data?.length) setListaId(data[0].id);
        setLoading(false);
      });
  }, [workspace.id]);

  const valido = listaId && testo.trim().length > 0;

  const handleSave = async () => {
    if (!valido) return;
    setSaving(true);
    const { error } = await supabase.from("liste_articoli").insert({ lista_id: listaId, testo: testo.trim(), luogo: luogo.trim() || null });
    setSaving(false);
    if (error) { showToast("Salvataggio non riuscito: " + error.message, "error"); return; }
    const nomeLista = liste.find((l) => l.id === listaId)?.nome || "";
    showToast(`Aggiunto a "${nomeLista}"`);
    onSaved?.();
    onClose();
  };

  return (
    <Sheet onClose={onClose} title="Nuovo elemento lista">
      {loading && <div className="text-xs" style={{ color: C.muted, textAlign: "center", padding: "20px 0" }}>Caricamento...</div>}

      {!loading && liste.length === 0 && (
        <div className="text-sm" style={{ color: C.muted, textAlign: "center", padding: "20px 0" }}>
          Non hai ancora nessuna lista — creane una prima da Attività → Liste.
        </div>
      )}

      {!loading && liste.length > 0 && (
        <>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">In quale lista</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {liste.map((l) => {
              const active = listaId === l.id;
              return (
                <button key={l.id} onClick={() => setListaId(l.id)} className="font-medium" style={{
                  padding: "8px 14px", borderRadius: 12, fontSize: 13,
                  backgroundColor: active ? C.fuchsia : C.panel, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? C.fuchsia : C.border}`,
                }}>{l.nome}</button>
              );
            })}
          </div>

          <input value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Nuovo elemento" onKeyDown={(e) => e.key === "Enter" && handleSave()}
            style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
          <input value={luogo} onChange={(e) => setLuogo(e.target.value)} placeholder="Serve andare in un posto specifico? (opzionale)" onKeyDown={(e) => e.key === "Enter" && handleSave()}
            style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

          <button onClick={handleSave} disabled={!valido || saving} className="w-full flex items-center justify-center gap-2 font-semibold" style={{
            padding: "13px 0", borderRadius: 12, fontSize: 14, border: "none",
            backgroundColor: valido ? C.purple : C.panel2, color: valido ? "#0a0b0f" : C.muted, opacity: saving ? 0.6 : 1,
          }}>
            {saving ? "Salvataggio..." : "Aggiungi elemento"}
          </button>
        </>
      )}
    </Sheet>
  );
}
