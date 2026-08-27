import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { LogOut, Plus, Sun, Moon, Palette, Download, Target } from "lucide-react";
import { C, euroPlain, todayLocal, applyTheme } from "../theme";
import { Card, PillTabs } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { exportTransactionsCsv } from "../lib/exportCsv";
import MembriTab from "../components/MembriTab";

const TEMI = [
  { key: "scuro", nome: "Scuro", desc: "Sfondo nero, testo bianco ad alto contrasto", Icon: Moon, disponibile: true },
  { key: "chiaro", nome: "Chiaro", desc: "Sfondo bianco, testo nero ad alto contrasto", Icon: Sun, disponibile: true },
  { key: "personalizzato", nome: "Personalizzato", desc: "Definisci i tuoi colori — in arrivo", Icon: Palette, disponibile: false },
];

function Toggle({ on, onClick, label }) {
  return (
    <button onClick={onClick} aria-label={label} role="switch" aria-checked={on}
      style={{ width: 36, height: 20, borderRadius: 9999, backgroundColor: on ? C.purple : C.border, position: "relative", flexShrink: 0, border: "none", transition: "background-color 0.15s" }}>
      <div style={{ width: 16, height: 16, borderRadius: 9999, backgroundColor: "#0a0b0f", position: "absolute", top: 2, left: on ? 18 : 2, transition: "left 0.15s" }} />
    </button>
  );
}

export default function AltroPage() {
  const { workspace, member, isReader } = useOutletContext();
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState("profilo");
  const isAdmin = member?.role === "admin";

  const tabOptions = [
    { key: "profilo", label: "Profilo" },
    { key: "workspace", label: "Workspace" },
    { key: "preferenze", label: "Preferenze" },
    ...(isAdmin ? [{ key: "membri", label: "Membri" }] : []),
  ];

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 4 }} className="uppercase">App</div>
      <h1 className="font-bold mb-4" style={{ fontSize: 26 }}>Impostazioni</h1>

      <PillTabs options={tabOptions} value={tab} onChange={setTab} />


      {tab === "profilo" && <ProfiloTab member={member} user={user} signOut={signOut} />}
      {tab === "workspace" && workspace && <WorkspaceTab workspace={workspace} isAdmin={isAdmin} isReader={isReader} />}
      {tab === "preferenze" && user && <PreferenzeTab user={user} />}
      {tab === "membri" && isAdmin && <MembriTab workspace={workspace} currentUserId={user.id} />}
    </div>
  );
}

