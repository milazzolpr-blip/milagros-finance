import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, Tooltip, XAxis } from "recharts";
import { C, euro, euroPlain, pct } from "../theme";
import { Card, PillTabs, BilancioRow } from "../components/ui";
import { supabase } from "../lib/supabase";
import { fetchAllTransactions } from "../lib/fetchAllTransactions";

const PALETTE = [C.blue, C.amber, C.red, C.green, C.violet, C.fuchsia, C.slate, C.orange, C.sky, "#a3e635"];

function meseLabel(mese) {
  const NOMI = ["", "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
  const [anno, mm] = mese.split("-");
  return `${NOMI[parseInt(mm, 10)]} ${anno.slice(2)}`;
}

export default function StoricoPage() {
  const { workspace, refreshKey } = useOutletContext();
  const [tab, setTab] = useState("riepilogo");
  const [confrontoTipo, setConfrontoTipo] = useState("mese");
  const [macroEspansa, setMacroEspansa] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;
    Promise.all([
      fetchAllTransactions(workspace.id),
      supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
    ]).then(([tx, memRes]) => {
      if (cancelled) return;
      setTransactions(tx || []);
      setMembers(memRes.data || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [workspace, refreshKey]);

  // ---------- strutture derivate, calcolate una sola volta dal dataset completo ----------
  const perMese = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      if (!map[t.mese]) map[t.mese] = { mese: t.mese, entrate: 0, spese: 0 };
      if (t.tipo === "entrata") map[t.mese].entrate += Number(t.importo); else map[t.mese].spese += Number(t.importo);
    });
    return Object.values(map).sort((a, b) => (a.mese < b.mese ? -1 : 1));
  }, [transactions]);

  const perAnno = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      const anno = t.mese.slice(0, 4);
      if (!map[anno]) map[anno] = { anno, entrate: 0, spese: 0, mesi: new Set() };
      map[anno].mesi.add(t.mese);
      if (t.tipo === "entrata") map[anno].entrate += Number(t.importo); else map[anno].spese += Number(t.importo);
    });
    return Object.values(map)
      .map((a) => ({ ...a, netto: a.entrate - a.spese, mediaMese: (a.entrate - a.spese) / a.mesi.size, numMesi: a.mesi.size }))
      .sort((a, b) => (a.anno < b.anno ? 1 : -1));
  }, [transactions]);

  const perMacro = useMemo(() => {
    const map = {};
    transactions.filter((t) => t.tipo === "uscita" && t.macro_categoria).forEach((t) => {
      map[t.macro_categoria] = (map[t.macro_categoria] || 0) + Number(t.importo);
    });
    const totale = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map)
      .map(([name, amount], i) => ({ name, amount, pct: (amount / totale) * 100 }))
      .sort((a, b) => b.amount - a.amount)
      .map((c, i) => ({ ...c, rank: i + 1, color: PALETTE[i % PALETTE.length] }));
  }, [transactions]);

  // per ogni macro-categoria, il dettaglio delle sue micro-categorie (stesso periodo, stessa base dati)
  const perMicroByMacro = useMemo(() => {
    const result = {};
    perMacro.forEach((macro) => {
      const map = {};
      transactions
        .filter((t) => t.tipo === "uscita" && t.macro_categoria === macro.name)
        .forEach((t) => {
          const chiave = t.micro_categoria || "Senza sottocategoria";
          map[chiave] = (map[chiave] || 0) + Number(t.importo);
        });
      result[macro.name] = Object.entries(map)
        .map(([name, amount]) => ({ name, amount, pct: (amount / macro.amount) * 100 }))
        .sort((a, b) => b.amount - a.amount);
    });
    return result;
  }, [transactions, perMacro]);

  const perMembro = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      if (!map[t.member_id]) map[t.member_id] = { entrate: 0, spese: 0 };
      if (t.tipo === "entrata") map[t.member_id].entrate += Number(t.importo); else map[t.member_id].spese += Number(t.importo);
    });
    return members.map((m) => ({
      persona: m.display_name,
      color: m.colore || C.purple,
      entrate: map[m.id]?.entrate || 0,
      spese: map[m.id]?.spese || 0,
    }));
  }, [transactions, members]);

  const dettaglioMembro = useMemo(() => {
    const numeroMesi = new Set(transactions.map((t) => t.mese)).size || 1;
    return members.map((m) => {
      const txMembro = transactions.filter((t) => t.member_id === m.id);
      const spese = txMembro.filter((t) => t.tipo === "uscita");
      const catMap = {};
      spese.forEach((t) => { if (t.macro_categoria) catMap[t.macro_categoria] = (catMap[t.macro_categoria] || 0) + Number(t.importo); });
      const catTop = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
      const totaleSpese = spese.reduce((s, t) => s + Number(t.importo), 0);
      return {
        id: m.id,
        nome: m.display_name,
        numeroTransazioni: txMembro.length,
        mediaMensileSpesa: totaleSpese / numeroMesi,
        categoriaTop: catTop ? { nome: catTop[0], importo: catTop[1] } : null,
      };
    });
  }, [transactions, members]);

  const totaleEntrate = transactions.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0);
  const totaleUscite = transactions.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0);

  // ---------- confronto periodi ----------
  const mesiOrdinati = perMese.map((m) => m.mese).sort();
  const meseCorrente = mesiOrdinati[mesiOrdinati.length - 1];
  const mesePrecedente = mesiOrdinati[mesiOrdinati.length - 2];
  const annoScorsoStessMese = meseCorrente
    ? `${parseInt(meseCorrente.slice(0, 4), 10) - 1}-${meseCorrente.slice(5, 7)}`
    : null;

  function datiMese(mese) {
    return perMese.find((m) => m.mese === mese) || { entrate: 0, spese: 0 };
  }
  function macroDelMese(mese, top = 3) {
    const map = {};
    transactions.filter((t) => t.mese === mese && t.tipo === "uscita" && t.macro_categoria).forEach((t) => {
      map[t.macro_categoria] = (map[t.macro_categoria] || 0) + Number(t.importo);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, top);
  }

  if (!workspace) return null;

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 4 }} className="uppercase">Analisi</div>
      <h1 className="font-bold mb-4" style={{ fontSize: 26 }}>Storico</h1>

      <PillTabs
        options={[
          { key: "riepilogo", label: "Riepilogo" }, { key: "grafici", label: "Grafici" }, { key: "categorie", label: "Categorie" },
          { key: "persone", label: "Persone" }, { key: "tabella", label: "Tabella" }, { key: "confronto", label: "Confronto" },
        ]}
        value={tab} onChange={setTab}
      />

      {loading && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>Caricamento...</div>}
      {!loading && transactions.length === 0 && (
        <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>Nessuna transazione ancora. Questa sezione si popola da sola man mano che ne aggiungi.</div>
      )}

      {!loading && transactions.length > 0 && (
        <>
          {tab === "riepilogo" && (
            <>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Card eyebrow="Consuntivo"><div className="font-bold" style={{ fontSize: 20, color: totaleEntrate - totaleUscite >= 0 ? C.green : C.red }}>{euro(totaleEntrate - totaleUscite)}</div><div className="text-xs" style={{ color: C.muted }}>{perMese.length} mesi</div></Card>
                <Card eyebrow="Entrate totali"><div className="font-bold" style={{ fontSize: 20, color: C.text }}>{euroPlain(totaleEntrate)}</div></Card>
                <Card eyebrow="Uscite totali"><div className="font-bold" style={{ fontSize: 20, color: C.red }}>{euroPlain(totaleUscite)}</div></Card>
                <Card eyebrow="Transazioni"><div className="font-bold" style={{ fontSize: 20, color: C.text }}>{transactions.length}</div></Card>
              </div>
              {perAnno.map((a) => (
                <Card key={a.anno} style={{ marginBottom: 8 }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold" style={{ fontSize: 16, color: C.text }}>{a.anno}</span>
                    <span className="font-semibold" style={{ fontSize: 14, color: a.netto >= 0 ? C.green : C.red, fontFamily: "monospace" }}>{euro(a.netto)}</span>
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: C.muted }}>
                    <span>Entrate <span style={{ color: C.green, fontFamily: "monospace" }}>{euroPlain(a.entrate)}</span></span>
                    <span>Uscite <span style={{ color: C.red, fontFamily: "monospace" }}>{euroPlain(a.uscite ?? a.spese)}</span></span>
                    <span>Media/mese <span style={{ color: C.text, fontFamily: "monospace" }}>{euroPlain(a.mediaMese)}</span></span>
                  </div>
                </Card>
              ))}
            </>
          )}

          {tab === "grafici" && (() => {
            const datiSaldo = perMese.map((m) => ({ mese: meseLabel(m.mese), saldo: m.entrate - m.spese, entrate: m.entrate, spese: m.spese }));
            const mediaSaldo = datiSaldo.reduce((s, d) => s + d.saldo, 0) / (datiSaldo.length || 1);
            const migliore = datiSaldo.reduce((best, d) => (d.saldo > best.saldo ? d : best), datiSaldo[0] || { saldo: 0, mese: "" });
            const peggiore = datiSaldo.reduce((worst, d) => (d.saldo < worst.saldo ? d : worst), datiSaldo[0] || { saldo: 0, mese: "" });

            const TooltipSaldo = ({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div style={{ backgroundColor: C.panel3 || C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px" }}>
                  <div className="text-xs font-semibold mb-1" style={{ color: C.text }}>{d.mese}</div>
                  <div className="text-xs" style={{ color: d.saldo >= 0 ? C.green : C.red, fontFamily: "monospace" }}>Saldo: {euro(d.saldo)}</div>
                  <div className="text-xs" style={{ color: C.muted, fontFamily: "monospace" }}>Entrate {euroPlain(d.entrate)} · Uscite {euroPlain(d.spese)}</div>
                </div>
              );
            };

            return (
              <>
                <Card eyebrow="Saldo mensile" style={{ marginBottom: 10 }}>
                  <div className="text-xs mb-2" style={{ color: C.muted }}>Tocca una barra per vedere il dettaglio del mese.</div>
                  <div style={{ width: "100%", height: 180 }}>
                    <ResponsiveContainer>
                      <BarChart data={datiSaldo} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                        <XAxis dataKey="mese" tick={{ fontSize: 9, fill: C.muted }} axisLine={{ stroke: C.border }} tickLine={false} />
                        <Tooltip content={<TooltipSaldo />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                        <Bar dataKey="saldo" radius={[3, 3, 3, 3]}>
                          {datiSaldo.map((d, i) => <Cell key={i} fill={d.saldo >= 0 ? C.green : C.red} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                    <div><div style={{ fontSize: 9.5, color: C.muted }} className="uppercase">Media/mese</div><div className="text-xs font-semibold" style={{ color: mediaSaldo >= 0 ? C.green : C.red, fontFamily: "monospace" }}>{euro(mediaSaldo)}</div></div>
                    <div><div style={{ fontSize: 9.5, color: C.muted }} className="uppercase">Mese migliore</div><div className="text-xs font-semibold" style={{ color: C.green, fontFamily: "monospace" }}>{migliore.mese} · {euroPlain(migliore.saldo)}</div></div>
                    <div><div style={{ fontSize: 9.5, color: C.muted }} className="uppercase">Mese peggiore</div><div className="text-xs font-semibold" style={{ color: C.red, fontFamily: "monospace" }}>{peggiore.mese} · {euroPlain(peggiore.saldo)}</div></div>
                  </div>
                </Card>
                <Card eyebrow="Ranking categorie (uscite)">
                  <div className="flex items-center gap-3">
                    <div style={{ width: 90, height: 90, flexShrink: 0 }}>
                      <ResponsiveContainer>
                        <PieChart><Pie data={perMacro.slice(0, 6)} dataKey="amount" nameKey="name" innerRadius={26} outerRadius={44} stroke="none">
                          {perMacro.slice(0, 6).map((c) => <Cell key={c.name} fill={c.color} />)}
                        </Pie></PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1">
                      {perMacro.slice(0, 6).map((c) => (
                        <div key={c.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1"><div style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: c.color }} /><span style={{ color: C.muted }}>{c.name}</span></div>
                          <span style={{ color: C.text }}>{c.pct.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </>
            );
          })()}

          {tab === "categorie" && (
            <Card>
              {perMacro.map((c) => {
                const espansa = macroEspansa === c.name;
                const micro = perMicroByMacro[c.name] || [];
                return (
                  <div key={c.name} className="mb-3">
                    <button onClick={() => setMacroEspansa(espansa ? null : c.name)} className="w-full flex items-center gap-3" style={{ background: "none", border: "none", padding: 0, textAlign: "left" }}>
                      <div style={{ width: 24, height: 24, borderRadius: 9999, backgroundColor: `${c.color}22`, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{c.rank}</div>
                      <div className="flex-1" style={{ minWidth: 0 }}>
                        <div className="flex justify-between text-xs mb-1"><span className="font-medium" style={{ color: C.text }}>{c.name}</span><span style={{ color: c.color, fontFamily: "monospace" }}>{euroPlain(c.amount)}</span></div>
                        <div style={{ height: 4, backgroundColor: C.panel2, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(c.pct * 2, 100)}%`, backgroundColor: c.color, borderRadius: 4 }} /></div>
                      </div>
                      <span className="text-xs" style={{ color: C.muted, flexShrink: 0 }}>{c.pct.toFixed(1)}%</span>
                    </button>

                    {espansa && micro.length > 0 && (
                      <div style={{ marginLeft: 34, marginTop: 8, borderLeft: `1px solid ${C.border}`, paddingLeft: 10 }}>
                        {micro.map((m) => (
                          <div key={m.name} className="flex items-center justify-between mb-2">
                            <span className="text-xs" style={{ color: C.muted }}>{m.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs" style={{ color: C.text, fontFamily: "monospace" }}>{euroPlain(m.amount)}</span>
                              <span className="text-xs" style={{ color: C.faint, minWidth: 36, textAlign: "right" }}>{m.pct.toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          )}

          {tab === "persone" && (
            <>
              <Card eyebrow="Confronto complessivo" style={{ marginBottom: 10 }}>
                <div className="flex justify-between text-xs mb-3" style={{ color: C.muted }}><span>← Spese</span><span>Entrate →</span></div>
                {perMembro.map((b) => <BilancioRow key={b.persona} {...b} maxVal={Math.max(1, ...perMembro.flatMap((x) => [x.entrate, x.spese]))} />)}
              </Card>
              {dettaglioMembro.map((d) => (
                <Card key={d.id} eyebrow={d.nome} style={{ marginBottom: 10 }}>
                  <div className="flex justify-between mb-2">
                    <div><div style={{ fontSize: 9.5, color: C.muted }} className="uppercase">Spesa media/mese</div><div className="text-sm font-semibold" style={{ color: C.text, fontFamily: "monospace" }}>{euroPlain(d.mediaMensileSpesa)}</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: 9.5, color: C.muted }} className="uppercase">Transazioni</div><div className="text-sm font-semibold" style={{ color: C.text }}>{d.numeroTransazioni}</div></div>
                  </div>
                  {d.categoriaTop && (
                    <div className="text-xs" style={{ color: C.muted }}>Categoria principale: <span style={{ color: C.text }}>{d.categoriaTop.nome}</span> <span style={{ fontFamily: "monospace" }}>({euroPlain(d.categoriaTop.importo)})</span></div>
                  )}
                </Card>
              ))}
            </>
          )}

          {tab === "tabella" && (
            <Card>
              <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 4, fontSize: 9, color: C.muted, marginBottom: 8 }} className="uppercase font-semibold">
                <span>Mese</span><span style={{ textAlign: "right" }}>Entrate</span><span style={{ textAlign: "right" }}>Uscite</span><span style={{ textAlign: "right" }}>Saldo</span>
              </div>
              {perMese.slice().reverse().map((m) => {
                const netto = m.entrate - m.spese;
                return (
                  <div key={m.mese} className="grid" style={{ gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 4, padding: "6px 0", borderTop: `1px solid ${C.border}`, fontSize: 11 }}>
                    <span style={{ color: C.text }}>{meseLabel(m.mese)}</span>
                    <span style={{ textAlign: "right", color: C.green, fontFamily: "monospace" }}>{euroPlain(m.entrate)}</span>
                    <span style={{ textAlign: "right", color: C.red, fontFamily: "monospace" }}>{euroPlain(m.spese)}</span>
                    <span style={{ textAlign: "right", color: netto >= 0 ? C.green : C.red, fontFamily: "monospace" }}>{euro(netto)}</span>
                  </div>
                );
              })}
            </Card>
          )}

          {tab === "confronto" && (
            <>
              <PillTabs options={[{ key: "mese", label: "vs Mese scorso" }, { key: "anno", label: "vs Anno scorso" }]} value={confrontoTipo} onChange={setConfrontoTipo} />

              {confrontoTipo === "mese" ? (
                mesePrecedente ? (() => {
                  const curr = datiMese(meseCorrente);
                  const prev = datiMese(mesePrecedente);
                  const rows = [
                    { label: "Entrate", curr: curr.entrate, prev: prev.entrate, color: C.green },
                    { label: "Uscite", curr: curr.spese, prev: prev.spese, color: C.red },
                    { label: "Saldo", curr: curr.entrate - curr.spese, prev: prev.entrate - prev.spese, color: C.violet },
                  ];
                  const macroCurr = macroDelMese(meseCorrente);
                  const macroPrevMap = Object.fromEntries(macroDelMese(mesePrecedente, 20));
                  return (
                    <>
                      <Card eyebrow={`${meseLabel(meseCorrente)} vs ${meseLabel(mesePrecedente)}`} style={{ marginBottom: 10 }}>
                        {rows.map((r) => {
                          const change = r.prev !== 0 ? ((r.curr - r.prev) / Math.abs(r.prev)) * 100 : null;
                          return (
                            <div key={r.label} className="flex justify-between items-center mb-2.5">
                              <span className="text-xs" style={{ color: C.muted }}>{r.label}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium" style={{ color: r.color, fontFamily: "monospace" }}>{euroPlain(r.curr)}</span>
                                {change !== null ? (
                                  <span className="flex items-center gap-0.5 text-xs" style={{ color: change < 0 ? C.red : C.green }}>
                                    {change < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />}{pct(change)}
                                  </span>
                                ) : <span className="text-xs" style={{ color: C.muted }}>n/d</span>}
                              </div>
                            </div>
                          );
                        })}
                      </Card>
                      <Card eyebrow="Uscite per categoria">
                        {macroCurr.map(([name, amount]) => {
                          const prevAmount = macroPrevMap[name];
                          const change = prevAmount ? ((amount - prevAmount) / prevAmount) * 100 : null;
                          return (
                            <div key={name} className="flex justify-between items-center mb-2">
                              <span className="text-xs" style={{ color: C.text }}>{name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs" style={{ color: C.text, fontFamily: "monospace" }}>{euroPlain(amount)}</span>
                                {change !== null ? <span className="text-xs" style={{ color: change < 0 ? C.green : C.red }}>{pct(change)}</span> : <span className="text-xs" style={{ color: C.muted }}>nuova</span>}
                              </div>
                            </div>
                          );
                        })}
                      </Card>
                    </>
                  );
                })() : <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Serve almeno un secondo mese di dati per confrontare.</div>
              ) : (
                annoScorsoStessMese && perMese.some((m) => m.mese === annoScorsoStessMese) ? (() => {
                  const curr = datiMese(meseCorrente);
                  const prev = datiMese(annoScorsoStessMese);
                  const rows = [
                    { label: "Entrate", curr: curr.entrate, prev: prev.entrate, color: C.green },
                    { label: "Uscite", curr: curr.spese, prev: prev.spese, color: C.red },
                    { label: "Saldo", curr: curr.entrate - curr.spese, prev: prev.entrate - prev.spese, color: C.violet },
                  ];
                  return (
                    <Card eyebrow={`${meseLabel(meseCorrente)} vs ${meseLabel(annoScorsoStessMese)}`}>
                      <div className="text-xs mb-3" style={{ color: C.muted }}>Differenza assoluta, non percentuale — più chiara quando un valore passa da negativo a positivo.</div>
                      {rows.map((r) => (
                        <div key={r.label} className="flex justify-between items-center mb-2.5">
                          <span className="text-xs" style={{ color: C.muted }}>{r.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium" style={{ color: r.color, fontFamily: "monospace" }}>{euroPlain(r.curr)}</span>
                            <span className="flex items-center gap-0.5 text-xs" style={{ color: r.curr - r.prev >= 0 ? C.green : C.red }}>
                              {r.curr - r.prev >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{euro(r.curr - r.prev)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </Card>
                  );
                })() : <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Non ho ancora dati dello stesso mese dell'anno scorso da confrontare.</div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
