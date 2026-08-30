import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, Receipt, Clock, Baby, CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { C, euroPlain, todayLocal } from "../theme";
import { PillTabs } from "../components/ui";
import { supabase } from "../lib/supabase";
import ScadenzaSheet from "../components/ScadenzaSheet";
import EventoGenericoSheet from "../components/EventoGenericoSheet";
import TurnoSheet from "../components/TurnoSheet";
import AttivitaFiglioSheet from "../components/AttivitaFiglioSheet";

const COLORE_PER_TIPO = { scadenza: C.amber, turno: C.sky, figlio: C.orange, evento: C.violet };

import TransactionModal from "../components/TransactionModal";
import AddMenuSheet from "../components/AddMenuSheet";

const GIORNI_SETTIMANA = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const GIORNI_FULL = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const MESI = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

function startOfWeek(dateStr, settimanaInizio) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = (day - settimanaInizio + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}
function toISO(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }

function buildMonthGrid(dateStr, settimanaInizio) {
  const d = new Date(dateStr + "T00:00:00");
  const primoDelMese = new Date(d.getFullYear(), d.getMonth(), 1);
  const ultimoDelMese = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const inizioGriglia = startOfWeek(toISO(primoDelMese), settimanaInizio);
  const celle = [];
  let cursore = inizioGriglia;
  while (cursore <= ultimoDelMese || celle.length % 7 !== 0) {
    celle.push(toISO(cursore));
    cursore = addDays(cursore, 1);
    if (celle.length > 42) break;
  }
  return { celle, meseCorrente: d.getMonth() };
}

