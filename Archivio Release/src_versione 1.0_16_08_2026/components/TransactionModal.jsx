import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, ChevronRight, X, Camera, Banknote, CreditCard, Repeat, Wallet, Smartphone, MoreHorizontal, CalendarDays } from "lucide-react";
import { C } from "../theme";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Sheet } from "./ui";

const METODI = [
  { key: "Cash", label: "Cash", icon: Banknote },
  { key: "Bancomat", label: "Bancomat", icon: CreditCard },
  { key: "Bonifico", label: "Bonifico", icon: Repeat },
  { key: "PayPal", label: "PayPal", icon: Wallet },
  { key: "G Pay", label: "G Pay", icon: Smartphone },
  { key: "Altro", label: "Altro", icon: MoreHorizontal },
];
const FALLBACK_COLOR = C.purple;

export default function TransactionModal({ workspace, member, onClose, onSaved }) {
  const { user } = useAuth();

  const [members, setMembers] = useState([]);
  const [categorie, setCategorie] = useState([]); // [{macro, color, micro: [string]}]
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [tipo, setTipo] = useState("uscita");
  const [importo, setImporto] = useState("");
  const [personaId, setPersonaId] = useState(member?.id || null);
  const [descrizione, setDescrizione] = useState("");
  const [categoriaSel, setCategoriaSel] = useState(null);
  const [categoriaQuery, setCategoriaQuery] = useState("");
  const [categoriaOpen, setCategoriaOpen] = useState(false);
  const [expandedMacro, setExpandedMacro] = useState(null);
  const [metodo, setMetodo] = useState(null);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;

    async function load() {
      setLoadingRefs(true);
      const [{ data: mem }, { data: cats }] = await Promise.all([
        supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
        supabase.from("category_mappings").select("macro_categoria, micro_categoria, color").eq("workspace_id", workspace.id),
      ]);
      if (cancelled) return;

      setMembers(mem || []);

      const grouped = {};
      (cats || []).forEach((c) => {
        if (!grouped[c.macro_categoria]) grouped[c.macro_categoria] = { macro: c.macro_categoria, color: c.color || FALLBACK_COLOR, micro: [] };
        if (c.micro_categoria && !grouped[c.macro_categoria].micro.includes(c.micro_categoria)) {
          grouped[c.macro_categoria].micro.push(c.micro_categoria);
        }
      });
      setCategorie(Object.values(grouped));
      setLoadingRefs(false);
    }
    load();
    return () => { cancelled = true; };
  }, [workspace]);

  const categorieFiltrate = useMemo(() => {
    if (!categoriaQuery) return categorie;
    return categorie
      .map((g) => {
        const macroMatch = g.macro.toLowerCase().includes(categoriaQuery.toLowerCase());
        const microMatch = g.micro.filter((m) => m.toLowerCase().includes(categoriaQuery.toLowerCase()));
        if (macroMatch) return g;
        if (microMatch.length) return { ...g, micro: microMatch };
        return null;
      })
      .filter(Boolean);
  }, [categorie, categoriaQuery]);

  const importoValido = parseFloat(importo) > 0 && personaId;

  const handleSave = async () => {
    if (!importoValido) return;
    setSaving(true);
    setError("");

    const { error: insertError } = await supabase.from("transactions").insert({
      workspace_id: workspace.id,
      member_id: personaId,
      date: data,
      mese: data.slice(0, 7),
      tipo,
      importo: Math.abs(parseFloat(importo)),
      voce: descrizione || categoriaSel?.micro || categoriaSel?.macro || "Transazione",
      micro_categoria: categoriaSel?.micro || null,
      macro_categoria: categoriaSel?.macro || null,
      modalita: metodo,
      created_by: user.id,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onSaved();
  };

  return (
    <Sheet onClose={onClose} title="Nuova transazione" right={
      <button className="flex items-center gap-1 text-xs font-medium" style={{ backgroundColor: C.purpleSoft, color: C.purple, borderRadius: 9999, padding: "5px 10px" }}>
        <Camera size={12} /> Scontrino
      </button>
    }>
      <div className="flex gap-2 mb-4">
        {["uscita", "entrata"].map((t) => {
          const active = tipo === t;
          const color = t === "uscita" ? C.red : C.green;
          return (
            <button key={t} onClick={() => setTipo(t)} className="flex-1 flex items-center justify-center gap-1.5 font-medium capitalize"
              style={{ padding: "10px 0", borderRadius: 12, fontSize: 13, backgroundColor: active ? `${color}22` : "transparent", color: active ? color : C.muted, border: `1px solid ${active ? color : C.border}` }}>
              {t === "uscita" ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}{t}
            </button>
          );
        })}
      </div>

      <div style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 22, color: C.muted }}>€</span>
        <input type="number" value={importo} onChange={(e) => setImporto(e.target.value)} placeholder="0,00"
          style={{ background: "transparent", border: "none", outline: "none", fontSize: 22, color: C.text, width: "100%", fontFamily: "monospace" }} />
      </div>

      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Inserisci a nome di</div>
      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
        {members.length === 0 && !loadingRefs && <div className="text-xs" style={{ color: C.muted }}>Nessun membro trovato nel workspace.</div>}
        {members.map((m) => {
          const active = personaId === m.id;
          const color = m.colore || FALLBACK_COLOR;
          return (
            <button key={m.id} onClick={() => setPersonaId(m.id)} className="font-medium" style={{
              padding: "10px 16px", borderRadius: 12, fontSize: 13,
              backgroundColor: active ? color : C.panel, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? color : C.border}`,
            }}>
              {m.display_name}
            </button>
          );
        })}
      </div>

      <input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Descrizione (es. Supermercato, Bar...)"
        style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Categoria</div>
      <div style={{ position: "relative", marginBottom: 16 }}>
        {categoriaSel ? (
          <button onClick={() => { setCategoriaSel(null); setCategoriaQuery(""); setCategoriaOpen(true); }} className="w-full flex items-center justify-between"
            style={{ backgroundColor: `${categoriaSel.color}22`, border: `1px solid ${categoriaSel.color}`, borderRadius: 12, padding: "12px 14px" }}>
            <span className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 500, color: categoriaSel.color }}>
              <span style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: categoriaSel.color }} />
              {categoriaSel.micro ? `${categoriaSel.macro} · ${categoriaSel.micro}` : categoriaSel.macro}
            </span>
            <X size={14} style={{ color: categoriaSel.color }} />
          </button>
        ) : (
          <>
            <input value={categoriaQuery} onChange={(e) => { setCategoriaQuery(e.target.value); setCategoriaOpen(true); }}
              onFocus={() => setCategoriaOpen(true)} onBlur={() => setCategoriaOpen(false)}
              placeholder={loadingRefs ? "Caricamento categorie..." : "Cerca categoria o sottocategoria..."}
              style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box" }} />
            {categoriaOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10, zIndex: 10, maxHeight: 260, overflowY: "auto", boxShadow: "0 12px 28px rgba(0,0,0,0.45)" }}>
                {categorieFiltrate.length === 0 && (
                  <div className="text-xs" style={{ color: C.muted, padding: "8px 4px" }}>
                    {loadingRefs ? "Caricamento..." : "Nessuna categoria trovata. Aggiungile da Impostazioni → Workspace."}
                  </div>
                )}
                {categorieFiltrate.map((g) => {
                  const isExpanded = categoriaQuery ? true : expandedMacro === g.macro;
                  const hasChildren = g.micro.length > 0;
                  return (
                    <div key={g.macro} style={{ marginBottom: 2 }}>
                      <div className="flex items-center" style={{ gap: 2 }}>
                        <button onMouseDown={(e) => { e.preventDefault(); setCategoriaSel({ macro: g.macro, micro: null, color: g.color }); setCategoriaOpen(false); }}
                          className="flex-1 flex items-center gap-2" style={{ padding: "8px 6px", borderRadius: 8, fontSize: 13, color: C.text, textAlign: "left", fontWeight: 500 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: g.color, flexShrink: 0 }} />
                          {g.macro}
                        </button>
                        {hasChildren && (
                          <button onMouseDown={(e) => { e.preventDefault(); setExpandedMacro(isExpanded ? null : g.macro); }}
                            style={{ padding: 6, borderRadius: 8, flexShrink: 0, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
                            <ChevronRight size={14} style={{ color: C.muted }} />
                          </button>
                        )}
                      </div>
                      {hasChildren && isExpanded && (
                        <div style={{ marginLeft: 18, borderLeft: `1px solid ${C.border}`, paddingLeft: 8 }}>
                          {g.micro.map((m) => (
                            <button key={m} onMouseDown={(e) => { e.preventDefault(); setCategoriaSel({ macro: g.macro, micro: m, color: g.color }); setCategoriaOpen(false); }}
                              className="w-full flex items-center gap-2" style={{ padding: "6px 6px", borderRadius: 8, fontSize: 12, color: C.muted, textAlign: "left" }}>
                              <span style={{ width: 5, height: 5, borderRadius: 9999, backgroundColor: g.color, flexShrink: 0, opacity: 0.7 }} />
                              {m}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Metodo</div>
      <div className="grid grid-cols-6 gap-1 mb-4">
        {METODI.map((m) => {
          const active = metodo === m.key;
          const Icon = m.icon;
          return (
            <button key={m.key} onClick={() => setMetodo(m.key)} className="flex flex-col items-center gap-0.5"
              style={{ padding: "8px 2px", borderRadius: 10, backgroundColor: active ? C.purpleSoft : C.panel, border: `1px solid ${active ? C.purple : C.border}` }}>
              <Icon size={14} color={active ? C.purple : C.muted} />
              <span style={{ fontSize: 8, color: active ? C.purple : C.muted, whiteSpace: "nowrap" }}>{m.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px" }}>
        <CalendarDays size={15} style={{ color: C.muted }} />
        <input type="date" value={data} onChange={(e) => setData(e.target.value)}
          style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: C.text, width: "100%", colorScheme: "dark" }} />
      </div>

      {error && <div className="text-xs mb-3" style={{ color: C.red }}>{error}</div>}

      <button onClick={handleSave} disabled={!importoValido || saving} className="w-full font-semibold"
        style={{ padding: "14px 0", borderRadius: 14, fontSize: 14, backgroundColor: importoValido ? C.purple : C.panel, color: importoValido ? "#0a0b0f" : C.muted, opacity: (importoValido && !saving) ? 1 : 0.6 }}>
        {saving ? "Salvataggio..." : "Salva transazione"}
      </button>
    </Sheet>
  );
}
