import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, MapPin, CheckSquare, Square, Trash2 } from "lucide-react";
import { C, todayLocal } from "../theme";
import { PillTabs, Card, Sheet } from "../components/ui";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";

const TIPI_ENTITA = [
  { key: "figlio", label: "Figlio", icona: "🧒" },
  { key: "cane", label: "Cane", icona: "🐶" },
  { key: "gatto", label: "Gatto", icona: "🐱" },
  { key: "tartaruga", label: "Tartaruga", icona: "🐢" },
  { key: "personalizzato", label: "Altro", icona: "⭐" },
];

export default function AttivitaPage() {
  const { workspace, isReader } = useOutletContext();
  const [tab, setTab] = useState("figli");
  const moduli = workspace?.moduli_attivi || {};

  const tabOptions = [
    ...(moduli.figli ? [{ key: "figli", label: workspace?.nome_modulo_figli || "Figli" }] : []),
    ...(moduli.liste ? [{ key: "liste", label: "Liste" }] : []),
    { key: "luoghi", label: "Luoghi" },
  ];

  useEffect(() => {
    if (!tabOptions.some((t) => t.key === tab) && tabOptions.length) setTab(tabOptions[0].key);
  }, [moduli.figli, moduli.liste]); // eslint-disable-line

  if (!workspace) return null;

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 4 }} className="uppercase">Attività</div>
      <h1 className="font-bold mb-4" style={{ fontSize: 26 }}>Attività</h1>
      <PillTabs options={tabOptions} value={tab} onChange={setTab} />
      {tab === "figli" && <FigliTab workspace={workspace} isReader={isReader} />}
      {tab === "liste" && <ListeTab workspace={workspace} isReader={isReader} />}
      {tab === "luoghi" && <LuoghiTab workspace={workspace} />}
    </div>
  );
}

