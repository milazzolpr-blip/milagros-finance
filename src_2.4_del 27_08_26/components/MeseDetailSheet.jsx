import React, { useEffect, useState } from "react";
import { C, euro, euroPlain, meseLabelFull } from "../theme";
import { Sheet, PillTabs } from "./ui";
import { fetchAllTransactions } from "../lib/fetchAllTransactions";
import TransactionModal from "./TransactionModal";

const PALETTE = [C.sky, C.amber, C.orange, C.green, C.fuchsia, C.violet, C.red];

function giornoLabel(dateStr) {
  const GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
  const MESI_NOMI = ["", "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const d = new Date(dateStr + "T00:00:00");
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI_NOMI[d.getMonth() + 1]}`;
}

export default function MeseDetailSheet({ workspace, mese, members, onClose, bumpRefresh, readOnly }) {
  const [transazioni, setTransazioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroPersona, setFiltroPersona] = useState("tutti");
  const [vista, setVista] = useState("giorni"); // "giorni" | "categorie"
  const [macroEspansa, setMacroEspansa] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetchAllTransactions(workspace.id, { mese }).then((data) => {
      setTransazioni(data || []);
      setLoading(false);
    });
  }, [workspace.id, mese]);

  useEffect(() => { load(); }, [load]);

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  const filtrate = transazioni.filter((t) => filtroPersona === "tutti" || t.member_id === filtroPersona);
  const totaleFiltrato = filtrate.reduce((s, t) => s + (t.tipo === "uscita" ? -Number(t.importo) : Number(t.importo)), 0);

  const byDay = {};
  filtrate.forEach((t) => {
    if (!byDay[t.date]) byDay[t.date] = [];
    byDay[t.date].push(t);
  });
  const giorni = Object.keys(byDay).sort((a, b) => (a < b ? 1 : -1));

  // breakdown per macro/microcategoria, sulla stessa base filtrata per persona (solo uscite)
  const usciteFiltrate = filtrate.filter((t) => t.tipo === "uscita" && t.macro_categoria);
  const totaleUsciteFiltrate = usciteFiltrate.reduce((s, t) => s + Number(t.importo), 0) || 1;
  const macroMap = {};
  usciteFiltrate.forEach((t) => {
    if (!macroMap[t.macro_categoria]) macroMap[t.macro_categoria] = { amount: 0, micro: {} };
    macroMap[t.macro_categoria].amount += Number(t.importo);
    const chiaveMicro = t.micro_categoria || "Senza sottocategoria";
    macroMap[t.macro_categoria].micro[chiaveMicro] = (macroMap[t.macro_categoria].micro[chiaveMicro] || 0) + Number(t.importo);
  });
  const categorieOrdinate = Object.entries(macroMap)
    .map(([name, d]) => ({ name, amount: d.amount, pct: (d.amount / totaleUsciteFiltrate) * 100, micro: Object.entries(d.micro).map(([mn, ma]) => ({ name: mn, amount: ma })).sort((a, b) => b.amount - a.amount) }))
    .sort((a, b) => b.amount - a.amount)
    .map((c, i) => ({ ...c, color: PALETTE[i % PALETTE.length] }));

  const handleEditDone = () => {
    setEditing(null);
    load();
    bumpRefresh?.();
  };

  return (
    <Sheet onClose={onClose} title={meseLabelFull(mese)}>
      {members.length > 1 && (
        <PillTabs
          options={[{ key: "tutti", label: "Tutti" }, ...members.map((m) => ({ key: m.id, label: m.display_name, color: m.colore }))]}
          value={filtroPersona} onChange={setFiltroPersona}
        />
      )}

      {loading && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>Caricamento...</div>}

      {!loading && (
        <div style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div className="flex items-center justify-between">
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }} className="uppercase">Totale filtrato</div>
              <div className="font-bold" style={{ fontSize: 26, color: totaleFiltrato >= 0 ? C.green : C.red, fontFamily: "monospace" }}>{euro(totaleFiltrato)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }} className="uppercase">Transazioni</div>
              <div className="font-semibold" style={{ fontSize: 18, color: C.text }}>{filtrate.length}</div>
            </div>
          </div>
        </div>
      )}

      {!loading && giorni.length === 0 && (
        <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Nessuna transazione per questo filtro.</div>
      )}

      {!loading && giorni.length > 0 && (
        <div className="flex gap-2 mb-4">
          {[{ k: "giorni", l: "Giorno per giorno" }, { k: "categorie", l: "Per categoria" }].map((v) => {
            const active = vista === v.k;
            return (
              <button key={v.k} onClick={() => setVista(v.k)} className="font-medium" style={{
                padding: "7px 14px", borderRadius: 10, fontSize: 12,
                backgroundColor: active ? C.violet : C.panel, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? C.violet : C.border}`,
              }}>{v.l}</button>
            );
          })}
        </div>
      )}

      {vista === "categorie" && !loading && giorni.length > 0 && (
        <div style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
          {categorieOrdinate.length === 0 && <div className="text-xs" style={{ color: C.muted }}>Nessuna uscita categorizzata per questo filtro.</div>}
          {categorieOrdinate.map((c) => {
            const espansa = macroEspansa === c.name;
            return (
              <div key={c.name} className="mb-3">
                <button onClick={() => setMacroEspansa(espansa ? null : c.name)} className="w-full flex items-center gap-3" style={{ background: "none", border: "none", padding: 0, textAlign: "left" }}>
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="flex justify-between text-xs mb-1"><span className="font-medium" style={{ color: C.text }}>{c.name}</span><span style={{ color: c.color, fontFamily: "monospace" }}>{euroPlain(c.amount)}</span></div>
                    <div style={{ height: 5, backgroundColor: C.panel2, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(c.pct * 2, 100)}%`, backgroundColor: c.color, borderRadius: 4 }} /></div>
                  </div>
                  <span className="text-xs" style={{ color: C.muted, flexShrink: 0 }}>{c.pct.toFixed(0)}%</span>
                </button>
                {espansa && (
                  <div style={{ marginLeft: 12, marginTop: 8, borderLeft: `1px solid ${C.border}`, paddingLeft: 10 }}>
                    {c.micro.map((m) => (
                      <div key={m.name} className="flex items-center justify-between mb-1.5">
                        <span className="text-xs" style={{ color: C.muted }}>{m.name}</span>
                        <span className="text-xs" style={{ color: C.text, fontFamily: "monospace" }}>{euroPlain(m.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {vista === "giorni" && giorni.map((day) => {
        const items = byDay[day];
        const dayTotal = items.reduce((s, t) => s + (t.tipo === "uscita" ? -Number(t.importo) : Number(t.importo)), 0);
        return (
          <div key={day} style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
              <div>
                <div className="font-medium" style={{ fontSize: 13, color: C.text }}>{giornoLabel(day)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{items.length} {items.length === 1 ? "transazione" : "transazioni"}</div>
              </div>
              <div className="font-bold" style={{ fontSize: 18, color: dayTotal >= 0 ? C.green : C.red, fontFamily: "monospace" }}>{euro(dayTotal)}</div>
            </div>
            <div className="space-y-3.5">
              {items.map((t) => {
                const member = memberById[t.member_id];
                return (
                  <button key={t.id} onClick={() => setEditing(t)} className="w-full flex items-center gap-3" style={{ background: "none", border: "none", textAlign: "left", padding: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9999, backgroundColor: C.panel2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: C.muted, fontSize: 13, fontWeight: 600 }}>
                      {(t.macro_categoria || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div className="text-sm truncate" style={{ color: C.text }}>{t.voce}</div>
                      <div className="text-xs truncate" style={{ color: C.muted }}>
                        {member && <span style={{ color: member.colore || C.purple }}>{member.display_name}</span>} · {t.macro_categoria}{t.micro_categoria ? ` · ${t.micro_categoria}` : ""} · <span style={{ fontSize: 10, opacity: 0.8 }}>{t.modalita || ""}</span>
                      </div>
                    </div>
                    <div className="text-sm" style={{ color: t.tipo === "uscita" ? C.red : C.green, fontFamily: "monospace", flexShrink: 0 }}>
                      {t.tipo === "uscita" ? "-" : "+"}{euroPlain(t.importo)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

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
