import React, { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { C, euroPlain, todayLocal } from "../theme";
import { Sheet, Card } from "./ui";
import { supabase } from "../lib/supabase";

export default function ContoDetailSheet({ conto, workspace, onClose, onChanged }) {
  const [movimenti, setMovimenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState("deposito");
  const [importo, setImporto] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = React.useCallback(() => {
    setLoading(true);
    supabase.from("deposito_movimenti").select("*").eq("conto_id", conto.id).order("date", { ascending: false }).then(({ data }) => {
      setMovimenti(data || []);
      setLoading(false);
    });
  }, [conto.id]);

  useEffect(() => { load(); }, [load]);

  const saldo = movimenti.reduce((s, m) => s + (m.tipo === "deposito" ? Number(m.importo) : -Number(m.importo)), 0);
  const pct = conto.target_amount ? Math.min((saldo / Number(conto.target_amount)) * 100, 100) : null;

  const handleAdd = async () => {
    const val = parseFloat(importo);
    if (!val || val <= 0) return;
    setSaving(true);
    setError("");
    const { error: insertError } = await supabase.from("deposito_movimenti").insert({
      conto_id: conto.id,
      importo: val,
      tipo,
      note: note || null,
      date: todayLocal(),
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setImporto(""); setNote("");
    load();
    onChanged?.();
  };

  return (
    <Sheet onClose={onClose} title={conto.nome} zIndex={55}>
      {conto.descrizione && <div className="text-xs mb-4" style={{ color: C.muted }}>{conto.descrizione}</div>}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }} className="uppercase">Saldo attuale</div>
        <div className="font-bold" style={{ fontSize: 26, color: C.green, fontFamily: "monospace", marginBottom: conto.target_amount ? 10 : 0 }}>{euroPlain(saldo)}</div>
        {conto.target_amount && (
          <>
            <div style={{ height: 6, backgroundColor: C.panel2, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", width: `${pct}%`, backgroundColor: C.green, borderRadius: 4 }} />
            </div>
            <div className="flex justify-between text-xs" style={{ color: C.muted }}>
              <span>{pct.toFixed(0)}% dell'obiettivo</span>
              <span>Obiettivo {euroPlain(conto.target_amount)}{conto.target_date ? ` · ${conto.target_date}` : ""}</span>
            </div>
          </>
        )}
      </Card>

      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Aggiungi movimento</div>
      <div className="flex gap-2 mb-3">
        {["deposito", "prelievo"].map((t) => {
          const active = tipo === t;
          const color = t === "deposito" ? C.green : C.red;
          return (
            <button key={t} onClick={() => setTipo(t)} className="flex-1 flex items-center justify-center gap-1.5 font-medium capitalize"
              style={{ padding: "10px 0", borderRadius: 12, fontSize: 13, backgroundColor: active ? `${color}22` : "transparent", color: active ? color : C.muted, border: `1px solid ${active ? color : C.border}` }}>
              {t === "deposito" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{t}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 mb-3">
        <input type="number" value={importo} onChange={(e) => setImporto(e.target.value)} placeholder="€"
          style={{ width: 90, backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 10px", fontSize: 13, color: C.text, outline: "none" }} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opzionale)"
          style={{ flex: 1, backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 10px", fontSize: 13, color: C.text, outline: "none" }} />
      </div>
      {error && <div className="text-xs mb-2" style={{ color: C.red }}>{error}</div>}
      <button onClick={handleAdd} disabled={saving} className="w-full font-semibold" style={{ padding: "12px 0", borderRadius: 12, fontSize: 13, backgroundColor: C.purple, color: "#0a0b0f", opacity: saving ? 0.6 : 1, marginBottom: 20, border: "none" }}>
        {saving ? "Salvataggio..." : "Aggiungi"}
      </button>

      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Movimenti</div>
      {loading && <div className="text-xs" style={{ color: C.muted }}>Caricamento...</div>}
      {!loading && movimenti.length === 0 && <div className="text-xs" style={{ color: C.muted }}>Nessun movimento ancora.</div>}
      <div className="space-y-2.5">
        {movimenti.map((m) => (
          <div key={m.id} className="flex items-center justify-between">
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="text-sm" style={{ color: C.text }}>{m.note || (m.tipo === "deposito" ? "Deposito" : "Prelievo")}</div>
              <div className="text-xs" style={{ color: C.muted }}>{m.date}</div>
            </div>
            <div className="text-sm" style={{ color: m.tipo === "deposito" ? C.green : C.red, fontFamily: "monospace" }}>
              {m.tipo === "deposito" ? "+" : "-"}{euroPlain(m.importo)}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
