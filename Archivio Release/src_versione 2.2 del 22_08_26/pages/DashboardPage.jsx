import React, { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { CalendarDays, Wallet, ListChecks, ChevronRight, Receipt, Clock, Baby, Square } from "lucide-react";
import { C, euro, todayLocal } from "../theme";
import { supabase } from "../lib/supabase";
import { fetchAllTransactions } from "../lib/fetchAllTransactions";

function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
  const [impegniOggi, setImpegniOggi] = useState(0);
  const [saldoMese, setSaldoMese] = useState(0);
  const [listeCount, setListeCount] = useState(0);
  const [listeAnteprima, setListeAnteprima] = useState([]);
  const [scadenzeDaPagare, setScadenzeDaPagare] = useState(0);
  const [turniOggi, setTurniOggi] = useState(0);
  const [entitaCount, setEntitaCount] = useState(0);
  const [attivitaProssime, setAttivitaProssime] = useState(0);

  const moduli = workspace?.moduli_attivi || {};
  const oggi = todayLocal();

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
    setListeAnteprima((prev) => prev.filter((a) => a.id !== id)); // ottimistico: sparisce subito, è "fatta"
    const { error } = await supabase.from("liste_articoli").update({ completato: true }).eq("id", id);
    if (error) caricaAnteprimaListe(); // in caso di errore, ripristina la lista vera
  };

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const jobs = [];

      if (moduli.calendario !== false) {
        jobs.push(
          Promise.all([
            supabase.from("scadenze").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("data_scadenza", oggi),
            moduli.turni ? supabase.from("turni_assegnati").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("data", oggi) : Promise.resolve({ count: 0 }),
            moduli.figli ? supabase.from("entita_attivita").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("data", oggi) : Promise.resolve({ count: 0 }),
            supabase.from("eventi_generici").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("data", oggi),
          ]).then(([a, b, c, d]) => { if (!cancelled) setImpegniOggi((a.count || 0) + (b.count || 0) + (c.count || 0) + (d.count || 0)); })
        );
      }
      if (moduli.finanza !== false) {
        jobs.push(
          fetchAllTransactions(workspace.id, { mese: currentMonthStr() }).then((tx) => {
            if (cancelled) return;
            const entrate = tx.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0);
            const spese = tx.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0);
            setSaldoMese(entrate - spese);
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
          supabase.from("scadenze").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("stato", "da_pagare")
            .then(({ count }) => { if (!cancelled) setScadenzeDaPagare(count || 0); })
        );
      }
      if (moduli.turni) {
        jobs.push(
          supabase.from("turni_assegnati").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("data", oggi)
            .then(({ count }) => { if (!cancelled) setTurniOggi(count || 0); })
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
      <h1 className="font-bold mb-1" style={{ fontSize: 26 }}>Ciao{member?.display_name ? ` ${member.display_name}` : ""}</h1>
      <div className="text-sm mb-5" style={{ color: C.muted }}>
        {new Date(oggi + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
      </div>

      {loading ? (
        <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>Caricamento...</div>
      ) : (
        <>
          {moduli.calendario !== false && (
            <SectionCard
              icon={CalendarDays} iconColor={C.violet} eyebrow="Calendario" title="Cosa devo fare oggi?"
              empty={impegniOggi === 0 ? "Nessun impegno registrato per oggi." : null}
              onClick={() => navigate("/app/calendario")}
            >
              {impegniOggi > 0 && (
                <>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.violet }}>{impegniOggi}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{impegniOggi === 1 ? "impegno oggi" : "impegni oggi"}</div>
                </>
              )}
            </SectionCard>
          )}

          {moduli.finanza !== false && (
            <SectionCard icon={Wallet} iconColor={C.green} eyebrow="Finanza" title="Bilancio di questo mese" onClick={() => navigate("/app/finanza")}>
              <div style={{ fontSize: 24, fontWeight: 800, color: saldoMese >= 0 ? C.green : C.red }}>{euro(saldoMese)}</div>
            </SectionCard>
          )}

          {moduli.scadenzePagamenti !== false && (
            <SectionCard
              icon={Receipt} iconColor={C.amber} eyebrow="Scadenze" title={scadenzeDaPagare > 0 ? `${scadenzeDaPagare} da pagare` : "Tutto in regola"}
              empty={scadenzeDaPagare === 0 ? "Nessuna scadenza in sospeso al momento." : null}
              onClick={() => navigate("/app/scadenze")}
            />
          )}

          {moduli.turni && (
            <SectionCard
              icon={Clock} iconColor={C.sky} eyebrow="Turni" title={turniOggi > 0 ? "Turno di oggi" : "Nessun turno oggi"}
              empty={turniOggi === 0 ? "Nessun turno assegnato per oggi — puoi aggiungerne uno da Calendario." : null}
              onClick={() => navigate("/app/calendario")}
            />
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
