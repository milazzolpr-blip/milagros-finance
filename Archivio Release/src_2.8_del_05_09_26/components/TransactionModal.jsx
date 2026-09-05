import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ArrowDownRight, ChevronRight, X, Camera, Banknote, CreditCard, Repeat, Wallet, Smartphone, Landmark, CalendarDays, Trash2, Paperclip } from "lucide-react";
import { C, todayLocal } from "../theme";
import { supabase } from "../lib/supabase";
import { notificaAltriMembri } from "../lib/notificaAltriMembri";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Sheet } from "./ui";

const METODI = [
  { key: "Cash", label: "Cash", icon: Banknote },
  { key: "Bancomat", label: "Bancomat", icon: CreditCard },
  { key: "Bonifico", label: "Bonifico", icon: Repeat },
  { key: "PayPal", label: "PayPal", icon: Wallet },
  { key: "G Pay", label: "G Pay", icon: Smartphone },
  { key: "C/C", label: "C/C", icon: Landmark },
];
const FALLBACK_COLOR = C.purple;

/**
 * Modale unica per creare E modificare transazioni.
 * Se `existing` è passato, parte precompilata in modalità modifica (con eliminazione).
 * Se `zIndex` è passato, si sovrappone ad altri Sheet già aperti (es. dettaglio mese).
 */
