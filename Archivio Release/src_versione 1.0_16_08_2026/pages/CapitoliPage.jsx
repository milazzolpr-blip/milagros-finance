import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, AlertTriangle } from "lucide-react";
import { C, euro, euroPlain } from "../theme";
import { supabase } from "../lib/supabase";
import CapitoloDetailSheet from "../components/CapitoloDetailSheet";
import NewCapitoloSheet from "../components/NewCapitoloSheet";

export default function CapitoliPage() {
  const { workspace } = useOutletContext();
  const [capitoli, setCapitoli] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selezionato, setSelezionato] = useState(null);
  const [showNuovo, setShowNuovo] = useState(false);

  const load = React.useCallback(() => {
    if (!workspace) return;
    setLoading(true);
    Promise.all([
      supabase.from("capitoli_spesa").select("*").eq("workspace_id", workspace.id).order("data_inizio", { ascending: false }),
      supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
      supabase.from("transactions").select("capitolo_id, importo, tipo").eq("workspace_id", workspace.id).not("capitolo_id", "is", null),
    ]).then(([capRes, memRes, txRes]) => {
      setMembers(memRes.data || []);
      const totali = {};
      (txRes.data || []).forEach((t) => {
        if (!totali[t.capitolo_id]) totali[t.capitolo_id] = { totale: 0, count: 0 };
        totali[t.capitolo_id].totale += t.tipo === "uscita" ? -Number(t.importo) : Number(t.importo);
        totali[t.capitolo_id].count += 1;
      });
      const withTotals = (capRes.data || []).map((c) => ({ ...c, _totale: totali[c.id]?.totale ?? 0, _count: totali[c.id]?.count ?? 0 }));
      setCapitoli(withTotals);
      setLoading(false);
    });
  }, [workspace]);

  useEffect(() => { load(); }, [load]);

  if (!workspace) return null;

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 4 }} className="uppercase">Gestione</div>
      <h1 className="font-bold mb-5" style={{ fontSize: 26 }}>Capitoli di Spesa</h1>

      {loading && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>Caricamento...</div>}
      {!loading && capitoli.length === 0 && (
        <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Nessun capitolo ancora. Creane uno per raggruppare le spese di un viaggio o progetto.</div>
      )}

      {capitoli.map((c) => (
        <button key={c.id} onClick={() => setSelezionato(c)} className="w-full text-left flex items-center gap-3"
          style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: (c.colore || C.violet) + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{c.icona || "📁"}</div>
          <div className="flex-1" style={{ minWidth: 0 }}>
            <div className="font-medium text-sm" style={{ color: C.text }}>{c.nome}</div>
            {c.descrizione && <div className="text-xs truncate" style={{ color: C.muted }}>{c.descrizione}</div>}
            {(c.data_inizio || c.data_fine) && <div className="text-xs" style={{ color: C.muted }}>{c.data_inizio} – {c.data_fine}</div>}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div className="font-semibold text-sm" style={{ color: c._totale >= 0 ? C.green : C.red, fontFamily: "monospace" }}>{euro(c._totale)}</div>
            <div className="text-xs" style={{ color: C.muted }}>{c._count} {c._count === 1 ? "voce" : "voci"}</div>
          </div>
        </button>
      ))}

      <button onClick={() => setShowNuovo(true)} className="w-full flex items-center justify-center gap-2" style={{ border: `1px dashed ${C.border}`, borderRadius: 16, padding: 14, color: C.muted, background: "none" }}>
        <Plus size={16} /><span className="text-sm font-medium">Nuovo capitolo</span>
      </button>

      {selezionato && (
        <CapitoloDetailSheet capitolo={selezionato} workspaceId={workspace.id} members={members} onClose={() => setSelezionato(null)} />
      )}
      {showNuovo && (
        <NewCapitoloSheet workspaceId={workspace.id} onClose={() => setShowNuovo(false)} onCreated={() => { setShowNuovo(false); load(); }} />
      )}
    </div>
  );
}