/* ============================== FIGLI ============================== */
function FigliTab({ workspace, isReader }) {
  const showToast = useToast();
  const [entita, setEntita] = useState([]);
  const [attivita, setAttivita] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNuovaEntita, setShowNuovaEntita] = useState(false);
  const [nomeEntita, setNomeEntita] = useState("");
  const [tipoEntita, setTipoEntita] = useState("figlio");
  const [saving, setSaving] = useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      supabase.from("entita_familiari").select("*").eq("workspace_id", workspace.id).order("nome"),
      supabase.from("entita_attivita").select("*, entita_familiari(nome, icona)").eq("workspace_id", workspace.id).gte("data", todayLocal()).order("data").limit(20),
    ]).then(([entRes, attRes]) => {
      setEntita(entRes.data || []);
      setAttivita(attRes.data || []);
      setLoading(false);
    });
  }, [workspace.id]);

  useEffect(() => { load(); }, [load]);

  const handleCreaEntita = async () => {
    if (!nomeEntita.trim()) return;
    setSaving(true);
    const t = TIPI_ENTITA.find((t) => t.key === tipoEntita);
    const { error } = await supabase.from("entita_familiari").insert({ workspace_id: workspace.id, nome: nomeEntita.trim(), tipo: tipoEntita, icona: t.icona, colore: C.orange });
    setSaving(false);
    if (error) { showToast("Salvataggio non riuscito: " + error.message, "error"); return; }
    showToast("Aggiunto");
    setNomeEntita("");
    setShowNuovaEntita(false);
    load();
  };

  if (loading) return <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>Caricamento...</div>;

  return (
    <>
      {entita.length > 0 && (
        <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
          {entita.map((e) => (
            <div key={e.id} className="flex items-center gap-2" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 9999, padding: "6px 12px" }}>
              <span>{e.icona}</span>
              <span className="text-xs font-medium" style={{ color: C.text }}>{e.nome}</span>
            </div>
          ))}
        </div>
      )}

      <Card eyebrow="Prossimi giorni" style={{ marginBottom: 10 }}>
        {attivita.length === 0 && <div className="text-xs" style={{ color: C.muted }}>Nessuna attività in programma.</div>}
        <div className="space-y-3">
          {attivita.map((a) => (
            <div key={a.id} className="flex items-center gap-3">
              <div style={{ width: 30, height: 30, borderRadius: 9999, backgroundColor: `${C.orange}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>{a.entita_familiari?.icona || "👤"}</div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="text-sm truncate" style={{ color: C.text }}>{a.titolo}</div>
                <div className="text-xs truncate" style={{ color: C.muted }}>{a.entita_familiari?.nome} · {a.data}{a.ora ? ` · ${a.ora.slice(0, 5)}` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {!isReader && (
        <>
          {showNuovaEntita ? (
            <Card>
              <input value={nomeEntita} onChange={(e) => setNomeEntita(e.target.value)} placeholder="Nome (es. Sofia, Fido...)"
                style={{ width: "100%", backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, color: C.text, outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
              <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
                {TIPI_ENTITA.map((t) => (
                  <button key={t.key} onClick={() => setTipoEntita(t.key)} className="text-xs font-medium" style={{ padding: "6px 12px", borderRadius: 9999, backgroundColor: tipoEntita === t.key ? C.orange : C.panel2, color: tipoEntita === t.key ? "#0a0b0f" : C.muted, border: `1px solid ${tipoEntita === t.key ? C.orange : C.border}` }}>
                    {t.icona} {t.label}
                  </button>
                ))}
              </div>
              <button onClick={handleCreaEntita} disabled={saving || !nomeEntita.trim()} className="w-full font-semibold" style={{ padding: "10px 0", borderRadius: 10, fontSize: 13, backgroundColor: C.purple, color: "#0a0b0f", border: "none", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Creazione..." : "Aggiungi"}
              </button>
            </Card>
          ) : (
            <button onClick={() => setShowNuovaEntita(true)} className="w-full flex items-center justify-center gap-2" style={{ border: `1px dashed ${C.border}`, borderRadius: 16, padding: 14, color: C.muted, background: "none" }}>
              <Plus size={16} /><span className="text-sm font-medium">Aggiungi figlio / animale</span>
            </button>
          )}
        </>
      )}
    </>
  );
}

/* ============================== LISTE ============================== */
function ListeTab({ workspace, isReader }) {
  const showToast = useToast();
  const [liste, setListe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aperta, setAperta] = useState(null);
  const [showNuova, setShowNuova] = useState(false);
  const [nomeLista, setNomeLista] = useState("");

  const load = React.useCallback(() => {
    setLoading(true);
    supabase.from("liste").select("*, liste_articoli(id, completato)").eq("workspace_id", workspace.id).order("created_at", { ascending: false })
      .then(({ data }) => { setListe(data || []); setLoading(false); });
  }, [workspace.id]);

  useEffect(() => { load(); }, [load]);

  const handleCrea = async () => {
    if (!nomeLista.trim()) return;
    const { error } = await supabase.from("liste").insert({ workspace_id: workspace.id, nome: nomeLista.trim() });
    if (error) { showToast("Salvataggio non riuscito: " + error.message, "error"); return; }
    showToast("Lista creata");
    setNomeLista("");
    setShowNuova(false);
    load();
  };

  if (loading) return <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>Caricamento...</div>;

  return (
    <>
      {liste.map((l) => {
        const totale = l.liste_articoli?.length || 0;
        const fatti = l.liste_articoli?.filter((a) => a.completato).length || 0;
        return (
          <button key={l.id} onClick={() => setAperta(l)} className="w-full text-left" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 10 }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: C.text }}>{l.nome}</span>
              <span className="text-xs" style={{ color: C.muted }}>{fatti}/{totale}</span>
            </div>
            {totale > 0 && (
              <div style={{ height: 4, backgroundColor: C.panel2, borderRadius: 4, overflow: "hidden", marginTop: 8 }}>
                <div style={{ height: "100%", width: `${(fatti / totale) * 100}%`, backgroundColor: C.fuchsia, borderRadius: 4 }} />
              </div>
            )}
          </button>
        );
      })}

      {!isReader && (
        showNuova ? (
          <Card>
            <input value={nomeLista} onChange={(e) => setNomeLista(e.target.value)} placeholder="Nome lista (es. Spesa settimanale)" autoFocus
              style={{ width: "100%", backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, color: C.text, outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
            <button onClick={handleCrea} className="w-full font-semibold" style={{ padding: "10px 0", borderRadius: 10, fontSize: 13, backgroundColor: C.purple, color: "#0a0b0f", border: "none" }}>Crea lista</button>
          </Card>
        ) : (
          <button onClick={() => setShowNuova(true)} className="w-full flex items-center justify-center gap-2" style={{ border: `1px dashed ${C.border}`, borderRadius: 16, padding: 14, color: C.muted, background: "none" }}>
            <Plus size={16} /><span className="text-sm font-medium">Nuova lista</span>
          </button>
        )
      )}

      {aperta && <ListaDetailSheet lista={aperta} isReader={isReader} onClose={() => { setAperta(null); load(); }} />}
    </>
  );
}

function ListaDetailSheet({ lista, isReader, onClose }) {
  const showToast = useToast();
  const [articoli, setArticoli] = useState([]);
  const [testo, setTesto] = useState("");
  const [luogo, setLuogo] = useState("");

  const load = React.useCallback(() => {
    supabase.from("liste_articoli").select("*").eq("lista_id", lista.id).order("created_at").then(({ data }) => setArticoli(data || []));
  }, [lista.id]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!testo.trim()) return;
    const { error } = await supabase.from("liste_articoli").insert({ lista_id: lista.id, testo: testo.trim(), luogo: luogo.trim() || null });
    if (error) { showToast("Salvataggio non riuscito: " + error.message, "error"); return; }
    setTesto(""); setLuogo("");
    load();
  };

  const toggle = async (a) => {
    const { error } = await supabase.from("liste_articoli").update({ completato: !a.completato }).eq("id", a.id);
    if (error) { showToast("Aggiornamento non riuscito: " + error.message, "error"); return; }
    load();
  };

  const remove = async (a) => {
    const { error } = await supabase.from("liste_articoli").delete().eq("id", a.id);
    if (error) { showToast("Eliminazione non riuscita: " + error.message, "error"); return; }
    showToast("Elemento rimosso");
    load();
  };

  return (
    <Sheet onClose={onClose} title={lista.nome}>
      <div className="space-y-2 mb-4">
        {articoli.length === 0 && <div className="text-xs" style={{ color: C.muted }}>Lista vuota.</div>}
        {articoli.map((a) => (
          <div key={a.id} className="flex items-center gap-2">
            <button onClick={() => !isReader && toggle(a)} style={{ background: "none", border: "none", flexShrink: 0 }}>
              {a.completato ? <CheckSquare size={18} style={{ color: C.green }} /> : <Square size={18} style={{ color: C.muted }} />}
            </button>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="text-sm" style={{ color: a.completato ? C.muted : C.text, textDecoration: a.completato ? "line-through" : "none" }}>{a.testo}</div>
              {a.luogo && <div className="text-xs flex items-center gap-1" style={{ color: C.muted }}><MapPin size={10} />{a.luogo}</div>}
            </div>
            {!isReader && (
              <button onClick={() => remove(a)} style={{ background: "none", border: "none", flexShrink: 0 }}><Trash2 size={13} style={{ color: C.red }} /></button>
            )}
          </div>
        ))}
      </div>

      {!isReader && (
        <>
          <input value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Nuovo elemento" onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.text, outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
          <input value={luogo} onChange={(e) => setLuogo(e.target.value)} placeholder="Serve andare in un posto specifico? (opzionale)" onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.text, outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
          <button onClick={handleAdd} disabled={!testo.trim()} className="w-full flex items-center justify-center gap-2 font-semibold" style={{
            padding: "12px 0", borderRadius: 10, fontSize: 13, border: "none",
            backgroundColor: testo.trim() ? C.purple : C.panel2, color: testo.trim() ? "#0a0b0f" : C.muted,
          }}>
            <Plus size={15} /> Aggiungi elemento
          </button>
        </>
      )}
    </Sheet>
  );
}

/* ============================== LUOGHI (aggregazione) ============================== */
function LuoghiTab({ workspace }) {
  const [luoghi, setLuoghi] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("liste_articoli").select("luogo, testo, liste!inner(workspace_id)").eq("liste.workspace_id", workspace.id).not("luogo", "is", null),
      supabase.from("entita_attivita").select("luogo, titolo").eq("workspace_id", workspace.id).not("luogo", "is", null),
      supabase.from("scadenze").select("luogo, titolo").eq("workspace_id", workspace.id).not("luogo", "is", null),
      supabase.from("eventi_generici").select("luogo, titolo").eq("workspace_id", workspace.id).not("luogo", "is", null),
    ]).then(([a, b, c, d]) => {
      const map = {};
      const aggiungi = (rows, campo) => (rows.data || []).forEach((r) => {
        if (!r.luogo) return;
        if (!map[r.luogo]) map[r.luogo] = [];
        map[r.luogo].push(r[campo]);
      });
      aggiungi(a, "testo"); aggiungi(b, "titolo"); aggiungi(c, "titolo"); aggiungi(d, "titolo");
      setLuoghi(Object.entries(map).map(([nome, items]) => ({ nome, items })));
      setLoading(false);
    });
  }, [workspace.id]);

  if (loading) return <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>Caricamento...</div>;

  return (
    <>
      <div className="text-xs mb-4" style={{ color: C.muted }}>
        Qui trovi tutti i luoghi collegati a un'attività, una scadenza o un elemento di una lista — non c'è nulla da creare qui direttamente.
      </div>
      {luoghi.length === 0 && <div className="text-xs text-center" style={{ color: C.muted, padding: "24px 0" }}>Nessun luogo salvato ancora.</div>}
      {luoghi.map((l) => (
        <Card key={l.nome} style={{ marginBottom: 10 }}>
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={14} style={{ color: C.sky }} />
            <span className="text-sm font-medium" style={{ color: C.text }}>{l.nome}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {l.items.map((it, i) => (
              <span key={i} className="text-xs" style={{ backgroundColor: C.panel2, color: C.muted, borderRadius: 9999, padding: "3px 9px" }}>{it}</span>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}
