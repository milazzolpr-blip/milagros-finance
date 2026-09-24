import React, { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { C, euro, euroPlain } from "../theme";
import { Sheet, Card, PillTabs } from "./ui";
import { supabase } from "../lib/supabase";
import TransactionModal from "./TransactionModal";

/**
 * Euristica di rilevamento doppioni: due transazioni della stessa persona,
 * nella stessa macro categoria, entro 3 giorni l'una dall'altra, con importi
 * vicini (entro il 15% o entro 3€) vengono segnalate come possibile doppione.
 * È un aiuto per il controllo manuale, non una cancellazione automatica —
 * i falsi positivi sono normali e vanno sempre verificati a occhio.
 */
function detectPossibleDuplicates(transazioni) {
  const flagged = new Set();
  for (let i = 0; i < transazioni.length; i++) {
    for (let j = i + 1; j < transazioni.length; j++) {
      const a = transazioni[i], b = transazioni[j];
      if (a.member_id !== b.member_id) continue;
      if (a.macro_categoria !== b.macro_categoria) continue;
      const dateDiff = Math.abs(new Date(a.date) - new Date(b.date)) / 86400000;
      if (dateDiff > 3) continue;
      const impA = Number(a.importo), impB = Number(b.importo);
      const impDiff = Math.abs(impA - impB);
      const impRatio = impDiff / Math.max(impA, impB, 1);
      if (impRatio <= 0.15 || impDiff <= 3) {
        flagged.add(a.id);
        flagged.add(b.id);
      }
    }
  }
  return flagged;
}

export default function CapitoloDetailSheet({ capitolo, workspace, members, onClose, bumpRefresh, readOnly }) {
  const [transazioni, setTransazioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [filtroPersona, setFiltroPersona] = useState("tutti");
  const [filtroCategoria, setFiltroCategoria] = useState("tutte");

  const load = React.useCallback(() => {
    setLoading(true);
    supabase
      .from("transactions")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("capitolo_id", capitolo.id)
      .order("date", { ascending: true })
      .then(({ data }) => {
        setTransazioni(data || []);
        setLoading(false);
      });
  }, [workspace.id, capitolo.id]);

  useEffect(() => { load(); }, [load]);

  const handleEditDone = () => {
    setEditing(null);
    load();
    bumpRefresh?.();
  };

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  const categorieDisponibili = [...new Set(transazioni.map((t) => t.macro_categoria).filter(Boolean))].sort();
  const personeDisponibili = [...new Set(transazioni.map((t) => t.member_id).filter(Boolean))];

  const filtrate = transazioni.filter((t) => {
    if (filtroPersona !== "tutti" && t.member_id !== filtroPersona) return false;
    if (filtroCategoria !== "tutte" && t.macro_categoria !== filtroCategoria) return false;
    return true;
  });

  const totale = filtrate.reduce((s, t) => s + (t.tipo === "uscita" ? -Number(t.importo) : Number(t.importo)), 0);
  const duplicatiFlagged = detectPossibleDuplicates(filtrate);
  const numCoppieDoppioni = duplicatiFlagged.size; // conteggio voci coinvolte, non coppie esatte

  return (
    <Sheet onClose={onClose} title={capitolo.nome}>
      {capitolo.descrizione && <div className="text-xs mb-4" style={{ color: C.muted }}>{capitolo.descrizione} · {capitolo.data_inizio} – {capitolo.data_fine}</div>}

      {loading ? (
        <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>Caricamento...</div>
      ) : (
        <>
          <Card style={{ marginBottom: 12 }}>
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontSize: 11, color: C.muted }} className="uppercase">Totale</div>
                <div className="font-bold" style={{ fontSize: 22, color: totale >= 0 ? C.green : C.red, fontFamily: "monospace" }}>{euro(totale)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: C.muted }} className="uppercase">Voci</div>
                <div className="font-semibold" style={{ fontSize: 16, color: C.text }}>{filtrate.length}</div>
              </div>
            </div>
          </Card>

          {(personeDisponibili.length > 1 || categorieDisponibili.length > 1) && (
            <div className="mb-4">
              {personeDisponibili.length > 1 && (
                <div className="mb-2">
                  <PillTabs
                    options={[{ key: "tutti", label: "Tutti" }, ...personeDisponibili.map((id) => ({ key: id, label: memberById[id]?.display_name || "?", color: memberById[id]?.colore }))]}
                    value={filtroPersona} onChange={setFiltroPersona}
                  />
                </div>
              )}
              {categorieDisponibili.length > 1 && (
                <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                  <button onClick={() => setFiltroCategoria("tutte")} className="font-medium" style={{
                    padding: "6px 12px", borderRadius: 9999, fontSize: 11,
                    backgroundColor: filtroCategoria === "tutte" ? C.violet : C.panel, color: filtroCategoria === "tutte" ? "#0a0b0f" : C.muted, border: `1px solid ${filtroCategoria === "tutte" ? C.violet : C.border}`,
                  }}>Tutte le categorie</button>
                  {categorieDisponibili.map((cat) => (
                    <button key={cat} onClick={() => setFiltroCategoria(cat)} className="font-medium" style={{
                      padding: "6px 12px", borderRadius: 9999, fontSize: 11,
                      backgroundColor: filtroCategoria === cat ? C.violet : C.panel, color: filtroCategoria === cat ? "#0a0b0f" : C.muted, border: `1px solid ${filtroCategoria === cat ? C.violet : C.border}`,
                    }}>{cat}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {numCoppieDoppioni > 0 && (
            <div className="flex items-center gap-2 mb-4" style={{ backgroundColor: "rgba(251,191,36,0.12)", border: `1px solid ${C.amber}`, borderRadius: 12, padding: "10px 12px" }}>
              <AlertTriangle size={16} style={{ color: C.amber, flexShrink: 0 }} />
              <span className="text-xs" style={{ color: C.amber }}>
                {numCoppieDoppioni} {numCoppieDoppioni === 1 ? "voce sospetta" : "voci sospette"} — stesso importo/persona/categoria a pochi giorni di distanza. Controllale prima di eliminare.
              </span>
            </div>
          )}

          {filtrate.length === 0 && (
            <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>
              {transazioni.length === 0 ? "Nessuna transazione associata a questo capitolo ancora." : "Nessuna transazione corrisponde a questo filtro."}
            </div>
          )}

          <div className="space-y-2.5">
            {filtrate.map((t) => {
              const isDup = duplicatiFlagged.has(t.id);
              const member = memberById[t.member_id];
              return (
                <button key={t.id} onClick={() => setEditing(t)} className="w-full flex items-center gap-3" style={{ background: "none", border: "none", textAlign: "left", ...(isDup ? { backgroundColor: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 10, padding: 8 } : { padding: "0 2px" }) }}>
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="text-sm truncate" style={{ color: C.text }}>{t.voce}</div>
                    <div className="text-xs truncate" style={{ color: C.muted }}>
                      {member && <span style={{ color: member.colore || C.purple }}>{member.display_name}</span>} · {t.date}
                      {isDup && <span style={{ color: C.amber }}> · possibile doppione</span>}
                    </div>
                  </div>
                  <div className="text-sm" style={{ color: t.tipo === "uscita" ? C.red : C.green, fontFamily: "monospace", flexShrink: 0 }}>
                    {t.tipo === "uscita" ? "-" : "+"}{euroPlain(t.importo)}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {editing && (
        <TransactionModal
          workspace={workspace}
          existing={editing}
          zIndex={55}
          onClose={() => setEditing(null)}
          onSaved={handleEditDone}
          onDeleted={handleEditDone}
          readOnly={readOnly}
        />
      )}
    </Sheet>
  );
}