function ProfiloTab({ member, user, signOut }) {
  return (
    <>
      <Card eyebrow="Connesso come" style={{ marginBottom: 10 }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 44, height: 44, borderRadius: 9999, backgroundColor: member?.colore || C.purple, display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0b0f", fontWeight: 700 }}>
            {(member?.display_name || user?.email || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm" style={{ color: C.text }}>{member?.display_name || "Utente"}</div>
            <div className="text-xs" style={{ color: C.muted }}>{user?.email}</div>
          </div>
          {member?.role === "admin" && <span style={{ backgroundColor: C.purpleSoft, color: C.purple, borderRadius: 9999, padding: "3px 10px", fontSize: 11 }}>Admin</span>}
        </div>
      </Card>
      <button onClick={signOut} className="w-full flex items-center gap-2" style={{ backgroundColor: "rgba(251,113,133,0.1)", border: `1px solid ${C.red}`, borderRadius: 14, padding: 14 }}>
        <LogOut size={16} style={{ color: C.red }} />
        <span className="text-sm font-medium" style={{ color: C.red }}>Esci dall'account</span>
      </button>
    </>
  );
}

function WorkspaceTab({ workspace, isAdmin, isReader }) {
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
    await supabase.from("category_mappings").insert({
      workspace_id: workspace.id,
      micro_categoria: nuovaMicro.trim(),
      macro_categoria: nuovaMacro.trim(),
    });
    setNuovaMicro(""); setNuovaMacro("");
    setSavingCat(false);
    load();
  };

  const handleAddRicorrente = async () => {
    if (!nuovoNome.trim() || !parseFloat(nuovoImporto) || !nuovoMember) return;
    setSavingRic(true);
    await supabase.from("recurring_categories").insert({
      workspace_id: workspace.id,
      nome: nuovoNome.trim(),
      macro_categoria: "Abbonamenti",
      importo: Math.abs(parseFloat(nuovoImporto)),
      member_id: nuovoMember,
      frequenza: "mensile",
      giorno: parseInt(nuovoGiorno, 10) || 1,
      data_inizio: todayLocal(),
      status: "active",
    });
    setNuovoNome(""); setNuovoImporto(""); setNuovoGiorno("1");
    setSavingRic(false);
    load();
  };

  const handleSetBudget = async () => {
    const val = parseFloat(budgetLimite);
    if (!budgetMacro || !val || val <= 0) return;
    setSavingBudget(true);
    await supabase.from("category_mappings")
      .update({ monthly_limit: val, alert_thresholds_monthly: [70, 100] })
      .eq("workspace_id", workspace.id)
      .eq("macro_categoria", budgetMacro);
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
            {macroDisponibili.map((m) => (
              <span key={m} style={{ fontSize: 11, color: C.muted, backgroundColor: C.panel2, borderRadius: 9999, padding: "3px 9px" }}>{m}</span>
            ))}
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

function PreferenzeTab({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfile(data);
      if (data?.tema) applyTheme(data.tema);
      setLoading(false);
    });
  }, [user.id]);

  const toggleField = async (field) => {
    const newValue = !profile[field];
    setProfile((p) => ({ ...p, [field]: newValue }));
    await supabase.from("profiles").update({ [field]: newValue }).eq("id", user.id);
  };

  const setTema = async (tema) => {
    setProfile((p) => ({ ...p, tema }));
    applyTheme(tema);
    await supabase.from("profiles").update({ tema }).eq("id", user.id);
  };

  if (loading || !profile) return <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>Caricamento...</div>;

  const notifOptions = [
    { field: "notif_budget_alerts", label: "Alert budget categoria", desc: "Avvisi quando superi le soglie impostate" },
    { field: "notif_workspace_activity", label: "Attività workspace", desc: "Nuove transazioni, modifiche, categorie" },
    { field: "notif_recurring", label: "Transazioni ricorrenti", desc: "Avviso quando viene auto-generata una spesa ricorrente" },
  ];

  return (
    <>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Tema dell'app</div>
      <div className="text-xs mb-3" style={{ color: C.muted }}>Si applica subito, su questo dispositivo, e resta ricordato al prossimo accesso.</div>
      <div className="space-y-2 mb-4">
        {TEMI.map((t) => {
          const active = profile.tema === t.key;
          const isChiaro = t.key === "chiaro";
          return (
            <button key={t.key} onClick={() => t.disponibile && setTema(t.key)} disabled={!t.disponibile} className="w-full flex items-center gap-3"
              style={{ backgroundColor: C.panel, border: `1px solid ${active ? C.purple : C.border}`, borderRadius: 14, padding: 12, textAlign: "left", opacity: t.disponibile ? 1 : 0.5 }}>
              <div style={{ width: 44, height: 34, borderRadius: 8, backgroundColor: isChiaro ? "#f1f2f5" : "#0d0e13", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <t.Icon size={14} color={isChiaro ? "#f59e0b" : C.violet} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: C.text }}>{t.nome}</div>
                <div className="text-xs" style={{ color: C.muted }}>{t.desc}</div>
              </div>
              {t.disponibile && <div style={{ width: 18, height: 18, borderRadius: 9999, border: `2px solid ${active ? C.purple : C.border}`, backgroundColor: active ? C.purple : "transparent", flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Notifiche</div>
      <Card>
        {notifOptions.map((n, i) => (
          <div key={n.field} className="flex items-center justify-between" style={{ paddingTop: i > 0 ? 10 : 0, paddingBottom: 10, borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ maxWidth: 220 }}><div className="text-sm" style={{ color: C.text }}>{n.label}</div><div className="text-xs" style={{ color: C.muted }}>{n.desc}</div></div>
            <Toggle on={!!profile[n.field]} onClick={() => toggleField(n.field)} label={n.label} />
          </div>
        ))}
      </Card>
    </>
  );
}

const smallInput = {
  flex: 1, backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10,
  padding: "9px 10px", fontSize: 12, color: C.text, outline: "none",
};
