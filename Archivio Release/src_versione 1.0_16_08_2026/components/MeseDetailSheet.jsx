import React, { useEffect, useState } from "react";
import { C, euro, euroPlain } from "../theme";
import { Sheet, PillTabs } from "./ui";
import { fetchAllTransactions } from "../lib/fetchAllTransactions";

function meseLabel(mese) {
  // "2026-08" -> "Agosto 2026"
  const MESI_NOMI = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
  const [anno, mm] = mese.split("-");
  return `${MESI_NOMI[parseInt(mm, 10)]} ${anno}`;
}

function giornoLabel(dateStr) {
  const GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
  const MESI_NOMI = ["", "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const d = new Date(dateStr + "T00:00:00");
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI_NOMI[d.getMonth() + 1]}`;
}

export default function MeseDetailSheet({ workspaceId, mese, members, onClose }) {
  const [transazioni, setTransazioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroPersona, setFiltroPersona] = useState("tutti");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAllTransactions(workspaceId, { mese }).then((data) => {
      if (cancelled) return;
      setTransazioni(data || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [workspaceId, mese]);

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  const filtrate = transazioni.filter((t) => filtroPersona === "tutti" || t.member_id === filtroPersona);
  const totaleFiltrato = filtrate.reduce((s, t) => s + (t.tipo === "uscita" ? -Number(t.importo) : Number(t.importo)), 0);

  const byDay = {};
  filtrate.forEach((t) => {
    if (!byDay[t.date]) byDay[t.date] = [];
    byDay[t.date].push(t);
  });
  const giorni = Object.keys(byDay).sort((a, b) => (a < b ? 1 : -1));

  return (
    <Sheet onClose={onClose} title={meseLabel(mese)}>
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

      {giorni.map((day) => {
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
                  <div key={t.id} className="flex items-center gap-3">
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
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Sheet>
  );
}
