import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { C, euro, euroPlain, meseLabelFull } from "../theme";
import { supabase } from "../lib/supabase";
import { fetchAllTransactions } from "../lib/fetchAllTransactions";
import MeseDetailSheet from "../components/MeseDetailSheet";

function StatPill({ label, value, color }) {
  return (
    <div style={{ flex: 1, backgroundColor: `${color}14`, border: `1px solid ${color}33`, borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 9, letterSpacing: "0.06em", color: C.muted, fontWeight: 600, marginBottom: 3 }} className="uppercase">{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

export default function MesiPage() {
  const { workspace, refreshKey, bumpRefresh } = useOutletContext();
  const [mesi, setMesi] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meseSelezionato, setMeseSelezionato] = useState(null);

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [tx, { data: mem }] = await Promise.all([
        fetchAllTransactions(workspace.id),
        supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
      ]);
      if (cancelled) return;
      setMembers(mem || []);

      const byMese = {};
      (tx || []).forEach((t) => {
        if (!byMese[t.mese]) byMese[t.mese] = { mese: t.mese, entrate: 0, spese: 0, perMembro: {} };
        const bucket = byMese[t.mese];
        const val = Number(t.importo);
        if (t.tipo === "entrata") bucket.entrate += val; else bucket.spese += val;
        if (!bucket.perMembro[t.member_id]) bucket.perMembro[t.member_id] = { entrate: 0, spese: 0 };
        if (t.tipo === "entrata") bucket.perMembro[t.member_id].entrate += val; else bucket.perMembro[t.member_id].spese += val;
      });

      // ordine cronologico crescente per calcolare il cumulativo, poi si inverte per la vista
      const cronologico = Object.values(byMese).sort((a, b) => (a.mese > b.mese ? 1 : -1));
      let running = 0;
      cronologico.forEach((m) => {
        running += m.entrate - m.spese;
        m.cumulativo = running;
      });
      const list = cronologico.slice().reverse();

      if (cancelled) return;
      setMesi(list);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [workspace, refreshKey]);

  if (!workspace) return null;

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 4 }} className="uppercase">Storico</div>
      <h1 className="font-bold mb-5" style={{ fontSize: 26 }}>Mesi</h1>

      {loading && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>Caricamento...</div>}
      {!loading && mesi.length === 0 && (
        <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>
          Nessuna transazione registrata ancora. Una volta importati i dati o aggiunte le prime transazioni, qui vedrai lo storico mese per mese.
        </div>
      )}

      {mesi.map((m) => {
        const netto = m.entrate - m.spese;
        const positivo = netto >= 0;
        const borderColor = positivo ? "rgba(61,220,151,0.35)" : "rgba(251,113,133,0.35)";
        return (
          <button
            key={m.mese}
            onClick={() => setMeseSelezionato(m.mese)}
            className="w-full text-left"
            style={{ backgroundColor: C.panel, border: `1px solid ${borderColor}`, borderRadius: 16, padding: 14, marginBottom: 12, display: "block" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold" style={{ fontSize: 16, color: C.text }}>{meseLabelFull(m.mese)}</span>
              <span className="font-semibold" style={{ fontSize: 16, color: positivo ? C.green : C.red, fontFamily: "monospace" }}>{euro(netto)}</span>
            </div>

            <div className="flex gap-2 mb-3">
              <StatPill label="Entrate" value={euroPlain(m.entrate)} color={C.green} />
              <StatPill label="Spese" value={euroPlain(m.spese)} color={C.red} />
              <StatPill label="Cumulativo" value={euroPlain(m.cumulativo)} color={C.violet} />
            </div>

            {members.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ fontSize: 11, color: C.muted }}>
                {members.map((mem) => {
                  const dati = m.perMembro[mem.id];
                  if (!dati) return null;
                  return (
                    <span key={mem.id}>
                      <span style={{ color: mem.colore || C.purple, fontWeight: 500 }}>{mem.display_name}</span>{" "}
                      <span style={{ fontFamily: "monospace" }}>{euroPlain(dati.spese)}</span>
                      <span style={{ color: C.green, marginLeft: 3 }}>↑{euroPlain(dati.entrate)}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </button>
        );
      })}

      {meseSelezionato && (
        <MeseDetailSheet
          workspace={workspace}
          mese={meseSelezionato}
          members={members}
          onClose={() => setMeseSelezionato(null)}
          bumpRefresh={bumpRefresh}
        />
      )}
    </div>
  );
}
