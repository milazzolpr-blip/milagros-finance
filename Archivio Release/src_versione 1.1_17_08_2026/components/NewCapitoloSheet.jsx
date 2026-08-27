import React, { useState } from "react";
import { C } from "../theme";
import { Sheet } from "./ui";
import { supabase } from "../lib/supabase";

const COLORI = [C.violet, C.blue, C.amber, C.green, C.fuchsia, C.orange];

export default function NewCapitoloSheet({ workspaceId, onClose, onCreated }) {
  const [nome, setNome] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const valido = nome.trim().length > 0;

  const handleSave = async () => {
    if (!valido) return;
    setSaving(true);
    setError("");
    const colore = COLORI[Math.floor(Math.random() * COLORI.length)];
    const { error: insertError } = await supabase.from("capitoli_spesa").insert({
      workspace_id: workspaceId,
      nome: nome.trim(),
      descrizione: descrizione.trim() || null,
      data_inizio: dataInizio || null,
      data_fine: dataFine || null,
      colore,
      icona: "📁",
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onCreated();
  };

  return (
    <Sheet onClose={onClose} title="Nuovo capitolo">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome (es. Tropea 2026)"
        style={inputStyle}
      />
      <input
        value={descrizione}
        onChange={(e) => setDescrizione(e.target.value)}
        placeholder="Descrizione (opzionale)"
        style={inputStyle}
      />
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Inizio</div>
          <input type="date" value={dataInizio} onChange={(e) => setDataInizio(e.target.value)}
            style={{ ...inputStyle, marginBottom: 0, colorScheme: "dark" }} />
        </div>
        <div className="flex-1">
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Fine</div>
          <input type="date" value={dataFine} onChange={(e) => setDataFine(e.target.value)}
            style={{ ...inputStyle, marginBottom: 0, colorScheme: "dark" }} />
        </div>
      </div>

      {error && <div className="text-xs mb-3" style={{ color: C.red }}>{error}</div>}

      <button
        onClick={handleSave}
        disabled={!valido || saving}
        className="w-full font-semibold"
        style={{
          padding: "14px 0", borderRadius: 14, fontSize: 14,
          backgroundColor: valido ? C.purple : C.panel, color: valido ? "#0a0b0f" : C.muted,
          opacity: (valido && !saving) ? 1 : 0.6,
        }}
      >
        {saving ? "Creazione..." : "Crea capitolo"}
      </button>
    </Sheet>
  );
}

const inputStyle = {
  width: "100%",
  backgroundColor: C.panel,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 13,
  color: C.text,
  outline: "none",
  marginBottom: 12,
  boxSizing: "border-box",
};
