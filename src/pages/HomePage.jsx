import React, { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, ChevronRight, TrendingUp, TrendingDown, PiggyBank, AlertTriangle, Receipt } from "lucide-react";
import { C, euro, euroPlain } from "../theme";
import { Card, SectionLabel } from "../components/ui";
import { supabase } from "../lib/supabase";
import { fetchAllTransactions } from "../lib/fetchAllTransactions";
import TransactionModal from "../components/TransactionModal";

function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function prevMonthStr() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function MetricaPill({ label, value, color }) {
  return (
    <div style={{ flex: 1, backgroundColor: `${color}14`, border: `1px solid ${color}33`, borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}
function RigaRapporto({ label, value }) {
  const positivo = value >= 0;
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: C.muted }}>{label}</span>
      <span className="text-xs font-medium" style={{ color: positivo ? C.green : C.red, fontFamily: "monospace" }}>
        {euro(value)}
      </span>
    </div>
  );
}

export default function HomePage() {
  const { workspace, refreshKey, bumpRefresh, isReader } = useOutletContext();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [prevTransactions, setPrevTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]); // storia completa, per consuntivo complessivo e metriche giornaliere
  const [budgets, setBudgets] = useState({}); // { macro: { limit, thresholds } }
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [scadenzeDaPagare, setScadenzeDaPagare] = useState(0);

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [tx, prevTx, allTx, { data: mem }, { data: cats }] = await Promise.all([
        fetchAllTransactions(workspace.id, { mese: currentMonthStr() }),
        fetchAllTransactions(workspace.id, { mese: prevMonthStr() }),
        fetchAllTransactions(workspace.id),
        supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
        supabase.from("category_mappings").select("macro_categoria, monthly_limit, alert_thresholds_monthly").eq("workspace_id", workspace.id),
      ]);

      if (cancelled) return;
      setTransactions(tx || []);
      setPrevTransactions(prevTx || []);
      setAllTransactions(allTx || []);
      setMembers(mem || []);

      const budgetMap = {};
      (cats || []).forEach((c) => {
        if (c.monthly_limit == null) return;
        if (!budgetMap[c.macro_categoria]) budgetMap[c.macro_categoria] = { limit: 0, thresholds: c.alert_thresholds_monthly };
        budgetMap[c.macro_categoria].limit = Math.max(budgetMap[c.macro_categoria].limit, Number(c.monthly_limit));
      });
      setBudgets(budgetMap);

      setLoading(false);
    }
    load();

    supabase.from("scadenze").select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id).eq("stato", "da_pagare")
      .then(({ count }) => { if (!cancelled) setScadenzeDaPagare(count || 0); });

    return () => { cancelled = true; };
  }, [workspace, refreshKey]);

  if (!workspace) return null;

  const entrate = transactions.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0);
  const spese = transactions.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0);
  const saldo = entrate - spese;

  const prevEntrate = prevTransactions.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0);
  const prevSpese = prevTransactions.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0);
  const prevSaldo = prevEntrate - prevSpese;
  const hasPrevData = prevTransactions.length > 0;

  const entrateComplessive = allTransactions.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0);
  const speseComplessive = allTransactions.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0);
  const saldoComplessivo = entrateComplessive - speseComplessive;

  const recenti = transactions.slice(0, 5);

  // ---------- Metriche di spesa/capacità giornaliera (formule verificate contro il file Excel personale) ----------
  // "Standard" = entrate ricorrenti riconosciute dal testo della voce (stipendio, assegno unico).
  // Non usiamo categoria_entrata: nei dati reali importati da Base44 quel campo non è mai stato
  // valorizzato, quindi si riconosce dal testo — copre "Stipendio Luca", "Stipendio Febbraio 2025",
  // "Assegno Unico"/"Assegno unico", ecc. Tutto il resto (Vendite, Trovati, Rimborsi, lezioni
  // occasionali...) è considerato non-standard.
  const isStandard = (t) => {
    if (t.tipo !== "entrata") return false;
    const voce = (t.voce || "").toLowerCase();
    return voce.includes("stipendio") || voce.includes("assegno unico");
  };

  const meseCorrenteStr = currentMonthStr();
  const [annoCorr, mmCorr] = meseCorrenteStr.split("-").map(Number);
  const giorniNelMese = new Date(annoCorr, mmCorr, 0).getDate();

  const txMeseCorrente = allTransactions.filter((t) => t.mese === meseCorrenteStr);
  const speseMese = txMeseCorrente.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0);
  const entrateMese = txMeseCorrente.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0);
  const entrateStandardMese = txMeseCorrente.filter(isStandard).reduce((s, t) => s + Number(t.importo), 0);

  // ---------- Spese/Entrate per persona: mese corrente e complessivo, sempre insieme (non legati al toggle periodo) ----------
  const PALETTE_CATEGORIE = [C.sky, C.green, C.amber, C.orange, C.fuchsia, C.violet];
  function calcolaPerPersona(tx) {
    const righe = members.map((m) => {
      const memTx = tx.filter((t) => t.member_id === m.id);
      return {
        nome: m.display_name,
        colore: m.colore || C.purple,
        entrate: memTx.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0),
        spese: memTx.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0),
      };
    });
    const totaleEntrate = righe.reduce((s, r) => s + r.entrate, 0);
    const totaleSpese = righe.reduce((s, r) => s + r.spese, 0);
    return { righe, totaleEntrate, totaleSpese };
  }
  const perPersonaMese = calcolaPerPersona(txMeseCorrente);
  const perPersonaComplessivo = calcolaPerPersona(allTransactions);

  function top3Categorie(tx) {
    const map = {};
    tx.filter((t) => t.tipo === "uscita" && t.macro_categoria).forEach((t) => { map[t.macro_categoria] = (map[t.macro_categoria] || 0) + Number(t.importo); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }
  const top3Mese = top3Categorie(txMeseCorrente);
  const top3Complessivo = top3Categorie(allTransactions);
  // colore stabile per nome categoria, coerente tra le due colonne
  const nomiCategorieUnione = [...new Set([...top3Mese.map(([n]) => n), ...top3Complessivo.map(([n]) => n)])];
  const coloreCategoria = Object.fromEntries(nomiCategorieUnione.map((n, i) => [n, PALETTE_CATEGORIE[i % PALETTE_CATEGORIE.length]]));
  const maxTop3Mese = Math.max(1, ...top3Mese.map(([, v]) => v));
  const maxTop3Complessivo = Math.max(1, ...top3Complessivo.map(([, v]) => v));

  function top3Modalita(tx) {
    const map = {};
    tx.filter((t) => t.modalita).forEach((t) => { map[t.modalita] = (map[t.modalita] || 0) + Number(t.importo); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }
  const modalitaMese = top3Modalita(txMeseCorrente);
  const modalitaComplessivo = top3Modalita(allTransactions);
  const nomiModalitaUnione = [...new Set([...modalitaMese.map(([n]) => n), ...modalitaComplessivo.map(([n]) => n)])];
  const coloreModalita = Object.fromEntries(nomiModalitaUnione.map((n, i) => [n, PALETTE_CATEGORIE[i % PALETTE_CATEGORIE.length]]));
  const maxModalitaMese = Math.max(1, ...modalitaMese.map(([, v]) => v));
  const maxModalitaComplessivo = Math.max(1, ...modalitaComplessivo.map(([, v]) => v));


  const primaData = allTransactions.length > 0 ? allTransactions.reduce((min, t) => (t.date < min ? t.date : min), allTransactions[0].date) : null;
  const fineMese = new Date(annoCorr, mmCorr, 0);
  const giorniComplessivi = primaData ? Math.round((fineMese - new Date(primaData + "T00:00:00")) / 86400000) + 1 : giorniNelMese;

  const entrateStandardComplessive = allTransactions.filter(isStandard).reduce((s, t) => s + Number(t.importo), 0);

  const spesaMediaMese = giorniNelMese ? speseMese / giorniNelMese : 0;
  const spesaMediaComplessiva = giorniComplessivi ? speseComplessive / giorniComplessivi : 0;
  const capacitaMese = giorniNelMese ? entrateMese / giorniNelMese : 0;
  const capacitaComplessiva = giorniComplessivi ? entrateComplessive / giorniComplessivi : 0;
  const capacitaStandardMese = giorniNelMese ? entrateStandardMese / giorniNelMese : 0;
  const capacitaStandardComplessiva = giorniComplessivi ? entrateStandardComplessive / giorniComplessivi : 0;
  const rapportoMese = capacitaMese - spesaMediaMese;
  const rapportoComplessivo = capacitaComplessiva - spesaMediaComplessiva;
  const rapportoStandardComplessivo = capacitaStandardComplessiva - spesaMediaComplessiva;

  const handleEditDone = () => {
    setEditing(null);
    bumpRefresh?.();
  };

  return (
    <div>
      <h1 className="font-bold mb-4" style={{ fontSize: 26 }}>Dashboard</h1>

      {loading ? (
        <div style={{ color: C.muted, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Caricamento...</div>
      ) : (
        <>
          <div style={{ borderRadius: 20, padding: 20, marginBottom: 10, background: "linear-gradient(135deg, #241b3e 0%, #15171f 100%)", border: "1px solid #2d2545" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">
              Saldo · consuntivo complessivo
            </div>
            <div className="font-bold mb-3" style={{ fontSize: 32, color: saldoComplessivo >= 0 ? C.green : C.red }}>{euro(saldoComplessivo)}</div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1" style={{ backgroundColor: C.greenSoft, color: C.green, borderRadius: 9999, padding: "4px 10px", fontSize: 12, fontFamily: "monospace" }}>
                <ArrowUpRight size={12} /> {euroPlain(entrateComplessive)}
              </div>
              <div className="flex items-center gap-1" style={{ backgroundColor: C.redSoft, color: C.red, borderRadius: 9999, padding: "4px 10px", fontSize: 12, fontFamily: "monospace" }}>
                <ArrowDownRight size={12} /> {euroPlain(speseComplessive)}
              </div>
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">
                Saldo · questo mese
              </div>
              <div className="font-bold mb-3" style={{ fontSize: 24, color: saldo >= 0 ? C.green : C.red }}>{euro(saldo)}</div>
              <div className="flex gap-2 mb-2">
                <div className="flex items-center gap-1" style={{ backgroundColor: C.greenSoft, color: C.green, borderRadius: 9999, padding: "4px 10px", fontSize: 12, fontFamily: "monospace" }}>
                  <ArrowUpRight size={12} /> {euroPlain(entrate)}
                </div>
                <div className="flex items-center gap-1" style={{ backgroundColor: C.redSoft, color: C.red, borderRadius: 9999, padding: "4px 10px", fontSize: 12, fontFamily: "monospace" }}>
                  <ArrowDownRight size={12} /> {euroPlain(spese)}
                </div>
              </div>
              {hasPrevData && (
                <div className="flex items-center gap-1 text-xs" style={{ color: C.muted }}>
                  {saldo - prevSaldo >= 0 ? <TrendingUp size={12} style={{ color: C.green }} /> : <TrendingDown size={12} style={{ color: C.red }} />}
                  <span>{euro(saldo - prevSaldo)} rispetto al mese scorso</span>
                </div>
              )}
            </div>
          </div>

          {transactions.length === 0 && (
            <div style={{ color: C.muted, fontSize: 12, padding: "8px 4px 16px" }}>
              Nessuna transazione trovata per questo periodo — normale se i dati non sono ancora stati importati, o se non ne hai ancora registrate.
            </div>
          )}

          <SectionLabel color={C.red}>Spese</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <Card eyebrow="Spese mese per persona">
              {perPersonaMese.righe.map((r) => (
                <div key={r.nome} className="flex justify-between text-xs mb-2" style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                  <span style={{ color: C.text }}>{r.nome}</span>
                  <span style={{ color: r.colore, fontFamily: "monospace", fontWeight: 600 }}>{euroPlain(r.spese)}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-semibold" style={{ marginTop: 4 }}>
                <span style={{ color: C.text }}>Totale</span>
                <span style={{ color: C.text, fontFamily: "monospace" }}>{euroPlain(perPersonaMese.totaleSpese)}</span>
              </div>
            </Card>
            <Card eyebrow="Spese complessive per persona">
              {perPersonaComplessivo.righe.map((r) => (
                <div key={r.nome} className="flex justify-between text-xs mb-2" style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                  <span style={{ color: C.text }}>{r.nome}</span>
                  <span style={{ color: r.colore, fontFamily: "monospace", fontWeight: 600 }}>{euroPlain(r.spese)}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-semibold" style={{ marginTop: 4 }}>
                <span style={{ color: C.text }}>Totale</span>
                <span style={{ color: C.text, fontFamily: "monospace" }}>{euroPlain(perPersonaComplessivo.totaleSpese)}</span>
              </div>
            </Card>
          </div>

          <SectionLabel color={C.green}>Entrate</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <Card eyebrow="Entrate mese per persona">
              {perPersonaMese.righe.map((r) => (
                <div key={r.nome} className="flex justify-between text-xs mb-2" style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                  <span style={{ color: C.text }}>{r.nome}</span>
                  <span style={{ color: r.colore, fontFamily: "monospace", fontWeight: 600 }}>{euroPlain(r.entrate)}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-semibold" style={{ marginTop: 4 }}>
                <span style={{ color: C.text }}>Totale</span>
                <span style={{ color: C.green, fontFamily: "monospace" }}>{euroPlain(perPersonaMese.totaleEntrate)}</span>
              </div>
            </Card>
            <Card eyebrow="Entrate complessive per persona">
              {perPersonaComplessivo.righe.map((r) => (
                <div key={r.nome} className="flex justify-between text-xs mb-2" style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                  <span style={{ color: C.text }}>{r.nome}</span>
                  <span style={{ color: r.colore, fontFamily: "monospace", fontWeight: 600 }}>{euroPlain(r.entrate)}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-semibold" style={{ marginTop: 4 }}>
                <span style={{ color: C.text }}>Totale</span>
                <span style={{ color: C.green, fontFamily: "monospace" }}>{euroPlain(perPersonaComplessivo.totaleEntrate)}</span>
              </div>
            </Card>
          </div>

          {(top3Mese.length > 0 || top3Complessivo.length > 0) && (
            <>
              <SectionLabel color={C.violet}>Analisi</SectionLabel>
              <Card eyebrow="Top 3 categorie" style={{ marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 8 }} className="uppercase">Mese corrente</div>
                    {top3Mese.map(([name, amount]) => {
                      const budget = budgets[name];
                      const budgetPct = budget ? (amount / budget.limit) * 100 : null;
                      const soglie = budget?.thresholds?.length ? budget.thresholds : [70, 100];
                      const overSoglia = budgetPct !== null && budgetPct >= soglie[0];
                      const overLimite = budgetPct !== null && budgetPct >= 100;
                      return (
                        <div key={name} className="mb-2.5">
                          <div className="flex justify-between text-xs mb-1">
                            <span style={{ color: C.text }} className="flex items-center gap-1 truncate">{name}{overSoglia && <AlertTriangle size={10} style={{ color: overLimite ? C.red : C.amber, flexShrink: 0 }} />}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div style={{ flex: 1, height: 5, backgroundColor: C.panel2, borderRadius: 4, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${budget ? Math.min(budgetPct, 100) : (amount / maxTop3Mese) * 100}%`, backgroundColor: overLimite ? C.red : overSoglia ? C.amber : coloreCategoria[name], borderRadius: 4 }} />
                            </div>
                            <span className="text-xs flex-shrink-0" style={{ color: coloreCategoria[name], fontFamily: "monospace" }}>{euroPlain(amount)}</span>
                          </div>
                        </div>
                      );
                    })}
                    {top3Mese.length === 0 && <div className="text-xs" style={{ color: C.muted, fontStyle: "italic" }}>Nessuna spesa questo mese.</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 8 }} className="uppercase">Complessive</div>
                    {top3Complessivo.map(([name, amount]) => (
                      <div key={name} className="mb-2.5">
                        <div className="text-xs truncate mb-1" style={{ color: C.text }}>{name}</div>
                        <div className="flex items-center gap-2">
                          <div style={{ flex: 1, height: 5, backgroundColor: C.panel2, borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(amount / maxTop3Complessivo) * 100}%`, backgroundColor: coloreCategoria[name], borderRadius: 4 }} />
                          </div>
                          <span className="text-xs flex-shrink-0" style={{ color: coloreCategoria[name], fontFamily: "monospace" }}>{euroPlain(amount)}</span>
                        </div>
                      </div>
                    ))}
                    {top3Complessivo.length === 0 && <div className="text-xs" style={{ color: C.muted, fontStyle: "italic" }}>Nessuna spesa registrata.</div>}
                  </div>
                </div>
              </Card>

              {(modalitaMese.length > 0 || modalitaComplessivo.length > 0) && (
                <Card eyebrow="Modalità di pagamento" style={{ marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 8 }} className="uppercase">Mese corrente</div>
                      {modalitaMese.map(([name, amount]) => (
                        <div key={name} className="mb-2.5">
                          <div className="text-xs truncate mb-1" style={{ color: C.text }}>{name}</div>
                          <div className="flex items-center gap-2">
                            <div style={{ flex: 1, height: 5, backgroundColor: C.panel2, borderRadius: 4, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${(amount / maxModalitaMese) * 100}%`, backgroundColor: coloreModalita[name], borderRadius: 4 }} />
                            </div>
                            <span className="text-xs flex-shrink-0" style={{ color: coloreModalita[name], fontFamily: "monospace" }}>{euroPlain(amount)}</span>
                          </div>
                        </div>
                      ))}
                      {modalitaMese.length === 0 && <div className="text-xs" style={{ color: C.muted, fontStyle: "italic" }}>Nessuna transazione questo mese.</div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 8 }} className="uppercase">Complessive</div>
                      {modalitaComplessivo.map(([name, amount]) => (
                        <div key={name} className="mb-2.5">
                          <div className="text-xs truncate mb-1" style={{ color: C.text }}>{name}</div>
                          <div className="flex items-center gap-2">
                            <div style={{ flex: 1, height: 5, backgroundColor: C.panel2, borderRadius: 4, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${(amount / maxModalitaComplessivo) * 100}%`, backgroundColor: coloreModalita[name], borderRadius: 4 }} />
                            </div>
                            <span className="text-xs flex-shrink-0" style={{ color: coloreModalita[name], fontFamily: "monospace" }}>{euroPlain(amount)}</span>
                          </div>
                        </div>
                      ))}
                      {modalitaComplessivo.length === 0 && <div className="text-xs" style={{ color: C.muted, fontStyle: "italic" }}>Nessuna transazione registrata.</div>}
                    </div>
                  </div>
                  <div className="text-xs mt-3" style={{ color: C.muted, fontStyle: "italic" }}>Somma di entrate e uscite passate per quel metodo.</div>
                </Card>
              )}
            </>
          )}

          {allTransactions.length > 0 && (
            <>
              <SectionLabel color={C.sky}>Spesa e capacità giornaliera</SectionLabel>
              <Card style={{ marginBottom: 4 }}>
                <div className="text-xs mb-3" style={{ color: C.muted }}>
                  "Standard" = solo entrate ricorrenti (stipendi, assegno unico, tredicesima/quattordicesima) — escluse vendite, rimborsi e altre entrate occasionali.
                </div>

                <div style={{ fontSize: 10.5, letterSpacing: "0.06em", color: C.muted, fontWeight: 700, marginBottom: 6 }} className="uppercase">Spesa media giornaliera</div>
                <div className="flex gap-2 mb-4">
                  <MetricaPill label="Questo mese" value={euro(spesaMediaMese)} color={C.red} />
                  <MetricaPill label="Da sempre" value={euro(spesaMediaComplessiva)} color={C.red} />
                </div>

                <div style={{ fontSize: 10.5, letterSpacing: "0.06em", color: C.muted, fontWeight: 700, marginBottom: 6 }} className="uppercase">Capacità di spesa giornaliera</div>
                <div className="flex gap-2 mb-2">
                  <MetricaPill label="Questo mese" value={euro(capacitaMese)} color={C.green} />
                  <MetricaPill label="Da sempre" value={euro(capacitaComplessiva)} color={C.green} />
                </div>
                <div className="flex gap-2 mb-4">
                  <MetricaPill label="Standard · mese" value={euro(capacitaStandardMese)} color={C.sky} />
                  <MetricaPill label="Standard · da sempre" value={euro(capacitaStandardComplessiva)} color={C.sky} />
                </div>

                <div style={{ fontSize: 10.5, letterSpacing: "0.06em", color: C.muted, fontWeight: 700, marginBottom: 6 }} className="uppercase">Margine (capacità − spesa media)</div>
                <div className="space-y-2">
                  <RigaRapporto label="Questo mese" value={rapportoMese} />
                  <RigaRapporto label="Da sempre" value={rapportoComplessivo} />
                  <RigaRapporto label="Da sempre (su entrate standard)" value={rapportoStandardComplessivo} />
                </div>
              </Card>
            </>
          )}


          {recenti.length > 0 && (
            <Card style={{ marginTop: 16 }}>
              <div className="flex items-center justify-between mb-3">
                <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600 }} className="uppercase">Ultime transazioni</div>
                <button onClick={() => navigate("/app/finanza/mesi")} className="flex items-center gap-0.5 font-medium text-xs" style={{ color: C.purple, background: "none", border: "none" }}>
                  Vedi tutte <ChevronRight size={12} />
                </button>
              </div>
              <div className="space-y-3">
                {recenti.map((t) => (
                  <button key={t.id} onClick={() => setEditing(t)} className="w-full flex items-center justify-between" style={{ background: "none", border: "none", textAlign: "left" }}>
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div className="text-sm truncate" style={{ color: C.text }}>{t.voce}</div>
                      <div className="text-xs truncate" style={{ color: C.muted }}>{t.macro_categoria || "Senza categoria"} · {t.date}</div>
                    </div>
                    <div className="text-sm" style={{ color: t.tipo === "uscita" ? C.red : C.green, fontFamily: "monospace", flexShrink: 0 }}>
                      {t.tipo === "uscita" ? "-" : "+"}{euroPlain(t.importo)}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <button onClick={() => navigate("/app/scadenze")} className="w-full flex items-center gap-2" style={{ marginTop: 10, backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <Receipt size={16} style={{ color: C.amber }} />
            <span className="text-sm font-medium flex-1" style={{ color: C.text }}>Scadenze & Adempimenti</span>
            {scadenzeDaPagare > 0 && (
              <span style={{ backgroundColor: `${C.amber}22`, color: C.amber, borderRadius: 9999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{scadenzeDaPagare}</span>
            )}
            <ChevronRight size={14} style={{ color: C.muted }} />
          </button>

          <button onClick={() => navigate("/app/risparmi")} className="w-full flex items-center gap-2" style={{ marginTop: 8, backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <PiggyBank size={16} style={{ color: C.green }} />
            <span className="text-sm font-medium flex-1" style={{ color: C.text }}>Obiettivi di risparmio</span>
            <ChevronRight size={14} style={{ color: C.muted }} />
          </button>
        </>
      )}

      {editing && (
        <TransactionModal workspace={workspace} existing={editing} zIndex={55} onClose={() => setEditing(null)} onSaved={handleEditDone} onDeleted={handleEditDone} readOnly={isReader} />
      )}
    </div>
  );
}
