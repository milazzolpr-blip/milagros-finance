import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Download, Target } from "lucide-react";
import { C, euroPlain, todayLocal } from "../theme";
import { Card } from "../components/ui";
import { supabase } from "../lib/supabase";
import { exportTransactionsCsv } from "../lib/exportCsv";

export default function FinanzaCategorieTab() {
  const { workspace, member, isReader } = useOutletContext();
  const isAdmin = member?.role === "admin";

  const [categorie, setCategorie] = useState([]);
  const [ricorrenti, setRicorrenti] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");

  const [nuovaMicro, setNuovaMicro] = useState("");
  const [nuovaMacro, setNuovaMacro] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  const [nuovoNome, setNuovoNome] = useState("");
  const [nuovoImporto, setNuovoImporto] = useState("");
  const [nuovoGiorno, setNuovoGiorno] = useState("1");
  const [nuovoMember, setNuovoMember] = useState(null);
  const [savingRic, setSavingRic] = useState(false);

  const [budgetMacro, setBudgetMacro] = useState("");
  const [budgetLimite, setBudgetLimite] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      supabase.from("category_mappings").select("*").eq("workspace_id", workspace.id).order("macro_categoria"),
      supabase.from("recurring_categories").select("*").eq("workspace_id", workspace.id).order("giorno"),
      supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
    ]).then(([catRes, ricRes, memRes]) => {
      setCategorie(catRes.data || []);
      setRicorrenti(ricRes.data || []);
      setMembers(memRes.data || []);
      if (!nuovoMember && memRes.data?.length) setNuovoMember(memRes.data[0].id);
      if (!budgetMacro && catRes.data?.length) setBudgetMacro(catRes.data[0].macro_categoria);
      setLoading(false);
    });
  }, [workspace]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const macroDisponibili = [...new Set(categorie.map((c) => c.macro_categoria))].sort();
  const budgetsAttivi = {};
  categorie.forEach((c) => {
    if (c.monthly_limit != null) budgetsAttivi[c.macro_categoria] = Math.max(budgetsAttivi[c.macro_categoria] || 0, Number(c.monthly_limit));
  });

  const handleAddCategoria = async () => {
    if (!nuovaMicro.trim() || !nuovaMacro.trim()) return;
    setSavingCat(true);
    await supabase.from("category_mappings").insert({ workspace_id: workspace.id, micro_categoria: nuovaMicro.trim(), macro_categoria: nuovaMacro.trim() });
    setNuovaMicro(""); setNuovaMacro("");
    setSavingCat(false);
    load();
  };

  const handleAddRicorrente = async () => {
    if (!nuovoNome.trim() || !parseFloat(nuovoImporto) || !nuovoMember) return;
    setSavingRic(true);
    await supabase.from("recurring_categories").insert({
      workspace_id: workspace.id, nome: nuovoNome.trim(), macro_categoria: "Abbonamenti",
      importo: Math.abs(parseFloat(nuovoImporto)), member_id: nuovoMember, frequenza: "mensile",
      giorno: parseInt(nuovoGiorno, 10) || 1, data_inizio: todayLocal(), status: "active",
    });
    setNuovoNome(""); setNuovoImporto(""); setNuovoGiorno("1");
    setSavingRic(false);
    load();
  };

  const handleSetBudget = async () => {
    const val = parseFloat(budgetLimite);
    if (!budgetMacro || !val || val <= 0) return;
    setSavingBudget(true);
    await supabase.from("category_mappings").update({ monthly_limit: val, alert_thresholds_monthly: [70, 100] }).eq("workspace_id", workspace.id).eq("macro_categoria", budgetMacro);
    setBudgetLimite("");
    setSavingBudget(false);
    load();
  };

  const handleRemoveBudget = async (macro) => {
    await supabase.from("category_mappings").update({ monthly_limit: null, alert_thresholds_monthly: [] }).eq("workspace_id", workspace.id).eq("macro_categoria", macro);
    load();
  };

  const handleExport = async () => {
    setExporting(true);
    setExportMsg("");
    const membersById = Object.fromEntries(members.map((m) => [m.id, m]));
    try {
      const count = await exportTransactionsCsv(workspace.id, membersById);
      setExportMsg(`${count} transazioni esportate.`);
    } catch (e) {
      setExportMsg("Export fallito: " + e.message);
    }
    setExporting(false);
  };

  if (loading) return <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>Caricamento...</div>;

  return (
    <>
      <Card eyebrow="Categorie" style={{ marginBottom: 10 }}>
        <div className="text-xs mb-3" style={{ color: C.muted }}>{categorie.length} categorie · {macroDisponibili.length} macro-categorie</div>
        {isAdmin && (
          <div className="flex gap-2 mb-3">
            <input value={nuovaMicro} onChange={(e) => setNuovaMicro(e.target.value)} placeholder="Micro (es. Bar)" style={smallInput} />
            <input value={nuovaMacro} onChange={(e) => setNuovaMacro(e.target.value)} placeholder="Macro (es. Cibo)" style={smallInput} />
            <button onClick={handleAddCategoria} disabled={savingCat} aria-label="Aggiungi categoria" style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", opacity: savingCat ? 0.6 : 1 }}>
              <Plus size={16} color="#0a0b0f" />
            </button>
          </div>
        )}
        {macroDisponibili.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {macroDisponibili.map((m) => <span key={m} style={{ fontSize: 11, color: C.muted, backgroundColor: C.panel2, borderRadius: 9999, padding: "3px 9px" }}>{m}</span>)}
          </div>
        )}
      </Card>

      <Card eyebrow="Budget mensile per categoria" style={{ marginBottom: 10 }}>
        <div className="text-xs mb-3" style={{ color: C.muted }}>Imposta un limite di spesa mensile per macro-categoria. In Home ti avviso quando superi il 70% e il 100%.</div>
        {Object.entries(budgetsAttivi).length > 0 && (
          <div className="space-y-2 mb-3">
            {Object.entries(budgetsAttivi).map(([macro, limite]) => (
              <div key={macro} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: C.text }}>{macro}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: C.muted, fontFamily: "monospace" }}>{euroPlain(limite)}/mese</span>
                  {isAdmin && <button onClick={() => handleRemoveBudget(macro)} className="text-xs" style={{ color: C.red, background: "none", border: "none" }}>rimuovi</button>}
                </div>
              </div>
            ))}
          </div>
        )}
        {isAdmin && (
          <div className="flex gap-2">
            <select value={budgetMacro} onChange={(e) => setBudgetMacro(e.target.value)} style={{ ...smallInput, flex: 1.4 }}>
              {macroDisponibili.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input type="number" value={budgetLimite} onChange={(e) => setBudgetLimite(e.target.value)} placeholder="€ / mese" style={{ ...smallInput, maxWidth: 90 }} />
            <button onClick={handleSetBudget} disabled={savingBudget} aria-label="Imposta budget" style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", opacity: savingBudget ? 0.6 : 1 }}>
              <Target size={14} color="#0a0b0f" />
            </button>
          </div>
        )}
      </Card>

      <Card eyebrow="Abbonamenti / spese ricorrenti" style={{ marginBottom: 10 }}>
        <div className="text-xs mb-3" style={{ color: C.muted }}>Al primo accesso all'app dopo il giorno previsto, la transazione del mese viene generata da sola.</div>
        {ricorrenti.map((r) => (
          <div key={r.id} className="flex items-center gap-3 mb-2.5">
            <div style={{ width: 30, height: 30, borderRadius: 9999, backgroundColor: `${C.sky}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, color: C.sky, fontWeight: 700 }}>{r.giorno}</div>
            <div className="flex-1"><div className="text-sm" style={{ color: C.text }}>{r.nome}</div><div className="text-xs" style={{ color: C.muted }}>ogni mese, giorno {r.giorno}{r.status !== "active" && " · fermata"}</div></div>
            <span className="text-xs" style={{ color: C.red, fontFamily: "monospace" }}>{euroPlain(r.importo)}</span>
          </div>
        ))}
        {ricorrenti.length === 0 && <div className="text-xs mb-3" style={{ color: C.muted }}>Nessuno ancora.</div>}
        {isAdmin && (
          <>
            <div className="flex gap-2 mb-2" style={{ marginTop: 10 }}>
              <input value={nuovoNome} onChange={(e) => setNuovoNome(e.target.value)} placeholder="Nome (es. Netflix)" style={smallInput} />
              <input value={nuovoImporto} onChange={(e) => setNuovoImporto(e.target.value)} placeholder="€" type="number" style={{ ...smallInput, maxWidth: 70 }} />
            </div>
            <div className="flex gap-2">
              <select value={nuovoMember || ""} onChange={(e) => setNuovoMember(e.target.value)} style={{ ...smallInput, flex: 1 }}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
              <input value={nuovoGiorno} onChange={(e) => setNuovoGiorno(e.target.value)} placeholder="Giorno" type="number" min="1" max="31" style={{ ...smallInput, maxWidth: 70 }} />
              <button onClick={handleAddRicorrente} disabled={savingRic} aria-label="Aggiungi ricorrente" style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", opacity: savingRic ? 0.6 : 1 }}>
                <Plus size={16} color="#0a0b0f" />
              </button>
            </div>
          </>
        )}
      </Card>

      {!isReader && (
        <Card eyebrow="Dati">
          <button onClick={handleExport} disabled={exporting} className="w-full flex items-center justify-center gap-2 font-medium" style={{ padding: "12px 0", borderRadius: 12, fontSize: 13, backgroundColor: C.panel2, color: C.text, border: `1px solid ${C.border}` }}>
            <Download size={14} /> {exporting ? "Esportazione..." : "Esporta tutte le transazioni (CSV)"}
          </button>
          {exportMsg && <div className="text-xs mt-2" style={{ color: C.muted, textAlign: "center" }}>{exportMsg}</div>}
        </Card>
      )}
    </>
  );
}

const smallInput = { flex: 1, backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 10px", fontSize: 12, color: C.text, outline: "none" };
