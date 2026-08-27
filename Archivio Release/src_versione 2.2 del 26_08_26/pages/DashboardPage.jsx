import React, { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Wallet, ListChecks, ChevronRight, Receipt, Clock, Baby, Square, CalendarPlus } from "lucide-react";
import { C, euro, euroPlain, todayLocal } from "../theme";
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

function SectionCard({ icon: Icon, iconColor, eyebrow, title, subtitle, empty, onClick, children }) {
  return (
    <button onClick={onClick} className="w-full text-left" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, marginBottom: 12, display: "block" }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color: iconColor }} />
        <span style={{ fontSize: 10.5, letterSpacing: "0.08em", color: iconColor, fontWeight: 700 }} className="uppercase">{eyebrow}</span>
      </div>
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
  const [saldoMese, setSaldoMese] = useState(0);
  const [deltaSaldo, setDeltaSaldo] = useState(null);
  const [listeCount, setListeCount] = useState(0);
  const [listeAnteprima, setListeAnteprima] = useState([]);
  const [scadenzeDaPagare, setScadenzeDaPagare] = useState(0);
  const [prossimaScadenza, setProssimaScadenza] = useState(null);
  const [turnoOggi, setTurnoOggi] = useState(null);
  const [entitaCount, setEntitaCount] = useState(0);
  const [attivitaProssime, setAttivitaProssime] = useState(0);

  const moduli = workspace?.moduli_attivi || {};
  const oggi = todayLocal();
  const fineSettimana = addGiorni(oggi, 6);

  const caricaAnteprimaListe = React.useCallback(async () => {
    const { data } = await supabase
      .from("liste_articoli")
      .select("id, testo, completato, liste!inner(workspace_id, nome)")
      .eq("liste.workspace_id", workspace.id)
      .eq("completato", false)
      .order("created_at", { ascending: false })
      .limit(3);
    setListeAnteprima(data || []);
  }, [workspace]);

  const toggleAnteprimaArticolo = async (id) => {
    setListeAnteprima((prev) => prev.filter((a) => a.id !== id));
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
            supabase.from("eventi_generici").select("id, titolo, data, ora_inizio, member_id").eq("workspace_id", workspace.id).gte("data", oggi).lte("data", fineSettimana),
            moduli.figli ? supabase.from("entita_attivita").select("id, titolo, data, ora, entita_familiari(nome)").eq("workspace_id", workspace.id).gte("data", oggi).lte("data", fineSettimana) : Promise.resolve({ data: [] }),
            supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
          ]).then(([scadRes, turniRes, eventiRes, attRes, memRes]) => {
            if (cancelled) return;
            const membriById = Object.fromEntries((memRes.data || []).map((m) => [m.id, m]));

            const tutti = [
              ...(scadRes.data || []).map((s) => ({ tipo: "scadenze", data: s.data_scadenza, ora: "", titolo: s.titolo, sotto: [membriById[s.member_id]?.display_name, s.importo != null ? euroPlain(s.importo) : null].filter(Boolean).join(" · ") })),
              ...(turniRes.data || []).map((t) => ({ tipo: "turni", data: t.data, ora: t.ora_inizio?.slice(0, 5), titolo: `Turno ${t.ora_inizio?.slice(0, 5)}–${t.ora_fine?.slice(0, 5)}`, sotto: [membriById[t.member_id]?.display_name, t.modalita === "smart" ? "Smart working" : t.aziende?.nome].filter(Boolean).join(" · "), member_id: t.member_id })),
              ...(eventiRes.data || []).map((e) => ({ tipo: "calendario", data: e.data, ora: e.ora_inizio?.slice(0, 5) || "", titolo: e.titolo, sotto: membriById[e.member_id]?.display_name || "" })),
              ...(attRes.data || []).map((a) => ({ tipo: "figli", data: a.data, ora: a.ora?.slice(0, 5) || "", titolo: a.titolo, sotto: a.entita_familiari?.nome || "" })),
            ];

            setNastroOggi(tutti.filter((e) => e.data === oggi).sort((a, b) => (a.ora || "99:99").localeCompare(b.ora || "99:99")));

            const perGiorno = {};
            tutti.forEach((e) => { if (!perGiorno[e.data]) perGiorno[e.data] = new Set(); perGiorno[e.data].add(e.tipo); });
            const giorni = Array.from({ length: 7 }, (_, i) => addGiorni(oggi, i));
            setSettimana(giorni.map((data) => ({ data, tipi: [...(perGiorno[data] || [])] })));

            const turnoDiOggi = (turniRes.data || []).find((t) => t.data === oggi);
            if (turnoDiOggi) setTurnoOggi({ ...turnoDiOggi, personaNome: membriById[turnoDiOggi.member_id]?.display_name });
          })
        );
      }

      if (moduli.finanza !== false) {
        jobs.push(
          Promise.all([
            fetchAllTransactions(workspace.id, { mese: currentMonthStr() }),
            fetchAllTransactions(workspace.id, { mese: (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })() }),
          ]).then(([tx, txPrev]) => {
            if (cancelled) return;
            const entrate = tx.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0);
            const spese = tx.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0);
            setSaldoMese(entrate - spese);
            if (txPrev.length > 0) {
              const entratePrev = txPrev.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0);
              const spesePrev = txPrev.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0);
              setDeltaSaldo((entrate - spese) - (entratePrev - spesePrev));
            }
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
            supabase.from("scadenze").select("titolo, data_scadenza, importo, member_id, workspace_members(display_name)").eq("workspace_id", workspace.id).eq("stato", "da_pagare").order("data_scadenza", { ascending: true }).limit(1),
          ]).then(([countRes, nextRes]) => {
            if (cancelled) return;
            setScadenzeDaPagare(countRes.count || 0);
            setProssimaScadenza(nextRes.data?.[0] || null);
          })
        );
      }
      if (moduli.figli) {
        jobs.push(
          Promise.all([
            supabase.from("entita_familiari").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
            supabase.from("entita_attivita").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).gte("data", oggi),
          ]).then(([e, a]) => { if (!cancelled) { setEntitaCount(e.count || 0); setAttivitaProssime(a.count || 0); } })
        );
      }

      await Promise.all(jobs);
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [workspace, member]); // eslint-disable-line

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
              <div style={{ fontSize: 10.5, letterSpacing: "0.08em", color: C.violet, fontWeight: 700 }} className="uppercase mb-2">Il nastro del giorno</div>
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

          {moduli.calendario !== false && settimana.length > 0 && (
            <>
              <div style={{ fontSize: 10.5, letterSpacing: "0.08em", color: C.sky, fontWeight: 700 }} className="uppercase mb-2">La settimana a colpo d'occhio</div>
              <button onClick={() => navigate("/app/calendario")} className="flex justify-between w-full mb-5" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 8px" }}>
                {settimana.map((g) => {
                  const d = new Date(g.data + "T00:00:00");
                  const isOggi = g.data === oggi;
                  return (
                    <div key={g.data} className="flex flex-col items-center gap-1" style={{ padding: "2px 4px", borderRadius: 10, backgroundColor: isOggi ? C.purpleSoft : "transparent" }}>
                      <span style={{ fontSize: 9, color: isOggi ? C.purple : C.muted, fontWeight: 700 }}>{["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"][d.getDay()]}</span>
                      <span style={{ fontSize: 12.5, color: isOggi ? C.purple : C.text, fontWeight: isOggi ? 800 : 500 }}>{d.getDate()}</span>
                      <div className="flex gap-0.5" style={{ minHeight: 4 }}>
                        {g.tipi.slice(0, 3).map((t, i) => <div key={i} style={{ width: 3.5, height: 3.5, borderRadius: 9999, backgroundColor: MODULO_COLOR[t] }} />)}
                      </div>
                    </div>
                  );
                })}
              </button>
            </>
          )}

          <div style={{ fontSize: 10.5, letterSpacing: "0.08em", color: C.muted, fontWeight: 700 }} className="uppercase mb-2">Uno sguardo d'insieme</div>

          <div style={{ display: "grid", gridTemplateColumns: moduli.turni ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 10 }}>
            {moduli.finanza !== false && (
              <button onClick={() => navigate("/app/finanza")} className="text-left" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
                <div className="flex items-center justify-between mb-1">
                  <div style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: `${C.green}22`, display: "flex", alignItems: "center", justifyContent: "center" }}><Wallet size={13} style={{ color: C.green }} /></div>
                </div>
                <div className="text-xs" style={{ color: C.muted, marginTop: 6 }}>Saldo mese</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: saldoMese >= 0 ? C.green : C.red, fontFamily: "monospace" }}>{euro(saldoMese)}</div>
                {deltaSaldo !== null && (
                  <div className="text-xs" style={{ color: C.muted, marginTop: 2 }}>{euro(deltaSaldo)} vs scorso</div>
                )}
              </button>
            )}

            {moduli.turni && (
              <button onClick={() => navigate("/app/calendario")} className="text-left" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: `${C.sky}22`, display: "flex", alignItems: "center", justifyContent: "center" }}><Clock size={13} style={{ color: C.sky }} /></div>
                <div className="text-xs" style={{ color: C.muted, marginTop: 8 }}>{turnoOggi ? "Turno di oggi" : "Turni"}</div>
                {turnoOggi ? (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{turnoOggi.ora_inizio?.slice(0, 5)}–{turnoOggi.ora_fine?.slice(0, 5)}</div>
                    <div className="text-xs" style={{ color: C.muted, marginTop: 1 }}>{[turnoOggi.personaNome, turnoOggi.modalita === "smart" ? "Smart working" : turnoOggi.aziende?.nome].filter(Boolean).join(" · ")}</div>
                  </>
                ) : (
                  <div className="text-xs" style={{ color: C.muted, fontStyle: "italic", marginTop: 2 }}>Nessun turno oggi</div>
                )}
              </button>
            )}
          </div>

          {moduli.scadenzePagamenti !== false && (
            <SectionCard
              icon={Receipt} iconColor={C.amber} eyebrow="Scadenze"
              title={prossimaScadenza ? prossimaScadenza.titolo : "Tutto in regola"}
              subtitle={prossimaScadenza ? [prossimaScadenza.data_scadenza === oggi ? "Scade oggi" : `Scade il ${prossimaScadenza.data_scadenza}`, prossimaScadenza.workspace_members?.display_name, prossimaScadenza.importo != null ? euroPlain(prossimaScadenza.importo) : null].filter(Boolean).join(" · ") : null}
              empty={!prossimaScadenza ? "Nessuna scadenza in sospeso al momento." : null}
              onClick={() => navigate("/app/scadenze")}
            >
              {scadenzeDaPagare > 1 && <div className="text-xs" style={{ color: C.muted }}>+{scadenzeDaPagare - 1} altre</div>}
            </SectionCard>
          )}

          {moduli.figli && (
            <SectionCard
              icon={Baby} iconColor={C.orange} eyebrow={workspace.nome_modulo_figli || "Figli"}
              title={entitaCount === 0 ? "Nessuno aggiunto ancora" : `${attivitaProssime} attività in programma`}
              empty={entitaCount === 0 ? "Il modulo è attivo — aggiungi il primo da qui." : null}
              onClick={() => navigate("/app/attivita")}
            />
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
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