export default function CalendarioPage() {
  const { workspace, member, bumpRefresh, isReader, showToast } = useOutletContext();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [filtroPersona, setFiltroPersona] = useState("tutti");
  const [members, setMembers] = useState([]);
  const [dati, setDati] = useState({ scadenze: [], turni: [], attivita: [], eventi: [] });
  const [loading, setLoading] = useState(true);
  const [apertura, setApertura] = useState(null);
  const [vista, setVista] = useState("mese");
  const [payingId, setPayingId] = useState(null);
  const [addMenuDate, setAddMenuDate] = useState(null); // data per cui si vuole aggiungere qualcosa
  const [nuovoTipo, setNuovoTipo] = useState(null); // tipo scelto dal menu, per la data sopra

  const settimanaInizio = workspace?.settimana_inizio ?? 1;
  const moduli = workspace?.moduli_attivi || {};
  const inizio = useMemo(() => startOfWeek(selectedDate, settimanaInizio), [selectedDate, settimanaInizio]);
  const giorniSettimana = useMemo(() => Array.from({ length: 7 }, (_, i) => toISO(addDays(inizio, i))), [inizio]);
  const meseGrid = useMemo(() => buildMonthGrid(selectedDate, settimanaInizio), [selectedDate, settimanaInizio]);

  const load = React.useCallback(() => {
    if (!workspace) return;
    setLoading(true);
    const da = vista === "mese" ? meseGrid.celle[0] : giorniSettimana[0];
    const a = vista === "mese" ? meseGrid.celle[meseGrid.celle.length - 1] : giorniSettimana[6];
    Promise.all([
      supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
      supabase.from("scadenze").select("*").eq("workspace_id", workspace.id).gte("data_scadenza", da).lte("data_scadenza", a),
      moduli.turni ? supabase.from("turni_assegnati").select("*, aziende(nome)").eq("workspace_id", workspace.id).gte("data", da).lte("data", a) : Promise.resolve({ data: [] }),
      moduli.figli ? supabase.from("entita_attivita").select("*, entita_familiari(nome, tipo, colore, icona)").eq("workspace_id", workspace.id).gte("data", da).lte("data", a) : Promise.resolve({ data: [] }),
      supabase.from("eventi_generici").select("*").eq("workspace_id", workspace.id).gte("data", da).lte("data", a),
    ]).then(([memRes, scadRes, turniRes, attRes, eventRes]) => {
      setMembers(memRes.data || []);
      setDati({ scadenze: scadRes.data || [], turni: turniRes.data || [], attivita: attRes.data || [], eventi: eventRes.data || [] });
      setLoading(false);
    });
  }, [workspace, giorniSettimana, meseGrid, vista, moduli.turni, moduli.figli]);

  useEffect(() => { load(); }, [load]);

  if (!workspace) return null;
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const oggi = todayLocal();

  const eventiPerGiorno = (data) => {
    const passaFiltro = (memberId) => filtroPersona === "tutti" || memberId === filtroPersona;
    const list = [
      ...dati.scadenze.filter((s) => s.data_scadenza === data && passaFiltro(s.member_id)).map((s) => ({ tipo: "scadenza", ora: s.stato === "pagato" ? "Pagata" : "", item: s })),
      ...dati.turni.filter((t) => t.data === data && passaFiltro(t.member_id)).map((t) => ({ tipo: "turno", ora: t.ora_inizio?.slice(0, 5), item: t })),
      ...dati.attivita.filter((a) => a.data === data && (filtroPersona === "tutti" || (a.chi_accompagna_ids || []).includes(filtroPersona) || (a.chi_riprende_ids || []).includes(filtroPersona))).map((a) => ({ tipo: "figlio", ora: a.ora?.slice(0, 5) || "", item: a })),
      ...dati.eventi.filter((e) => e.data === data && (filtroPersona === "tutti" || (e.member_ids || []).includes(filtroPersona))).map((e) => ({ tipo: "evento", ora: e.ora_inizio?.slice(0, 5) || "", item: e })),
    ];
    return list.sort((a, b) => (a.ora || "99:99").localeCompare(b.ora || "99:99"));
  };

  const eventiOggi = eventiPerGiorno(selectedDate);
  const dSel = new Date(selectedDate + "T00:00:00");

  const handleSegnaPagato = async (scadenza) => {
    setPayingId(scadenza.id);
    const { data: tx, error: txError } = await supabase.from("transactions").insert({
      workspace_id: workspace.id, member_id: scadenza.member_id || member?.id,
      date: oggi, mese: oggi.slice(0, 7), tipo: "uscita", importo: scadenza.importo || 0,
      voce: scadenza.titolo, macro_categoria: scadenza.macro_categoria, micro_categoria: scadenza.micro_categoria,
      note: "Generata da una scadenza segnata come pagata",
    }).select().single();
    if (txError) { setPayingId(null); showToast(txError.message, "error"); return; }
    await supabase.from("scadenze").update({ stato: "pagato", data_pagamento: oggi, transaction_id: tx.id }).eq("id", scadenza.id);
    setPayingId(null);
    showToast("Pagamento registrato in Finanza");
    load();
    bumpRefresh?.();
  };

  const handleSheetSaved = () => { setApertura(null); load(); bumpRefresh?.(); };

  const ICONE_TIPO = { scadenza: Receipt, turno: Clock, figlio: Baby, evento: CalendarPlus };
  const COLORI_TIPO = { scadenza: C.amber, turno: C.sky, figlio: C.orange, evento: C.violet };

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 4 }} className="uppercase">Calendario</div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-bold" style={{ fontSize: 26 }}>{MESI[dSel.getMonth() + 1]} {dSel.getFullYear()}</h1>
        {moduli.scadenzePagamenti !== false && (
          <button onClick={() => navigate("/app/scadenze")} className="text-xs font-medium" style={{ color: C.amber, background: "none", border: "none" }}>Tutte le scadenze</button>
        )}
      </div>

      <div style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }} className="uppercase">{selectedDate === oggi ? "Oggi" : "Giorno selezionato"}</div>
            <div className="font-bold" style={{ fontSize: 18, color: C.text, marginTop: 2 }}>{GIORNI_FULL[dSel.getDay()]} {dSel.getDate()} {MESI[dSel.getMonth() + 1]}</div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>{eventiOggi.length} {eventiOggi.length === 1 ? "impegno" : "impegni"}</div>
          </div>
          {!isReader && (
            <button onClick={() => setAddMenuDate(selectedDate)} aria-label="Aggiungi per questo giorno" style={{ width: 36, height: 36, borderRadius: 9999, backgroundColor: C.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none" }}>
              <Plus size={17} color="#0a0b0f" />
            </button>
          )}
        </div>
      </div>
      <div className="font-semibold mb-3" style={{ fontSize: 14, color: C.text }}>
        Attività previste per {selectedDate === oggi ? "oggi" : "questo giorno"} ({GIORNI_FULL[dSel.getDay()]} {dSel.getDate()} {MESI[dSel.getMonth() + 1]} {dSel.getFullYear()})
      </div>

      {loading && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>Caricamento...</div>}
      {!loading && eventiOggi.length === 0 && (
        <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Nessun impegno per questo giorno.</div>
      )}

      <div className="space-y-2.5" style={{ marginBottom: 20 }}>
        {eventiOggi.map(({ tipo, ora, item }) => {
          const Icon = ICONE_TIPO[tipo];
          const color = COLORI_TIPO[tipo];
          const isPaying = payingId === item.id;

          let titolo, sottotitolo;
          if (tipo === "scadenza") {
            titolo = item.titolo;
            sottotitolo = [memberById[item.member_id]?.display_name, item.importo != null ? euroPlain(item.importo) : null].filter(Boolean).join(" · ");
          } else if (tipo === "turno") {
            titolo = `Turno ${item.ora_inizio?.slice(0, 5)}–${item.ora_fine?.slice(0, 5)}`;
            sottotitolo = [memberById[item.member_id]?.display_name, item.modalita === "smart" ? "Smart working" : item.aziende?.nome].filter(Boolean).join(" · ");
          } else if (tipo === "figlio") {
            titolo = item.titolo;
            sottotitolo = [item.entita_familiari?.nome, item.luogo].filter(Boolean).join(" · ");
          } else {
            titolo = item.titolo;
            const nomiPersone = (item.member_ids || []).map((id) => memberById[id]?.display_name).filter(Boolean).join(", ");
            sottotitolo = [nomiPersone, item.luogo].filter(Boolean).join(" · ");
          }

          return (
            <div key={`${tipo}-${item.id}`} className="flex items-center gap-3" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 12 }}>
              {tipo === "scadenza" ? (
                <button onClick={() => !isReader && item.stato === "da_pagare" && handleSegnaPagato(item)} disabled={isReader || item.stato !== "da_pagare" || isPaying} aria-label="Segna pagato" style={{ background: "none", border: "none", flexShrink: 0 }}>
                  {item.stato === "pagato" ? <CheckCircle2 size={20} style={{ color: C.green }} /> : <Circle size={20} style={{ color: C.amber }} />}
                </button>
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={15} style={{ color }} />
                </div>
              )}
              <button onClick={() => setApertura({ tipo, item })} className="flex-1 text-left" style={{ background: "none", border: "none", minWidth: 0 }}>
                <div className="text-sm font-medium truncate" style={{ color: C.text }}>{titolo}</div>
                {sottotitolo && <div className="text-xs truncate" style={{ color: C.muted }}>{sottotitolo}</div>}
              </button>
              {ora && <span className="text-xs flex-shrink-0" style={{ color: C.muted, fontFamily: "monospace" }}>{ora}</span>}
            </div>
          );
        })}
      </div>

      {members.length > 1 && (
        <PillTabs
          options={[{ key: "tutti", label: "Tutta la famiglia" }, ...members.map((m) => ({ key: m.id, label: m.display_name, color: m.colore }))]}
          value={filtroPersona} onChange={setFiltroPersona}
        />
      )}

      <div className="flex gap-2 mb-3">
        {[{ k: "settimana", l: "Settimana" }, { k: "mese", l: "Mese" }].map((v) => {
          const active = vista === v.k;
          return (
            <button key={v.k} onClick={() => setVista(v.k)} className="font-medium" style={{
              padding: "6px 14px", borderRadius: 9999, fontSize: 12,
              backgroundColor: active ? C.violet : C.panel, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? C.violet : C.border}`,
            }}>{v.l}</button>
          );
        })}
      </div>

      {vista === "settimana" ? (
        <div className="flex items-center gap-1 mb-4">
          <button onClick={() => setSelectedDate(toISO(addDays(new Date(selectedDate + "T00:00:00"), -7)))} style={{ background: "none", border: "none", padding: 4, flexShrink: 0 }}>
            <ChevronLeft size={16} style={{ color: C.muted }} />
          </button>
          {giorniSettimana.map((g) => {
            const d = new Date(g + "T00:00:00");
            const active = g === selectedDate;
            const isOggi = g === oggi;
            const tipiDelGiorno = [...new Set(eventiPerGiorno(g).map((e) => e.tipo))];
            return (
              <button key={g} onClick={() => setSelectedDate(g)} className="flex-1 flex flex-col items-center gap-1" style={{
                padding: "8px 2px", borderRadius: 12,
                backgroundColor: active ? C.purple : "transparent",
                border: !active && isOggi ? `1px solid ${C.purple}` : "1px solid transparent",
              }}>
                <span style={{ fontSize: 9, color: active ? "#0a0b0f" : C.muted, fontWeight: 600 }}>{GIORNI_SETTIMANA[d.getDay()]}</span>
                <span style={{ fontSize: 14, color: active ? "#0a0b0f" : C.text, fontWeight: 700 }}>{d.getDate()}</span>
                <div className="flex gap-0.5" style={{ minHeight: 4 }}>
                  {tipiDelGiorno.slice(0, 4).map((t) => <div key={t} style={{ width: 4, height: 4, borderRadius: 9999, backgroundColor: active ? "#0a0b0f" : COLORE_PER_TIPO[t] }} />)}
                </div>
              </button>
            );
          })}
          <button onClick={() => setSelectedDate(toISO(addDays(new Date(selectedDate + "T00:00:00"), 7)))} style={{ background: "none", border: "none", padding: 4, flexShrink: 0 }}>
            <ChevronRight size={16} style={{ color: C.muted }} />
          </button>
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setSelectedDate(toISO(addDays(new Date(selectedDate + "T00:00:00"), -28)))} style={{ background: "none", border: "none", padding: 4 }}>
              <ChevronLeft size={16} style={{ color: C.muted }} />
            </button>
            <span className="text-xs font-medium" style={{ color: C.muted }}>{GIORNI_SETTIMANA.length && MESI[new Date(selectedDate + "T00:00:00").getMonth() + 1]}</span>
            <button onClick={() => setSelectedDate(toISO(addDays(new Date(selectedDate + "T00:00:00"), 28)))} style={{ background: "none", border: "none", padding: 4 }}>
              <ChevronRight size={16} style={{ color: C.muted }} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {GIORNI_SETTIMANA.map((g, i) => (
              <div key={i} className="text-center" style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>{g[0]}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {meseGrid.celle.map((g) => {
              const d = new Date(g + "T00:00:00");
              const active = g === selectedDate;
              const isOggi = g === oggi;
              const fuoriMese = d.getMonth() !== meseGrid.meseCorrente;
              const tipiDelGiorno = [...new Set(eventiPerGiorno(g).map((e) => e.tipo))];
              return (
                <button key={g} onClick={() => setSelectedDate(g)} className="flex flex-col items-center justify-center gap-0.5" style={{
                  aspectRatio: "1", borderRadius: 9,
                  backgroundColor: active ? C.purple : "transparent",
                  border: !active && isOggi ? `1px solid ${C.purple}` : "1px solid transparent",
                  opacity: fuoriMese ? 0.35 : 1,
                }}>
                  <span style={{ fontSize: 11, color: active ? "#0a0b0f" : C.text, fontWeight: isOggi ? 700 : 500 }}>{d.getDate()}</span>
                  <div className="flex gap-0.5" style={{ minHeight: 3.5 }}>
                    {tipiDelGiorno.slice(0, 3).map((t) => <div key={t} style={{ width: 3.5, height: 3.5, borderRadius: 9999, backgroundColor: active ? "#0a0b0f" : COLORE_PER_TIPO[t] }} />)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {apertura?.tipo === "scadenza" && (
        <ScadenzaSheet workspace={workspace} existing={apertura.item} onClose={() => setApertura(null)} onSaved={handleSheetSaved} />
      )}
      {apertura?.tipo === "evento" && (
        <EventoGenericoSheet workspace={workspace} existing={apertura.item} onClose={() => setApertura(null)} onSaved={handleSheetSaved} onDeleted={handleSheetSaved} />
      )}
      {apertura?.tipo === "turno" && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 56 }} onClick={() => setApertura(null)}>
          <div style={{ width: "100%", maxWidth: 384, backgroundColor: C.panel2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="text-sm mb-3" style={{ color: C.text }}>Turno {apertura.item.ora_inizio?.slice(0, 5)}–{apertura.item.ora_fine?.slice(0, 5)}, {memberById[apertura.item.member_id]?.display_name}</div>
            {!isReader && (
              <button onClick={async () => { const { error } = await supabase.from("turni_assegnati").delete().eq("id", apertura.item.id); if (error) { showToast("Eliminazione non riuscita: " + error.message, "error"); return; } showToast("Turno eliminato"); setApertura(null); load(); }} className="w-full font-medium" style={{ padding: "12px 0", borderRadius: 14, fontSize: 13, backgroundColor: "transparent", color: C.red, border: `1px solid ${C.red}` }}>
                Elimina turno
              </button>
            )}
          </div>
        </div>
      )}
      {apertura?.tipo === "figlio" && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 56 }} onClick={() => setApertura(null)}>
          <div style={{ width: "100%", maxWidth: 384, backgroundColor: C.panel2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="text-sm mb-1" style={{ color: C.text }}>{apertura.item.titolo}</div>
            <div className="text-xs mb-3" style={{ color: C.muted }}>{apertura.item.entita_familiari?.nome}{apertura.item.luogo ? ` · ${apertura.item.luogo}` : ""}</div>
            {!isReader && (
              <button onClick={async () => { const { error } = await supabase.from("entita_attivita").delete().eq("id", apertura.item.id); if (error) { showToast("Eliminazione non riuscita: " + error.message, "error"); return; } showToast("Attività eliminata"); setApertura(null); load(); }} className="w-full font-medium" style={{ padding: "12px 0", borderRadius: 14, fontSize: 13, backgroundColor: "transparent", color: C.red, border: `1px solid ${C.red}` }}>
                Elimina
              </button>
            )}
          </div>
        </div>
      )}
      {addMenuDate && !nuovoTipo && (
        <AddMenuSheet
          moduli={moduli}
          onClose={() => setAddMenuDate(null)}
          onSelect={(key) => {
            if (key === "lista") { setAddMenuDate(null); navigate("/app/attivita"); return; }
            setNuovoTipo(key);
          }}
        />
      )}
      {nuovoTipo === "transazione" && workspace && member && (
        <TransactionModal workspace={workspace} member={member} defaultDate={addMenuDate} zIndex={56}
          onClose={() => { setNuovoTipo(null); setAddMenuDate(null); }}
          onSaved={() => { setNuovoTipo(null); setAddMenuDate(null); bumpRefresh?.(); }} />
      )}
      {nuovoTipo === "scadenza" && workspace && (
        <ScadenzaSheet workspace={workspace} defaultDate={addMenuDate}
          onClose={() => { setNuovoTipo(null); setAddMenuDate(null); }}
          onSaved={() => { setNuovoTipo(null); setAddMenuDate(null); load(); bumpRefresh?.(); }} />
      )}
      {nuovoTipo === "turno" && workspace && (
        <TurnoSheet workspace={workspace} member={member} defaultDate={addMenuDate}
          onClose={() => { setNuovoTipo(null); setAddMenuDate(null); }}
          onSaved={() => { setNuovoTipo(null); setAddMenuDate(null); load(); bumpRefresh?.(); showToast("Turno salvato"); }} />
      )}
      {nuovoTipo === "evento" && workspace && (
        <EventoGenericoSheet workspace={workspace} defaultDate={addMenuDate}
          onClose={() => { setNuovoTipo(null); setAddMenuDate(null); }}
          onSaved={() => { setNuovoTipo(null); setAddMenuDate(null); load(); bumpRefresh?.(); }} />
      )}
      {nuovoTipo === "figlio" && workspace && (
        <AttivitaFiglioSheet workspace={workspace} defaultDate={addMenuDate}
          onClose={() => { setNuovoTipo(null); setAddMenuDate(null); }}
          onSaved={() => { setNuovoTipo(null); setAddMenuDate(null); load(); bumpRefresh?.(); showToast("Attività salvata"); }} />
      )}
    </div>
  );
}
