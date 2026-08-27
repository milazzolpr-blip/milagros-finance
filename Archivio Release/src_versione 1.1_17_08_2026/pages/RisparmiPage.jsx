import React, { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { C, euroPlain } from "../theme";
import { Sheet } from "../components/ui";
import { supabase } from "../lib/supabase";
import ContoDetailSheet from "../components/ContoDetailSheet";

function NewContoSheet({ workspace, onClose, onCreated }) {
  const [nome, setNome] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const valido = nome.trim().length > 0;

  const handleSave = async () => {
    if (!valido) return;
    setSaving(true);
    setError("");
    const { error: insertError } = await supabase.from("conti_deposito").insert({
      workspace_id: workspace.id,
      nome: nome.trim(),
      descrizione: descrizione.trim() || null,
      target_amount: targetAmount ? parseFloat(targetAmount) : null,
      target_date: targetDate || null,
      colore: C.green,
      icona: "🐷",
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    onCreated();
  };

  return (
    <Sheet onClose={onClose} title="Nuovo obiettivo di risparmio">
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (es. Vacanza estate, Fondo emergenze)"
        style={inputStyle} />
      <input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Descrizione (opzionale)" style={inputStyle} />
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Obiettivo €</div>
          <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="es. 2000" style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
        <div className="flex-1">
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Entro il</div>
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={{ ...inputStyle, marginBottom: 0, colorScheme: "dark" }} />
        </div>
      </div>
      {error && <div className="text-xs mb-3" style={{ color: C.red }}>{error}</div>}
      <button onClick={handleSave} disabled={!valido || saving} className="w-full font-semibold"
        style={{ padding: "14px 0", borderRadius: 14, fontSize: 14, backgroundColor: valido ? C.purple : C.panel, color: valido ? "#0a0b0f" : C.muted, opacity: (valido && !saving) ? 1 : 0.6, border: "none" }}>
        {saving ? "Creazione..." : "Crea obiettivo"}
      </button>
    </Sheet>
  );
}
const inputStyle = { width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.text, outline: "none", marginBottom: 12, boxSizing: "border-box" };

export default function RisparmiPage() {
  const { workspace } = useOutletContext();
  const navigate = useNavigate();
  const [conti, setConti] = useState([]);
  const [saldi, setSaldi] = useState({});
  const [loading, setLoading] = useState(true);
  const [selezionato, setSelezionato] = useState(null);
  const [showNuovo, setShowNuovo] = useState(false);

  const load = React.useCallback(() => {
    if (!workspace) return;
    setLoading(true);
    Promise.all([
      supabase.from("conti_deposito").select("*").eq("workspace_id", workspace.id).order("created_date", { ascending: false }),
      supabase.from("deposito_movimenti").select("conto_id, importo, tipo"),
    ]).then(([contiRes, movRes]) => {
      const s = {};
      (movRes.data || []).forEach((m) => {
        s[m.conto_id] = (s[m.conto_id] || 0) + (m.tipo === "deposito" ? Number(m.importo) : -Number(m.importo));
      });
      setSaldi(s);
      setConti(contiRes.data || []);
      setLoading(false);
    });
  }, [workspace]);

  useEffect(() => { load(); }, [load]);

  if (!workspace) return null;

  return (
    <div>
      <button onClick={() => navigate("/app")} className="flex items-center gap-1 text-xs font-medium mb-4" style={{ color: C.muted, background: "none", border: "none" }}>
        <ArrowLeft size={14} /> Torna alla Home
      </button>
      <h1 className="font-bold mb-5" style={{ fontSize: 26 }}>Obiettivi di risparmio</h1>

      {loading && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>Caricamento...</div>}
      {!loading && conti.length === 0 && (
        <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Nessun obiettivo ancora — creane uno per iniziare a mettere da parte qualcosa.</div>
      )}

      {conti.map((c) => {
        const saldo = saldi[c.id] || 0;
        const pct = c.target_amount ? Math.min((saldo / Number(c.target_amount)) * 100, 100) : null;
        return (
          <button key={c.id} onClick={() => setSelezionato(c)} className="w-full text-left" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 10 }}>
            <div className="flex items-center gap-3 mb-2">
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${c.colore || C.green}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{c.icona || "🐷"}</div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="font-medium text-sm" style={{ color: C.text }}>{c.nome}</div>
                {c.target_amount && <div className="text-xs" style={{ color: C.muted }}>Obiettivo {euroPlain(c.target_amount)}</div>}
              </div>
              <div className="font-semibold text-sm" style={{ color: C.green, fontFamily: "monospace", flexShrink: 0 }}>{euroPlain(saldo)}</div>
            </div>
            {pct !== null && (
              <div style={{ height: 5, backgroundColor: C.panel2, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, backgroundColor: C.green, borderRadius: 4 }} />
              </div>
            )}
          </button>
        );
      })}

      <button onClick={() => setShowNuovo(true)} className="w-full flex items-center justify-center gap-2" style={{ border: `1px dashed ${C.border}`, borderRadius: 16, padding: 14, color: C.muted, background: "none" }}>
        <Plus size={16} /><span className="text-sm font-medium">Nuovo obiettivo</span>
      </button>

      {selezionato && <ContoDetailSheet conto={selezionato} workspace={workspace} onClose={() => setSelezionato(null)} onChanged={load} />}
      {showNuovo && <NewContoSheet workspace={workspace} onClose={() => setShowNuovo(false)} onCreated={() => { setShowNuovo(false); load(); }} />}
    </div>
  );
}
