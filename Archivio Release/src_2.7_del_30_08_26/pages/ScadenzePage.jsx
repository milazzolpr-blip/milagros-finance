import React, { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { C, euroPlain, todayLocal } from "../theme";
import { supabase } from "../lib/supabase";
import ScadenzaSheet from "../components/ScadenzaSheet";

function dataLabel(dateStr) {
  const GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
  const MESI = ["", "gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const d = new Date(dateStr + "T00:00:00");
  return `${GIORNI[d.getDay()].slice(0, 3)} ${d.getDate()} ${MESI[d.getMonth() + 1]}`;
}

export default function ScadenzePage({ inline }) {
  const { workspace, member, bumpRefresh, isReader, showToast } = useOutletContext();
  const navigate = useNavigate();
  const [scadenze, setScadenze] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("da_pagare");
  const [editing, setEditing] = useState(null);
  const [showNuova, setShowNuova] = useState(false);
  const [payingId, setPayingId] = useState(null);

  const load = React.useCallback(() => {
    if (!workspace) return;
    setLoading(true);
    Promise.all([
      supabase.from("scadenze").select("*").eq("workspace_id", workspace.id).order("data_scadenza", { ascending: true }),
      supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
    ]).then(([scadRes, memRes]) => {
      setScadenze(scadRes.data || []);
      setMembers(memRes.data || []);
      setLoading(false);
    });
  }, [workspace]);

  useEffect(() => { load(); }, [load]);

  if (!workspace) return null;

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const oggi = todayLocal();

  const filtrate = scadenze.filter((s) => {
    if (filtro === "da_pagare") return s.stato === "da_pagare";
    if (filtro === "pagate") return s.stato === "pagato";
    return true;
  });

  const handleSegnaPagato = async (scadenza) => {
    setPayingId(scadenza.id);

    const { data: tx, error: txError } = await supabase.from("transactions").insert({
      workspace_id: workspace.id,
      member_id: scadenza.member_id || member?.id,
      date: oggi,
      mese: oggi.slice(0, 7),
      tipo: "uscita",
      importo: scadenza.importo || 0,
      voce: scadenza.titolo,
      macro_categoria: scadenza.macro_categoria,
      micro_categoria: scadenza.micro_categoria,
      note: "Generata da una scadenza segnata come pagata",
    }).select().single();

    if (txError) {
      setPayingId(null);
      showToast("Errore nel creare la transazione: " + txError.message, "error");
      return;
    }

    await supabase.from("scadenze").update({
      stato: "pagato",
      data_pagamento: oggi,
      transaction_id: tx.id,
    }).eq("id", scadenza.id);

    setPayingId(null);
    showToast("Pagamento registrato in Finanza");
    load();
    bumpRefresh?.();
  };

  const handleSaved = () => {
    setEditing(null);
    setShowNuova(false);
    load();
  };

  return (
    <div>
      {!inline && (
        <>
          <button onClick={() => navigate("/app")} className="flex items-center gap-1 text-xs font-medium mb-4" style={{ color: C.muted, background: "none", border: "none" }}>
            <ArrowLeft size={14} /> Torna alla Home
          </button>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 4 }} className="uppercase">Attività</div>
          <h1 className="font-bold mb-5" style={{ fontSize: 26 }}>Scadenze & Adempimenti</h1>
        </>
      )}

      <div className="flex gap-2 mb-4">
        {[{ k: "da_pagare", l: "Da pagare" }, { k: "pagate", l: "Pagate" }, { k: "tutte", l: "Tutte" }].map((f) => {
          const active = filtro === f.k;
          return (
            <button key={f.k} onClick={() => setFiltro(f.k)} className="font-medium" style={{
              padding: "7px 14px", borderRadius: 10, fontSize: 12,
              backgroundColor: active ? C.amber : C.panel, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? C.amber : C.border}`,
            }}>{f.l}</button>
          );
        })}
      </div>

      {loading && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>Caricamento...</div>}
      {!loading && filtrate.length === 0 && (
        <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Nessuna scadenza qui.</div>
      )}

      {filtrate.map((s) => {
        const scaduta = s.stato === "da_pagare" && s.data_scadenza < oggi;
        const person = memberById[s.member_id];
        const isPaying = payingId === s.id;
        return (
          <div key={s.id} style={{ backgroundColor: C.panel, border: `1px solid ${scaduta ? C.red : C.border}`, borderRadius: 16, padding: 14, marginBottom: 10 }}>
            <div className="flex items-start gap-3">
              <button onClick={() => !isReader && s.stato === "da_pagare" && handleSegnaPagato(s)} disabled={isReader || s.stato !== "da_pagare" || isPaying} aria-label="Segna come pagato" style={{ background: "none", border: "none", marginTop: 1, flexShrink: 0 }}>
                {s.stato === "pagato" ? <CheckCircle2 size={20} style={{ color: C.green }} /> : <Circle size={20} style={{ color: scaduta ? C.red : C.muted }} />}
              </button>
              <button onClick={() => setEditing(s)} className="flex-1 text-left" style={{ background: "none", border: "none", minWidth: 0 }}>
                <div className="text-sm font-medium truncate" style={{ color: C.text }}>{s.titolo}</div>
                <div className="text-xs flex items-center gap-1 flex-wrap" style={{ color: C.muted }}>
                  <span style={{ color: scaduta ? C.red : C.muted }}>{dataLabel(s.data_scadenza)}</span>
                  {person && <>· <span style={{ color: person.colore || C.purple }}>{person.display_name}</span></>}
                  {s.macro_categoria && <>· {s.macro_categoria}</>}
                  {scaduta && <span className="flex items-center gap-0.5" style={{ color: C.red }}><AlertTriangle size={10} /> scaduta</span>}
                </div>
              </button>
              {s.importo != null && (
                <div className="text-sm flex-shrink-0" style={{ color: s.stato === "pagato" ? C.green : C.text, fontFamily: "monospace" }}>
                  {euroPlain(s.importo)}
                </div>
              )}
            </div>
            {s.stato === "pagato" && s.data_pagamento && (
              <div className="text-xs mt-2" style={{ color: C.green, paddingLeft: 32 }}>✓ Pagato il {dataLabel(s.data_pagamento)} — registrato in Finanza</div>
            )}
            {isPaying && <div className="text-xs mt-2" style={{ color: C.muted, paddingLeft: 32 }}>Registrazione in corso...</div>}
          </div>
        );
      })}

      {!isReader && (
        <button onClick={() => setShowNuova(true)} className="w-full flex items-center justify-center gap-2" style={{ border: `1px dashed ${C.border}`, borderRadius: 16, padding: 14, color: C.muted, background: "none" }}>
          <Plus size={16} /><span className="text-sm font-medium">Nuova scadenza</span>
        </button>
      )}

      {editing && <ScadenzaSheet workspace={workspace} existing={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
      {showNuova && <ScadenzaSheet workspace={workspace} onClose={() => setShowNuova(false)} onSaved={handleSaved} />}
    </div>
  );
}