export default function TransactionModal({ workspace, member, existing, defaultDate, onClose, onSaved, onDeleted, zIndex, readOnly }) {
  const { user } = useAuth();
  const showToast = useToast();
  const isEdit = !!existing;

  const [members, setMembers] = useState([]);
  const [categorie, setCategorie] = useState([]);
  const [piuUsate, setPiuUsate] = useState([]);
  const [capitoli, setCapitoli] = useState([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [tipo, setTipo] = useState(existing?.tipo || "uscita");
  const [importo, setImporto] = useState(existing ? String(existing.importo) : "");
  const [personaId, setPersonaId] = useState(existing?.member_id || member?.id || null);
  const [descrizione, setDescrizione] = useState(existing?.voce || "");
  const [storicoVoci, setStoricoVoci] = useState([]);
  const [suggerimentiAperti, setSuggerimentiAperti] = useState(false);
  const [categoriaSel, setCategoriaSel] = useState(
    existing?.macro_categoria ? { macro: existing.macro_categoria, micro: existing.micro_categoria || null, color: FALLBACK_COLOR } : null
  );
  const [categoriaQuery, setCategoriaQuery] = useState("");
  const [categoriaOpen, setCategoriaOpen] = useState(false);
  const [expandedMacro, setExpandedMacro] = useState(null);
  const [metodo, setMetodo] = useState(existing?.modalita || null);
  const [capitoloId, setCapitoloId] = useState(existing?.capitolo_id || null);
  const [data, setData] = useState(existing?.date || defaultDate || todayLocal());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const [receiptPath, setReceiptPath] = useState(existing?.receipt_url || null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;

    async function load() {
      setLoadingRefs(true);
      const [{ data: mem }, { data: cats }, { data: recentTx }, { data: caps }] = await Promise.all([
        supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
        supabase.from("category_mappings").select("macro_categoria, micro_categoria, color").eq("workspace_id", workspace.id),
        supabase.from("transactions").select("voce, macro_categoria, micro_categoria").eq("workspace_id", workspace.id).eq("tipo", "uscita").order("date", { ascending: false }).limit(200),
        supabase.from("capitoli_spesa").select("id, nome, colore, icona").eq("workspace_id", workspace.id).order("data_inizio", { ascending: false }),
      ]);
      if (cancelled) return;

      setMembers(mem || []);
      setCapitoli(caps || []);

      const grouped = {};
      (cats || []).forEach((c) => {
        if (!grouped[c.macro_categoria]) grouped[c.macro_categoria] = { macro: c.macro_categoria, color: c.color || FALLBACK_COLOR, micro: [] };
        if (c.micro_categoria && !grouped[c.macro_categoria].micro.includes(c.micro_categoria)) {
          grouped[c.macro_categoria].micro.push(c.micro_categoria);
        }
      });
      setCategorie(Object.values(grouped));

      // Se stiamo modificando, allinea il colore reale della categoria già selezionata
      if (existing?.macro_categoria && grouped[existing.macro_categoria]) {
        setCategoriaSel((prev) => prev && { ...prev, color: grouped[existing.macro_categoria].color });
      }

      const freq = {};
      const vociVisteMap = new Map(); // voce (minuscolo) -> { voce originale, macro, micro }
      (recentTx || []).forEach((t) => {
        if (!t.macro_categoria) return;
        const key = `${t.macro_categoria}|||${t.micro_categoria || ""}`;
        freq[key] = (freq[key] || 0) + 1;
        if (t.voce) {
          const chiave = t.voce.trim().toLowerCase();
          if (chiave && !vociVisteMap.has(chiave)) {
            vociVisteMap.set(chiave, { voce: t.voce.trim(), macro: t.macro_categoria, micro: t.micro_categoria || null });
          }
        }
      });
      setStoricoVoci(Array.from(vociVisteMap.values()));
      const top = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key]) => {
          const [macro, micro] = key.split("|||");
          const color = grouped[macro]?.color || FALLBACK_COLOR;
          return { macro, micro: micro || null, color };
        });
      setPiuUsate(top);

      setLoadingRefs(false);
    }
    load();
    return () => { cancelled = true; };
  }, [workspace]); // eslint-disable-line

  // Anteprima firmata dello scontrino già allegato (bucket privato)
  useEffect(() => {
    if (!receiptPath) { setReceiptPreviewUrl(null); return; }
    let cancelled = false;
    supabase.storage.from("receipts").createSignedUrl(receiptPath, 3600).then(({ data }) => {
      if (!cancelled && data) setReceiptPreviewUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [receiptPath]);

  const suggerimentiVoce = useMemo(() => {
    const query = descrizione.trim().toLowerCase();
    if (!query) return [];
    const perPrefisso = storicoVoci.filter((v) => v.voce.toLowerCase().startsWith(query) && v.voce.toLowerCase() !== query);
    const perContenuto = storicoVoci.filter((v) => !v.voce.toLowerCase().startsWith(query) && v.voce.toLowerCase().includes(query));
    return [...perPrefisso, ...perContenuto].slice(0, 5);
  }, [descrizione, storicoVoci]);

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

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    setError("");
    const path = `${workspace.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("receipts").upload(path, file);
    setUploadingReceipt(false);
    if (uploadError) {
      setError("Upload scontrino fallito: " + uploadError.message);
      return;
    }
    setReceiptPath(path);
  };

  const handleRemoveReceipt = () => {
    setReceiptPath(null);
    setReceiptPreviewUrl(null);
  };

  const handleSave = async () => {
    if (!importoValido) return;
    setSaving(true);
    setError("");

    const payload = {
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
      capitolo_id: capitoloId,
      receipt_url: receiptPath,
    };

    const result = isEdit
      ? await supabase.from("transactions").update(payload).eq("id", existing.id)
      : await supabase.from("transactions").insert({ ...payload, created_by: user.id });

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (!isEdit) {
      notificaAltriMembri({
        workspaceId: workspace.id, escludiUserId: user.id, entityType: "transazione",
        title: `${member?.display_name || "Qualcuno"} ha registrato una transazione`,
        body: `${payload.tipo === "uscita" ? "-" : "+"}${Number(payload.importo).toFixed(2)} € · ${payload.voce}`,
        navigateTo: "/app/finanza",
      });
    }
    showToast(isEdit ? "Transazione aggiornata" : "Transazione salvata");
    onSaved();
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    setError("");
    const { error: delError } = await supabase.from("transactions").delete().eq("id", existing.id);
    setDeleting(false);
    if (delError) {
      setError(delError.message);
      return;
    }
    showToast("Transazione eliminata");
    onDeleted ? onDeleted() : onSaved();
  };

  return (
    <Sheet onClose={onClose} title={readOnly ? "Transazione" : isEdit ? "Modifica transazione" : "Nuova transazione"} zIndex={zIndex} right={
      readOnly ? null : (
        <>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFileChange} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploadingReceipt} className="flex items-center gap-1 text-xs font-medium" style={{ backgroundColor: C.purpleSoft, color: C.purple, borderRadius: 9999, padding: "5px 10px", border: "none" }}>
            <Camera size={12} /> {uploadingReceipt ? "Caricamento..." : "Scontrino"}
          </button>
        </>
      )
    }>
      {readOnly && (
        <div className="text-xs mb-4" style={{ color: C.muted, backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px" }}>
          Sola lettura — il tuo ruolo in questo workspace non permette di modificare le transazioni.
        </div>
      )}
      <div style={readOnly ? { pointerEvents: "none", opacity: 0.75 } : undefined}>
      {receiptPath && (
        <div className="flex items-center gap-2 mb-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 10px" }}>
          {receiptPreviewUrl ? (
            <img src={receiptPreviewUrl} alt="Scontrino allegato" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: C.panel2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Paperclip size={14} style={{ color: C.muted }} />
            </div>
          )}
          <span className="text-xs flex-1" style={{ color: C.muted }}>Scontrino allegato</span>
          <button onClick={handleRemoveReceipt} aria-label="Rimuovi scontrino" style={{ background: "none", border: "none" }}>
            <X size={14} style={{ color: C.muted }} />
          </button>
        </div>
      )}

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

      <div style={{ position: "relative", marginBottom: 16 }}>
        <input
          value={descrizione}
          onChange={(e) => { setDescrizione(e.target.value); setSuggerimentiAperti(true); }}
          onFocus={() => setSuggerimentiAperti(true)}
          onBlur={() => setTimeout(() => setSuggerimentiAperti(false), 120)}
          placeholder="Descrizione (es. Supermercato, Bar...)"
          style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box" }} />
        {suggerimentiAperti && suggerimentiVoce.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", zIndex: 5 }}>
            {suggerimentiVoce.map((v) => (
              <button key={v.voce} onMouseDown={(e) => {
                e.preventDefault();
                setDescrizione(v.voce);
                if (v.macro) {
                  const gruppo = categorie.find((g) => g.macro === v.macro);
                  setCategoriaSel({ macro: v.macro, micro: v.micro, color: gruppo?.color || FALLBACK_COLOR });
                }
                setSuggerimentiAperti(false);
              }} className="w-full flex items-center justify-between text-left" style={{ padding: "9px 14px", background: "none", border: "none", borderBottom: `1px solid ${C.border}` }}>
                <span className="text-sm truncate" style={{ color: C.text }}>{v.voce}</span>
                {v.macro && <span className="text-xs truncate flex-shrink-0" style={{ color: C.muted, marginLeft: 8 }}>{v.micro || v.macro}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

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
                {!categoriaQuery && piuUsate.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 6 }} className="uppercase">Più usate</div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {piuUsate.map((p) => (
                        <button
                          key={`${p.macro}|${p.micro}`}
                          onMouseDown={(e) => { e.preventDefault(); setCategoriaSel(p); setCategoriaOpen(false); }}
                          className="font-medium"
                          style={{ padding: "5px 10px", borderRadius: 9999, fontSize: 11, backgroundColor: `${p.color}22`, color: p.color, border: `1px solid ${p.color}` }}
                        >
                          {p.micro || p.macro}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 6 }} className="uppercase">Tutte le categorie</div>
                  </>
                )}
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

      {capitoli.length > 0 && (
        <>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Capitolo di spesa</div>
          <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
            <button onClick={() => setCapitoloId(null)} className="font-medium" style={{
              padding: "8px 14px", borderRadius: 12, fontSize: 12,
              backgroundColor: !capitoloId ? C.panel2 : C.panel, color: !capitoloId ? C.text : C.muted, border: `1px solid ${!capitoloId ? C.text : C.border}`,
            }}>Nessun capitolo</button>
            {capitoli.map((c) => {
              const active = capitoloId === c.id;
              const colore = c.colore || C.violet;
              return (
                <button key={c.id} onClick={() => setCapitoloId(c.id)} className="font-medium" style={{
                  padding: "8px 14px", borderRadius: 12, fontSize: 12,
                  backgroundColor: active ? colore : C.panel, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? colore : C.border}`,
                }}>
                  {c.icona ? `${c.icona} ` : ""}{c.nome}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="flex items-center gap-2 mb-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px" }}>
        <CalendarDays size={15} style={{ color: C.muted }} />
        <input type="date" value={data} onChange={(e) => setData(e.target.value)}
          style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: C.text, width: "100%", colorScheme: "dark" }} />
      </div>
      </div>

      {error && <div className="text-xs mb-3" style={{ color: C.red }}>{error}</div>}

      {!readOnly && (
        <button onClick={handleSave} disabled={!importoValido || saving} className="w-full font-semibold"
          style={{ padding: "14px 0", borderRadius: 14, fontSize: 14, backgroundColor: importoValido ? C.purple : C.panel, color: importoValido ? "#0a0b0f" : C.muted, opacity: (importoValido && !saving) ? 1 : 0.6, marginBottom: isEdit ? 10 : 0 }}>
          {saving ? "Salvataggio..." : isEdit ? "Salva modifiche" : "Salva transazione"}
        </button>
      )}

      {!readOnly && isEdit && (
        <button onClick={handleDelete} disabled={deleting} className="w-full flex items-center justify-center gap-2 font-medium"
          style={{ padding: "12px 0", borderRadius: 14, fontSize: 13, backgroundColor: confirmDelete ? C.red : "transparent", color: confirmDelete ? "#0a0b0f" : C.red, border: confirmDelete ? "none" : `1px solid ${C.red}` }}>
          <Trash2 size={14} />
          {deleting ? "Eliminazione..." : confirmDelete ? "Conferma eliminazione" : "Elimina transazione"}
        </button>
      )}
    </Sheet>
  );
}
