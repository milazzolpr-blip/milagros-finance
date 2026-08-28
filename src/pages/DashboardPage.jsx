import React, { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Wallet, ListChecks, ChevronRight, ChevronLeft, Receipt, Clock, Baby, Square, CalendarPlus } from "lucide-react";
import { C, euro, euroPlain, todayLocal } from "../theme";
import { SectionLabel } from "../components/ui";
import { supabase } from "../lib/supabase";
import { fetchAllTransactions } from "../lib/fetchAllTransactions";

const MODULO_COLOR = { calendario: C.violet, finanza: C.green, scadenze: C.amber, turni: C.sky, figli: C.orange, liste: C.fuchsia };
const MODULO_ICON = { scadenze: Receipt, turni: Clock, figli: Baby, calendario: CalendarPlus, finanza: Wallet };

function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function addGiorni(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function MiniCardHeader({ icon: Icon, color, label }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={12} style={{ color }} />
      </div>
      <span style={{ fontSize: 11, letterSpacing: "0.05em", color, fontWeight: 700, lineHeight: 1 }} className="uppercase">{label}</span>
    </div>
  );
}

function SectionCard({ icon: Icon, iconColor, eyebrow, title, subtitle, empty, onClick, children }) {
  return (
    <button onClick={onClick} className="w-full text-left" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, marginBottom: 12, display: "block" }}>
      <MiniCardHeader icon={Icon} color={iconColor} label={eyebrow} />
      <div className="font-bold" style={{ fontSize: 17, color: C.text, marginBottom: subtitle || empty ? 2 : 8 }}>{title}</div>
      {subtitle && !empty && <div className="text-xs mb-2" style={{ color: C.muted }}>{subtitle}</div>}
      {empty && <div className="text-xs mb-2" style={{ color: C.muted, fontStyle: "italic" }}>{empty}</div>}
      {children}
      <div className="flex items-center gap-0.5 mt-2" style={{ color: C.muted, fontSize: 11 }}>
        Apri <ChevronRight size={11} />
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const { workspace, member } = useOutletContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nastroOggi, setNastroOggi] = useState([]);
  const [settimana, setSettimana] = useState([]);
  const [settimanaAncora, setSettimanaAncora] = useState(todayLocal());
  const [caricandoSettimana, setCaricandoSettimana] = useState(false);
  const [eventiPerGiornoMap, setEventiPerGiornoMap] = useState({});
  const [giornoAnteprima, setGiornoAnteprima] = useState(null);
  const [saldoMese, setSaldoMese] = useState(0);
  const [deltaSaldo, setDeltaSaldo] = useState(null);
  const [saldoComplessivo, setSaldoComplessivo] = useState(null);
  const [listeCount, setListeCount] = useState(0);
  const [listeAnteprima, setListeAnteprima] = useState([]);
  const [articoliDaFare, setArticoliDaFare] = useState(0);
  const [scadenzeDaPagare, setScadenzeDaPagare] = useState(0);
  const [prossimeScadenze, setProssimeScadenze] = useState([]);
  const [turniOggiPerPersona, setTurniOggiPerPersona] = useState([]);
  const [entitaCount, setEntitaCount] = useState(0);
  const [attivitaProssime, setAttivitaProssime] = useState(0);
  const [prossimeAttivitaFigli, setProssimeAttivitaFigli] = useState([]);

  const moduli = workspace?.moduli_attivi || {};
  const oggi = todayLocal();
  const fineSettimana = addGiorni(oggi, 6);

  const caricaAnteprimaListe = React.useCallback(async () => {
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("liste_articoli")
        .select("id, testo, completato, liste!inner(workspace_id, nome)")
        .eq("liste.workspace_id", workspace.id)
        .eq("completato", false)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("liste_articoli")
        .select("id, liste!inner(workspace_id)", { count: "exact", head: true })
        .eq("liste.workspace_id", workspace.id)
        .eq("completato", false),
    ]);
    setListeAnteprima(data || []);
    setArticoliDaFare(count || 0);
  }, [workspace]);

  const toggleAnteprimaArticolo = async (id) => {
    setListeAnteprima((prev) => prev.filter((a) => a.id !== id));
    setArticoliDaFare((prev) => Math.max(0, prev - 1));
    const { error } = await supabase.from("liste_articoli").update({ completato: true }).eq("id", id);
    if (error) caricaAnteprimaListe();
  };

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const jobs = [];

      // ---------- Nastro del giorno + settimana a colpo d'occhio: un'unica finestra di 7 giorni ----------
      if (moduli.calendario !== false) {
        jobs.push(
          Promise.all([
            supabase.from("scadenze").select("id, titolo, data_scadenza, importo, member_id, stato").eq("workspace_id", workspace.id).gte("data_scadenza", oggi).lte("data_scadenza", fineSettimana),
            moduli.turni ? supabase.from("turni_assegnati").select("id, data, ora_inizio, ora_fine, modalita, member_id, aziende(nome)").eq("workspace_id", workspace.id).gte("data", oggi).lte("data", fineSettimana) : Promise.resolve({ data: [] }),
            supabase.from("eventi_generici").select("id, titolo, data, ora_inizio, member_ids").eq("workspace_id", workspace.id).gte("data", oggi).lte("data", fineSettimana),
            moduli.figli ? supabase.from("entita_attivita").select("id, titolo, data, ora, chi_accompagna_ids, chi_riprende_ids, entita_familiari(nome)").eq("workspace_id", workspace.id).gte("data", oggi).lte("data", fineSettimana) : Promise.resolve({ data: [] }),
            supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
          ]).then(([scadRes, turniRes, eventiRes, attRes, memRes]) => {
            if (cancelled) return;
            const membriById = Object.fromEntries((memRes.data || []).map((m) => [m.id, m]));

            const tuttiConAutore = [
              ...(scadRes.data || []).map((s) => ({ tipo: "scadenze", data: s.data_scadenza, ora: "", titolo: s.titolo, sotto: [membriById[s.member_id]?.display_name, s.importo != null ? euroPlain(s.importo) : null].filter(Boolean).join(" · "), autori: [s.member_id].filter(Boolean) })),
              ...(turniRes.data || []).map((t) => ({ tipo: "turni", data: t.data, ora: t.ora_inizio?.slice(0, 5), titolo: `Turno ${t.ora_inizio?.slice(0, 5)}–${t.ora_fine?.slice(0, 5)}`, sotto: [membriById[t.member_id]?.display_name, t.modalita === "smart" ? "Smart working" : t.aziende?.nome].filter(Boolean).join(" · "), autori: [t.member_id].filter(Boolean) })),
              ...(eventiRes.data || []).map((e) => ({ tipo: "calendario", data: e.data, ora: e.ora_inizio?.slice(0, 5) || "", titolo: e.titolo, sotto: (e.member_ids || []).map((id) => membriById[id]?.display_name).filter(Boolean).join(", "), autori: e.member_ids || [] })),
              ...(attRes.data || []).map((a) => ({ tipo: "figli", data: a.data, ora: a.ora?.slice(0, 5) || "", titolo: a.titolo, sotto: a.entita_familiari?.nome || "", autori: [...(a.chi_accompagna_ids || []), ...(a.chi_riprende_ids || [])] })),
            ];

            // preferenza personale, indipendente per ciascun account: mostro anche gli
            // elementi degli altri membri, oppure solo i miei (in cui compaio come autore)
            const mostraAltri = member?.nastro_mostra_altri !== false;
            const tutti = mostraAltri ? tuttiConAutore : tuttiConAutore.filter((e) => e.autori.length === 0 || e.autori.includes(member?.id));

            setNastroOggi(tutti.filter((e) => e.data === oggi).sort((a, b) => (a.ora || "99:99").localeCompare(b.ora || "99:99")));

            const idsDaMostrare = [member?.id, ...(member?.turni_visibili_ids || [])].filter(Boolean);
            const turniDiOggi = (turniRes.data || []).filter((t) => t.data === oggi);
            const perPersona = idsDaMostrare.map((id) => ({
              memberId: id,
              nome: id === member?.id ? "Tu" : (membriById[id]?.display_name || "?"),
              colore: id === member?.id ? (member?.colore || C.purple) : (membriById[id]?.colore || C.purple),
              turno: turniDiOggi.find((t) => t.member_id === id) || null,
            }));
            setTurniOggiPerPersona(perPersona);
          })
        );
      }

      if (moduli.finanza !== false) {
        jobs.push(
          Promise.all([
            fetchAllTransactions(workspace.id, { mese: currentMonthStr() }),
            fetchAllTransactions(workspace.id, { mese: (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })() }),
            fetchAllTransactions(workspace.id),
          ]).then(([tx, txPrev, txTutte]) => {
            if (cancelled) return;
            const entrate = tx.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0);
            const spese = tx.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0);
            setSaldoMese(entrate - spese);
            if (txPrev.length > 0) {
              const entratePrev = txPrev.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0);
              const spesePrev = txPrev.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0);
              setDeltaSaldo((entrate - spese) - (entratePrev - spesePrev));
            }
            const entrateTutte = txTutte.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0);
            const speseTutte = txTutte.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0);
            setSaldoComplessivo(entrateTutte - speseTutte);
          })
        );
      }
      if (moduli.liste) {
        jobs.push(
          supabase.from("liste").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id)
            .then(({ count }) => { if (!cancelled) setListeCount(count || 0); })
        );
        jobs.push(caricaAnteprimaListe());
      }
      if (moduli.scadenzePagamenti !== false) {
        jobs.push(
          Promise.all([
            supabase.from("scadenze").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("stato", "da_pagare"),
            supabase.from("scadenze").select("id, titolo, data_scadenza, importo, member_id, workspace_members(display_name)").eq("workspace_id", workspace.id).eq("stato", "da_pagare").order("data_scadenza", { ascending: true }).limit(5),
          ]).then(([countRes, nextRes]) => {
            if (cancelled) return;
            setScadenzeDaPagare(countRes.count || 0);
            setProssimeScadenze(nextRes.data || []);
          })
        );
      }
      if (moduli.figli) {
        jobs.push(
          Promise.all([
            supabase.from("entita_familiari").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
            supabase.from("entita_attivita").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).gte("data", oggi),
            supabase.from("entita_attivita").select("id, titolo, data, ora, entita_familiari(nome)").eq("workspace_id", workspace.id).gte("data", oggi).order("data", { ascending: true }).order("ora", { ascending: true }).limit(5),
          ]).then(([e, a, lista]) => { if (!cancelled) { setEntitaCount(e.count || 0); setAttivitaProssime(a.count || 0); setProssimeAttivitaFigli(lista.data || []); } })
        );
      }

      await Promise.all(jobs);
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [workspace, member]); // eslint-disable-line

  // ---------- La settimana a colpo d'occhio: finestra indipendente, navigabile avanti/indietro ----------
  useEffect(() => {
    if (!workspace || moduli.calendario === false) return;
    let cancelled = false;
    const fineFinestra = addGiorni(settimanaAncora, 6);

    async function caricaSettimana() {
      setCaricandoSettimana(true);
      const [scadRes, turniRes, eventiRes, attRes, memRes] = await Promise.all([
        supabase.from("scadenze").select("id, titolo, data_scadenza, importo, member_id, stato").eq("workspace_id", workspace.id).gte("data_scadenza", settimanaAncora).lte("data_scadenza", fineFinestra),
        moduli.turni ? supabase.from("turni_assegnati").select("id, data, ora_inizio, ora_fine, modalita, member_id, aziende(nome)").eq("workspace_id", workspace.id).gte("data", settimanaAncora).lte("data", fineFinestra) : Promise.resolve({ data: [] }),
        supabase.from("eventi_generici").select("id, titolo, data, ora_inizio, member_ids").eq("workspace_id", workspace.id).gte("data", settimanaAncora).lte("data", fineFinestra),
        moduli.figli ? supabase.from("entita_attivita").select("id, titolo, data, ora, chi_accompagna_ids, chi_riprende_ids, entita_familiari(nome)").eq("workspace_id", workspace.id).gte("data", settimanaAncora).lte("data", fineFinestra) : Promise.resolve({ data: [] }),
        supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
      ]);
      if (cancelled) return;

      const membriById = Object.fromEntries((memRes.data || []).map((m) => [m.id, m]));
      const tuttiConAutore = [
        ...(scadRes.data || []).map((s) => ({ tipo: "scadenze", data: s.data_scadenza, ora: "", titolo: s.titolo, sotto: [membriById[s.member_id]?.display_name, s.importo != null ? euroPlain(s.importo) : null].filter(Boolean).join(" · "), autori: [s.member_id].filter(Boolean) })),
        ...(turniRes.data || []).map((t) => ({ tipo: "turni", data: t.data, ora: t.ora_inizio?.slice(0, 5), titolo: `Turno ${t.ora_inizio?.slice(0, 5)}–${t.ora_fine?.slice(0, 5)}`, sotto: [membriById[t.member_id]?.display_name, t.modalita === "smart" ? "Smart working" : t.aziende?.nome].filter(Boolean).join(" · "), autori: [t.member_id].filter(Boolean) })),
        ...(eventiRes.data || []).map((e) => ({ tipo: "calendario", data: e.data, ora: e.ora_inizio?.slice(0, 5) || "", titolo: e.titolo, sotto: (e.member_ids || []).map((id) => membriById[id]?.display_name).filter(Boolean).join(", "), autori: e.member_ids || [] })),
        ...(attRes.data || []).map((a) => ({ tipo: "figli", data: a.data, ora: a.ora?.slice(0, 5) || "", titolo: a.titolo, sotto: a.entita_familiari?.nome || "", autori: [...(a.chi_accompagna_ids || []), ...(a.chi_riprende_ids || [])] })),
      ];

      const mostraAltri = member?.nastro_mostra_altri !== false;
      const tutti = mostraAltri ? tuttiConAutore : tuttiConAutore.filter((e) => e.autori.length === 0 || e.autori.includes(member?.id));

      const perGiorno = {};
      tutti.forEach((e) => { if (!perGiorno[e.data]) perGiorno[e.data] = []; perGiorno[e.data].push(e); });
      Object.values(perGiorno).forEach((lista) => lista.sort((a, b) => (a.ora || "99:99").localeCompare(b.ora || "99:99")));
      setEventiPerGiornoMap(perGiorno);
      const giorni = Array.from({ length: 7 }, (_, i) => addGiorni(settimanaAncora, i));
      setSettimana(giorni.map((data) => ({ data, tipi: [...new Set((perGiorno[data] || []).map((e) => e.tipo))] })));
      setCaricandoSettimana(false);
    }
    caricaSettimana();
    return () => { cancelled = true; };
  }, [settimanaAncora, workspace, member]); // eslint-disable-line

  const settimanaPrecedente = () => { setGiornoAnteprima(null); setSettimanaAncora((a) => addGiorni(a, -7)); };
  const settimanaSuccessiva = () => { setGiornoAnteprima(null); setSettimanaAncora((a) => addGiorni(a, 7)); };
  const tornaSettimanaOggi = () => { setGiornoAnteprima(null); setSettimanaAncora(todayLocal()); };

  if (!workspace) return null;

  return (
    <div>
      <div className="text-sm mb-1" style={{ color: C.muted }}>
        {new Date(oggi + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
      </div>
      <h1 className="font-bold mb-4" style={{ fontSize: 25 }}>Ciao{member?.display_name ? ` ${member.display_name}` : ""}</h1>

      {loading ? (
        <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>Caricamento...</div>
      ) : (
        <>
          {moduli.calendario !== false && nastroOggi.length > 0 && (
            <>
              <SectionLabel color={C.violet}>Il nastro del giorno</SectionLabel>
              <div className="flex gap-2.5" style={{ overflowX: "auto", paddingBottom: 4, marginBottom: 18 }}>
                {nastroOggi.map((item, i) => {
                  const colore = MODULO_COLOR[item.tipo];
                  const Icon = MODULO_ICON[item.tipo];
                  const dest = item.tipo === "finanza" ? "/app/finanza" : item.tipo === "figli" ? "/app/attivita" : "/app/calendario";
                  return (
                    <button key={i} onClick={() => navigate(dest)} style={{ flexShrink: 0, minWidth: 108, backgroundColor: C.panel, border: `1px solid ${colore}44`, borderRadius: 16, padding: "12px 14px", textAlign: "left" }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: `${colore}22`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}><Icon size={12} style={{ color: colore }} /></div>
                      <div style={{ fontSize: 11, color: colore, fontWeight: 700, marginBottom: 2 }}>{item.ora}</div>
                      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.3 }} className="truncate">{item.titolo}</div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {moduli.calendario !== false && (
            <>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel color={C.sky}>La settimana a colpo d'occhio</SectionLabel>
                {settimanaAncora !== oggi && (
                  <button onClick={tornaSettimanaOggi} className="text-xs font-medium" style={{ color: C.purple, background: "none", border: "none" }}>Torna a oggi</button>
                )}
              </div>

              <div className="flex items-center gap-1 mb-2">
                <button onClick={settimanaPrecedente} aria-label="Settimana precedente" style={{ width: 28, height: 28, borderRadius: 9999, backgroundColor: C.panel, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <ChevronLeft size={14} style={{ color: C.text }} />
                </button>
                <div style={{ flex: 1, backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 8px", opacity: caricandoSettimana ? 0.5 : 1, transition: "opacity 0.15s" }}>
                  <div className="flex justify-between">
                    {settimana.map((g) => {
                      const d = new Date(g.data + "T00:00:00");
                      const isOggi = g.data === oggi;
                      const isAperto = g.data === giornoAnteprima;
                      return (
                        <button key={g.data} onClick={() => setGiornoAnteprima(isAperto ? null : g.data)} className="flex flex-col items-center gap-1" style={{ padding: "2px 4px", borderRadius: 10, border: "none", backgroundColor: isAperto ? C.purple : isOggi ? C.purpleSoft : "transparent" }}>
                          <span style={{ fontSize: 9, color: isAperto ? "#0a0b0f" : isOggi ? C.purple : C.muted, fontWeight: 700 }}>{["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"][d.getDay()]}</span>
                          <span style={{ fontSize: 12.5, color: isAperto ? "#0a0b0f" : isOggi ? C.purple : C.text, fontWeight: isOggi || isAperto ? 800 : 500 }}>{d.getDate()}</span>
                          <div className="flex gap-0.5" style={{ minHeight: 4 }}>
                            {g.tipi.slice(0, 3).map((t, i) => <div key={i} style={{ width: 3.5, height: 3.5, borderRadius: 9999, backgroundColor: isAperto ? "#0a0b0f" : MODULO_COLOR[t] }} />)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button onClick={settimanaSuccessiva} aria-label="Settimana successiva" style={{ width: 28, height: 28, borderRadius: 9999, backgroundColor: C.panel, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <ChevronRight size={14} style={{ color: C.text }} />
                </button>
              </div>

              {giornoAnteprima && (() => {
                const dAnt = new Date(giornoAnteprima + "T00:00:00");
                const eventiGiorno = eventiPerGiornoMap[giornoAnteprima] || [];
                return (
                  <div style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 18 }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color: C.text }}>{["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"][dAnt.getDay()]} {dAnt.getDate()}</span>
                      <button onClick={() => navigate("/app/calendario")} className="text-xs font-medium" style={{ color: C.purple, background: "none", border: "none" }}>Apri Calendario</button>
                    </div>
                    {eventiGiorno.length === 0 ? (
                      <div className="text-xs" style={{ color: C.muted, fontStyle: "italic" }}>Nessun impegno per questo giorno.</div>
                    ) : (
                      <div className="space-y-2">
                        {eventiGiorno.map((e, i) => {
                          const Icon = MODULO_ICON[e.tipo];
                          const colore = MODULO_COLOR[e.tipo];
                          return (
                            <div key={i} className="flex items-center gap-2.5">
                              <div style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: `${colore}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={11} style={{ color: colore }} /></div>
                              <span className="text-xs" style={{ color: C.text, flex: 1 }} title={e.titolo}>{e.titolo}</span>
                              {e.ora && <span className="text-xs" style={{ color: C.muted, fontFamily: "monospace", flexShrink: 0 }}>{e.ora}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}

          <SectionLabel color={C.muted}>Uno sguardo d'insieme</SectionLabel>

          <div style={{ display: "flex", alignItems: "stretch", gap: 10, marginBottom: 10 }}>
            {moduli.finanza !== false && (
              <button onClick={() => navigate("/app/finanza")} className="text-left" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
                <MiniCardHeader icon={Wallet} color={C.green} label="Saldi" />

                <div style={{ fontSize: 10, letterSpacing: "0.05em", color: C.muted, fontWeight: 700, marginBottom: 3 }} className="uppercase">Mese</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: saldoMese >= 0 ? C.green : C.red, fontFamily: "monospace" }}>{euro(saldoMese)}</div>
                {deltaSaldo !== null && (
                  <div className="text-xs" style={{ color: C.muted, marginTop: 3 }}>{euro(deltaSaldo)} vs scorso</div>
                )}

                {saldoComplessivo !== null && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, letterSpacing: "0.05em", color: C.muted, fontWeight: 700, marginBottom: 3 }} className="uppercase">Complessivo</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: saldoComplessivo >= 0 ? C.green : C.red, fontFamily: "monospace" }}>{euro(saldoComplessivo)}</div>
                  </div>
                )}
              </button>
            )}

            {moduli.turni && (
              <button onClick={() => navigate("/app/calendario")} className="text-left" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
                <MiniCardHeader icon={Clock} color={C.sky} label="Turno di oggi" />
                {turniOggiPerPersona.length === 0 ? (
                  <div className="text-xs" style={{ color: C.muted, fontStyle: "italic" }}>Nessun turno oggi</div>
                ) : (
                  <div>
                    {turniOggiPerPersona.map((p, i) => (
                      <div key={p.memberId} style={{ padding: "8px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <div style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: p.colore, flexShrink: 0 }} />
                          <span className="text-sm font-medium truncate" style={{ color: C.text }}>{p.nome}</span>
                        </div>
                        {p.turno ? (
                          <div className="text-sm font-bold" style={{ color: C.text, fontFamily: "monospace" }}>{p.turno.ora_inizio?.slice(0, 5)} – {p.turno.ora_fine?.slice(0, 5)}</div>
                        ) : (
                          <div className="text-xs" style={{ color: C.muted, fontStyle: "italic" }}>Libero</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            )}
          </div>

          {(moduli.figli || moduli.scadenzePagamenti !== false) && (
            <div style={{ display: "flex", alignItems: "stretch", gap: 10, marginBottom: 10 }}>
              {moduli.figli && (
                <button onClick={() => navigate("/app/attivita")} className="text-left" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
                  <MiniCardHeader icon={Baby} color={C.orange} label={workspace.nome_modulo_figli || "Figli"} />
                  {entitaCount === 0 ? (
                    <div className="text-xs" style={{ color: C.muted, fontStyle: "italic" }}>Nessuno aggiunto ancora</div>
                  ) : prossimeAttivitaFigli.length === 0 ? (
                    <div className="text-xs" style={{ color: C.muted, fontStyle: "italic" }}>Nessuna attività in programma</div>
                  ) : (
                    <div className="w-full">
                      {prossimeAttivitaFigli.map((a) => (
                        <div key={a.id} className="flex justify-between gap-2 text-xs" style={{ padding: "3px 0" }}>
                          <span className="truncate" style={{ color: C.text }}>{a.entita_familiari?.nome ? `${a.entita_familiari.nome} · ` : ""}{a.titolo}</span>
                          <span style={{ color: C.muted, flexShrink: 0 }}>{a.data === oggi ? "Oggi" : a.data.slice(8, 10) + "/" + a.data.slice(5, 7)}</span>
                        </div>
                      ))}
                      {attivitaProssime > prossimeAttivitaFigli.length && (
                        <div className="text-xs font-medium" style={{ color: C.orange, marginTop: 4 }}>Vedi tutte ({attivitaProssime}) →</div>
                      )}
                    </div>
                  )}
                </button>
              )}

              {moduli.scadenzePagamenti !== false && (
                <button onClick={() => navigate("/app/scadenze")} className="text-left" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
                  <MiniCardHeader icon={Receipt} color={C.amber} label="Scadenze" />
                  {prossimeScadenze.length === 0 ? (
                    <div className="text-xs" style={{ color: C.muted, fontStyle: "italic" }}>Nessuna scadenza in sospeso</div>
                  ) : (
                    <div className="w-full">
                      {prossimeScadenze.map((s) => (
                        <div key={s.id} className="flex justify-between gap-2 text-xs" style={{ padding: "3px 0" }}>
                          <span className="truncate" style={{ color: C.text }}>{s.titolo}</span>
                          <span style={{ color: C.muted, flexShrink: 0 }}>{s.importo != null ? euroPlain(s.importo) : (s.data_scadenza === oggi ? "Oggi" : s.data_scadenza.slice(8, 10) + "/" + s.data_scadenza.slice(5, 7))}</span>
                        </div>
                      ))}
                      {scadenzeDaPagare > prossimeScadenze.length && (
                        <div className="text-xs font-medium" style={{ color: C.amber, marginTop: 4 }}>Vedi tutte ({scadenzeDaPagare}) →</div>
                      )}
                    </div>
                  )}
                </button>
              )}
            </div>
          )}

          {moduli.liste && (
            <SectionCard
              icon={ListChecks} iconColor={C.fuchsia} eyebrow="Liste" title={listeCount === 0 ? "Nessuna lista ancora" : `${listeCount} ${listeCount === 1 ? "lista attiva" : "liste attive"}`}
              empty={listeCount === 0 ? "Il modulo è attivo — crea la prima lista da qui." : null}
              onClick={() => navigate("/app/attivita")}
            >
              {listeAnteprima.length > 0 && (
                <div className="space-y-1.5 mb-1" onClick={(e) => e.stopPropagation()}>
                  {listeAnteprima.map((a) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <button onClick={() => toggleAnteprimaArticolo(a.id)} style={{ background: "none", border: "none", flexShrink: 0, padding: 0 }}>
                        <Square size={15} style={{ color: C.muted }} />
                      </button>
                      <span className="text-xs truncate" style={{ color: C.text }}>{a.testo}</span>
                      <span className="text-xs truncate" style={{ color: C.muted, flexShrink: 0 }}>· {a.liste?.nome}</span>
                    </div>
                  ))}
                </div>
              )}
              {articoliDaFare > listeAnteprima.length && (
                <div className="text-xs font-medium" style={{ color: C.fuchsia, marginTop: 4 }}>Vedi tutte ({articoliDaFare}) →</div>
              )}
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
