import React, { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, ChevronRight, TrendingUp, TrendingDown, PiggyBank, AlertTriangle } from "lucide-react";
import { C, euro, euroPlain } from "../theme";
import { Card, SectionLabel, PillTabs, BilancioRow } from "../components/ui";
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

export default function HomePage() {
  const { workspace, refreshKey, bumpRefresh, isReader } = useOutletContext();
  const navigate = useNavigate();
  const [period, setPeriod] = useState("mese");
  const [members, setMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [prevTransactions, setPrevTransactions] = useState([]);
  const [budgets, setBudgets] = useState({}); // { macro: { limit, thresholds } }
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [tx, prevTx, { data: mem }, { data: cats }] = await Promise.all([
        fetchAllTransactions(workspace.id, period === "mese" ? { mese: currentMonthStr() } : {}),
        period === "mese" ? fetchAllTransactions(workspace.id, { mese: prevMonthStr() }) : Promise.resolve([]),
        supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
        supabase.from("category_mappings").select("macro_categoria, monthly_limit, alert_thresholds_monthly").eq("workspace_id", workspace.id),
      ]);

      if (cancelled) return;
      setTransactions(tx || []);
      setPrevTransactions(prevTx || []);
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
    return () => { cancelled = true; };
  }, [workspace, period, refreshKey]);

  if (!workspace) return null;

  const entrate = transactions.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0);
  const spese = transactions.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0);
  const saldo = entrate - spese;

  const prevEntrate = prevTransactions.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0);
  const prevSpese = prevTransactions.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0);
  const prevSaldo = prevEntrate - prevSpese;
  const hasPrevData = period === "mese" && prevTransactions.length > 0;

  const bilancio = members.map((m) => {
    const memTx = transactions.filter((t) => t.member_id === m.id);
    return {
      persona: m.display_name,
      color: m.colore || C.purple,
      entrate: memTx.filter((t) => t.tipo === "entrata").reduce((s, t) => s + Number(t.importo), 0),
      spese: memTx.filter((t) => t.tipo === "uscita").reduce((s, t) => s + Number(t.importo), 0),
    };
  });
  const maxBilancio = Math.max(1, ...bilancio.flatMap((b) => [b.entrate, b.spese]));

  const categorieMap = {};
  transactions.filter((t) => t.tipo === "uscita" && t.macro_categoria).forEach((t) => {
    categorieMap[t.macro_categoria] = (categorieMap[t.macro_categoria] || 0) + Number(t.importo);
  });
  const topCategorie = Object.entries(categorieMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const maxCategoria = Math.max(1, ...topCategorie.map(([, v]) => v));

  const recenti = transactions.slice(0, 5);

  const handleEditDone = () => {
    setEditing(null);
    bumpRefresh?.();
  };

  return (
    <div>
      <h1 className="font-bold mb-4" style={{ fontSize: 26 }}>Dashboard</h1>

      <PillTabs options={[{ key: "mese", label: "Questo mese" }, { key: "sempre", label: "Da sempre" }]} value={period} onChange={setPeriod} />

      {loading ? (
        <div style={{ color: C.muted, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Caricamento...</div>
      ) : (
        <>
          <div style={{ borderRadius: 20, padding: 20, marginBottom: 10, background: "linear-gradient(135deg, #241b3e 0%, #15171f 100%)", border: "1px solid #2d2545" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">
              Saldo · {period === "mese" ? "questo mese" : "da sempre"}
            </div>
            <div className="font-bold mb-3" style={{ fontSize: 32, color: saldo >= 0 ? C.green : C.red }}>{euro(saldo)}</div>
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

          {transactions.length === 0 && (
            <div style={{ color: C.muted, fontSize: 12, padding: "8px 4px 16px" }}>
              Nessuna transazione trovata per questo periodo — normale se i dati non sono ancora stati importati, o se non ne hai ancora registrate.
            </div>
          )}

          {members.length > 0 && (
            <>
              <SectionLabel color={C.purple}>Bilancio per persona</SectionLabel>
              <Card>
                <div className="flex justify-between text-xs mb-3" style={{ color: C.muted }}><span>← Spese</span><span>Entrate →</span></div>
                {bilancio.map((b) => <BilancioRow key={b.persona} {...b} maxVal={maxBilancio} />)}
              </Card>
            </>
          )}

          {topCategorie.length > 0 && (
            <>
              <SectionLabel color={C.violet}>Analisi</SectionLabel>
              <Card eyebrow="Top categorie">
                {topCategorie.map(([name, amount]) => {
                  const budget = budgets[name];
                  const budgetPct = budget ? (amount / budget.limit) * 100 : null;
                  const soglie = budget?.thresholds?.length ? budget.thresholds : [70, 100];
                  const overSoglia = budgetPct !== null && budgetPct >= soglie[0];
                  const overLimite = budgetPct !== null && budgetPct >= 100;
                  return (
                    <div key={name} className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: C.text }} className="font-medium flex items-center gap-1">
                          {name}
                          {overSoglia && <AlertTriangle size={11} style={{ color: overLimite ? C.red : C.amber }} />}
                        </span>
                        <span style={{ color: C.text, fontFamily: "monospace" }}>
                          {euroPlain(amount)}{budget && <span style={{ color: C.muted }}> / {euroPlain(budget.limit)}</span>}
                        </span>
                      </div>
                      <div style={{ height: 5, backgroundColor: C.panel2, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${budget ? Math.min(budgetPct, 100) : (amount / maxCategoria) * 100}%`, backgroundColor: overLimite ? C.red : overSoglia ? C.amber : C.violet, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </Card>
            </>
          )}

          {recenti.length > 0 && (
            <Card style={{ marginTop: 16 }}>
              <div className="flex items-center justify-between mb-3">
                <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600 }} className="uppercase">Ultime transazioni</div>
                <button onClick={() => navigate("/app/mesi")} className="flex items-center gap-0.5 font-medium text-xs" style={{ color: C.purple, background: "none", border: "none" }}>
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

          <button onClick={() => navigate("/app/risparmi")} className="w-full flex items-center gap-2" style={{ marginTop: 10, backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
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
