import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, X, CalendarDays } from "lucide-react";
import { C, todayLocal } from "../theme";
import { Sheet } from "./ui";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";

export default function ScadenzaSheet({ workspace, existing, onClose, onSaved }) {
  const showToast = useToast();
  const isEdit = !!existing;
  const [members, setMembers] = useState([]);
  const [categorie, setCategorie] = useState([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [titolo, setTitolo] = useState(existing?.titolo || "");
  const [importo, setImporto] = useState(existing ? String(existing.importo ?? "") : "");
  const [personaId, setPersonaId] = useState(existing?.member_id || null);
  const [dataScadenza, setDataScadenza] = useState(existing?.data_scadenza || todayLocal());
  const [ricorrenza, setRicorrenza] = useState(existing?.ricorrenza || "nessuna");
  const [categoriaSel, setCategoriaSel] = useState(
    existing?.macro_categoria ? { macro: existing.macro_categoria, micro: existing.micro_categoria || null, color: C.amber } : null
  );
  const [categoriaQuery, setCategoriaQuery] = useState("");
  const [categoriaOpen, setCategoriaOpen] = useState(false);
  const [expandedMacro, setExpandedMacro] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;
    Promise.all([
      supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
      supabase.from("category_mappings").select("macro_categoria, micro_categoria, color").eq("workspace_id", workspace.id),
    ]).then(([{ data: mem }, { data: cats }]) => {
      if (cancelled) return;
      setMembers(mem || []);
      const grouped = {};
      (cats || []).forEach((c) => {
        if (!grouped[c.macro_categoria]) grouped[c.macro_categoria] = { macro: c.macro_categoria, color: c.color || C.amber, micro: [] };
        if (c.micro_categoria && !grouped[c.macro_categoria].micro.includes(c.micro_categoria)) {
          grouped[c.macro_categoria].micro.push(c.micro_categoria);
        }
      });
      setCategorie(Object.values(grouped));
      setLoadingRefs(false);
    });
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

  const valido = titolo.trim().length > 0 && dataScadenza;

  const handleSave = async () => {
    if (!valido) return;
    setSaving(true);
    setError("");
    const payload = {
      workspace_id: workspace.id,
      titolo: titolo.trim(),
      importo: importo ? Math.abs(parseFloat(importo)) : null,
      member_id: personaId,
      data_scadenza: dataScadenza,
      ricorrenza,
      macro_categoria: categoriaSel?.macro || null,
      micro_categoria: categoriaSel?.micro || null,
    };
    const result = isEdit
      ? await supabase.from("scadenze").update(payload).eq("id", existing.id)
      : await supabase.from("scadenze").insert(payload);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    showToast(isEdit ? "Scadenza aggiornata" : "Scadenza creata");
    onSaved();
  };

  return (
    <Sheet onClose={onClose} title={isEdit ? "Modifica scadenza" : "Nuova scadenza"}>
      <input value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Cosa devi pagare (es. Bolletta luce)"
        style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />

      <div style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 20, color: C.muted }}>€</span>
        <input type="number" value={importo} onChange={(e) => setImporto(e.target.value)} placeholder="0,00 (opzionale)"
          style={{ background: "transparent", border: "none", outline: "none", fontSize: 18, color: C.text, width: "100%", fontFamily: "monospace" }} />
      </div>

      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Assegnata a</div>
      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
        {members.map((m) => {
          const active = personaId === m.id;
          return (
            <button key={m.id} onClick={() => setPersonaId(m.id)} className="font-medium" style={{
              padding: "9px 14px", borderRadius: 12, fontSize: 13,
              backgroundColor: active ? (m.colore || C.purple) : C.panel, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? (m.colore || C.purple) : C.border}`,
            }}>{m.display_name}</button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Categoria (opzionale)</div>
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
              placeholder={loadingRefs ? "Caricamento..." : "Cerca categoria (serve per generare la transazione)"}
              style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box" }} />
            {categoriaOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10, zIndex: 10, maxHeight: 240, overflowY: "auto", boxShadow: "0 12px 28px rgba(0,0,0,0.45)" }}>
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
                            style={{ padding: 6, borderRadius: 8, flexShrink: 0, transform: isExpanded ? "rotate(90deg)" : "none" }}>
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

      <div className="flex items-center gap-2 mb-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px" }}>
        <CalendarDays size={15} style={{ color: C.muted }} />
        <input type="date" value={dataScadenza} onChange={(e) => setDataScadenza(e.target.value)}
          style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: C.text, width: "100%", colorScheme: "dark" }} />
      </div>

      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Ricorrenza</div>
      <div className="flex gap-2 mb-5">
        {[{ k: "nessuna", l: "Una tantum" }, { k: "mensile", l: "Mensile" }, { k: "annuale", l: "Annuale" }].map((r) => {
          const active = ricorrenza === r.k;
          return (
            <button key={r.k} onClick={() => setRicorrenza(r.k)} className="flex-1 font-medium" style={{
              padding: "9px 0", borderRadius: 10, fontSize: 12,
              backgroundColor: active ? C.purple : C.panel, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? C.purple : C.border}`,
            }}>{r.l}</button>
          );
        })}
      </div>

      {error && <div className="text-xs mb-3" style={{ color: C.red }}>{error}</div>}
      <button onClick={handleSave} disabled={!valido || saving} className="w-full font-semibold"
        style={{ padding: "14px 0", borderRadius: 14, fontSize: 14, backgroundColor: valido ? C.purple : C.panel, color: valido ? "#0a0b0f" : C.muted, opacity: (valido && !saving) ? 1 : 0.6, border: "none" }}>
        {saving ? "Salvataggio..." : isEdit ? "Salva modifiche" : "Crea scadenza"}
      </button>
    </Sheet>
  );
}
