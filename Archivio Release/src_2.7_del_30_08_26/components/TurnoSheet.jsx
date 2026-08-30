import React, { useEffect, useState } from "react";
import { Clock, Building2, Home as HomeIcon, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { C, todayLocal } from "../theme";
import { Sheet } from "./ui";
import { supabase } from "../lib/supabase";
import { notificaAltriMembri } from "../lib/notificaAltriMembri";

export default function TurnoSheet({ workspace, member, defaultDate, onClose, onSaved }) {
  const [members, setMembers] = useState([]);
  const [aziende, setAziende] = useState([]);
  const [suggeriti, setSuggeriti] = useState([]);
  const [personaId, setPersonaId] = useState(member?.id || null);
  const [modalitaSelezione, setModalitaSelezione] = useState("intervallo"); // "intervallo" | "singoli"
  const [dataInizio, setDataInizio] = useState(defaultDate || todayLocal());
  const [dataFine, setDataFine] = useState(defaultDate || todayLocal());
  const [meseVisibile, setMeseVisibile] = useState(defaultDate || todayLocal());
  const [giorniSingoli, setGiorniSingoli] = useState(new Set(defaultDate ? [defaultDate] : []));
  const [oraInizio, setOraInizio] = useState("09:00");
  const [oraFine, setOraFine] = useState("18:00");
  const [modalita, setModalita] = useState("sede");
  const [aziendaId, setAziendaId] = useState(null);
  const [nuovaAzienda, setNuovaAzienda] = useState("");
  const [salvaSuggerimento, setSalvaSuggerimento] = useState(false);
  const [nomeSuggerimento, setNomeSuggerimento] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("workspace_members").select("id, display_name, colore").eq("workspace_id", workspace.id).eq("status", "active"),
      supabase.from("aziende").select("*").eq("workspace_id", workspace.id).order("nome"),
      supabase.from("turni_suggeriti").select("*, aziende(nome)").eq("workspace_id", workspace.id).order("nome"),
    ]).then(([memRes, azRes, sugRes]) => {
      setMembers(memRes.data || []);
      setAziende(azRes.data || []);
      setSuggeriti(sugRes.data || []);
    });
  }, [workspace.id]);

  const applicaSuggerito = (s) => {
    setOraInizio(s.ora_inizio.slice(0, 5));
    setOraFine(s.ora_fine.slice(0, 5));
    setModalita(s.modalita);
    setAziendaId(s.azienda_id);
  };

  const numeroGiorniIntervallo = Math.max(1, Math.round((new Date(dataFine) - new Date(dataInizio)) / 86400000) + 1);
  const numeroGiorni = modalitaSelezione === "singoli" ? giorniSingoli.size : numeroGiorniIntervallo;
  const valido = personaId && oraInizio && oraFine && (
    modalitaSelezione === "intervallo" ? (dataInizio && dataFine && dataFine >= dataInizio) : giorniSingoli.size > 0
  );

  function buildMiniMonthGrid(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const primo = new Date(d.getFullYear(), d.getMonth(), 1);
    const inizioSett = primo.getDay();
    const celle = [];
    for (let i = 0; i < inizioSett; i++) celle.push(null);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    for (let g = 1; g <= ultimo; g++) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
      celle.push(iso);
    }
    return celle;
  }
  const toggleGiorno = (iso) => {
    setGiorniSingoli((prev) => {
      const next = new Set(prev);
      next.has(iso) ? next.delete(iso) : next.add(iso);
      return next;
    });
  };
  const cambiaMese = (delta) => {
    const d = new Date(meseVisibile + "T00:00:00");
    d.setMonth(d.getMonth() + delta);
    setMeseVisibile(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  };

  const handleSave = async () => {
    if (!valido) return;
    setSaving(true);
    setError("");

    let finalAziendaId = aziendaId;
    if (modalita === "sede" && nuovaAzienda.trim() && !aziendaId) {
      const { data: az, error: azErr } = await supabase.from("aziende").insert({ workspace_id: workspace.id, nome: nuovaAzienda.trim() }).select().single();
      if (azErr) { setSaving(false); setError(azErr.message); return; }
      finalAziendaId = az.id;
    }

    let giorni = [];
    if (modalitaSelezione === "singoli") {
      giorni = Array.from(giorniSingoli).sort();
    } else {
      let d = new Date(dataInizio + "T00:00:00");
      const fine = new Date(dataFine + "T00:00:00");
      while (d <= fine) {
        giorni.push(d.toISOString().slice(0, 10));
        d = new Date(d.getTime() + 86400000);
      }
    }

    const rows = giorni.map((data) => ({
      workspace_id: workspace.id,
      member_id: personaId,
      data,
      ora_inizio: oraInizio,
      ora_fine: oraFine,
      azienda_id: modalita === "sede" ? finalAziendaId : null,
      modalita,
    }));

    const { error: insError } = await supabase.from("turni_assegnati").insert(rows);
    if (insError) { setSaving(false); setError(insError.message); return; }

    notificaAltriMembri({
      workspaceId: workspace.id, escludiUserId: member?.user_id, entityType: "turno",
      title: `${member?.display_name || "Qualcuno"} ha aggiunto ${rows.length > 1 ? "dei turni" : "un turno"}`,
      body: rows.length === 1 ? `${rows[0].data} · ${rows[0].ora_inizio?.slice(0, 5)}–${rows[0].ora_fine?.slice(0, 5)}` : `${rows.length} giorni`,
      navigateTo: "/app/calendario",
    });

    if (salvaSuggerimento && nomeSuggerimento.trim()) {
      await supabase.from("turni_suggeriti").insert({
        workspace_id: workspace.id, nome: nomeSuggerimento.trim(), ora_inizio: oraInizio, ora_fine: oraFine,
        azienda_id: modalita === "sede" ? finalAziendaId : null, modalita,
      });
    }

    setSaving(false);
    onSaved();
  };

  return (
    <Sheet onClose={onClose} title="Nuovo turno" zIndex={56}>
      {suggeriti.length > 0 && (
        <>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Turni suggeriti</div>
          <div className="flex gap-2 mb-4" style={{ overflowX: "auto" }}>
            {suggeriti.map((s) => (
              <button key={s.id} onClick={() => applicaSuggerito(s)} className="font-medium" style={{ padding: "8px 12px", borderRadius: 10, fontSize: 12, backgroundColor: C.panel, color: C.text, border: `1px solid ${C.border}`, whiteSpace: "nowrap", flexShrink: 0 }}>
                {s.nome} <span style={{ color: C.muted }}>· {s.ora_inizio.slice(0, 5)}-{s.ora_fine.slice(0, 5)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 8 }} className="uppercase">Chi</div>
      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
        {members.map((m) => {
          const active = personaId === m.id;
          return (
            <button key={m.id} onClick={() => setPersonaId(m.id)} className="font-medium" style={{ padding: "9px 14px", borderRadius: 12, fontSize: 13, backgroundColor: active ? (m.colore || C.purple) : C.panel, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? (m.colore || C.purple) : C.border}` }}>
              {m.display_name}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mb-3">
        {[{ k: "intervallo", l: "Intervallo di date" }, { k: "singoli", l: "Giorni singoli" }].map((m) => {
          const active = modalitaSelezione === m.k;
          return (
            <button key={m.k} onClick={() => setModalitaSelezione(m.k)} className="flex-1 font-medium" style={{
              padding: "8px 0", borderRadius: 10, fontSize: 12,
              backgroundColor: active ? C.sky : C.panel, color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? C.sky : C.border}`,
            }}>{m.l}</button>
          );
        })}
      </div>

      {modalitaSelezione === "intervallo" ? (
        <>
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Dal</div>
              <input type="date" value={dataInizio} onChange={(e) => setDataInizio(e.target.value)} style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 10px", fontSize: 12, color: C.text, outline: "none", colorScheme: "dark", boxSizing: "border-box" }} />
            </div>
            <div className="flex-1">
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Al</div>
              <input type="date" value={dataFine} onChange={(e) => setDataFine(e.target.value)} style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 10px", fontSize: 12, color: C.text, outline: "none", colorScheme: "dark", boxSizing: "border-box" }} />
            </div>
          </div>
          {numeroGiorni > 1 && <div className="text-xs mb-4" style={{ color: C.muted }}>Verrà assegnato a {numeroGiorni} giorni consecutivi.</div>}
        </>
      ) : (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => cambiaMese(-1)} aria-label="Mese precedente" style={{ width: 32, height: 32, borderRadius: 9999, backgroundColor: C.panel, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ChevronLeft size={16} style={{ color: C.text }} />
            </button>
            <span className="text-sm font-semibold flex items-center gap-1.5 capitalize" style={{ color: C.text }}><CalendarDays size={14} style={{ color: C.muted }} /> {new Date(meseVisibile + "T00:00:00").toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</span>
            <button onClick={() => cambiaMese(1)} aria-label="Mese successivo" style={{ width: 32, height: 32, borderRadius: 9999, backgroundColor: C.panel, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ChevronRight size={16} style={{ color: C.text }} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {buildMiniMonthGrid(meseVisibile).map((iso, i) => {
              if (!iso) return <div key={`vuoto-${i}`} />;
              const giorno = parseInt(iso.slice(8, 10), 10);
              const selezionato = giorniSingoli.has(iso);
              return (
                <button key={iso} onClick={() => toggleGiorno(iso)} style={{
                  aspectRatio: "1", borderRadius: 8, fontSize: 11, fontWeight: selezionato ? 700 : 500,
                  backgroundColor: selezionato ? C.sky : C.panel, color: selezionato ? "#0a0b0f" : C.text, border: `1px solid ${selezionato ? C.sky : C.border}`,
                }}>{giorno}</button>
              );
            })}
          </div>
          {giorniSingoli.size > 0 && <div className="text-xs mt-2" style={{ color: C.muted }}>{giorniSingoli.size} {giorniSingoli.size === 1 ? "giorno selezionato" : "giorni selezionati, anche non consecutivi"}.</div>}
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <Clock size={14} style={{ color: C.muted }} />
          <input type="time" value={oraInizio} onChange={(e) => setOraInizio(e.target.value)} style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: C.text, width: "100%", colorScheme: "dark" }} />
        </div>
        <div className="flex-1 flex items-center gap-2" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <Clock size={14} style={{ color: C.muted }} />
          <input type="time" value={oraFine} onChange={(e) => setOraFine(e.target.value)} style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: C.text, width: "100%", colorScheme: "dark" }} />
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        {[{ k: "sede", l: "In sede", Icon: Building2 }, { k: "smart", l: "Smart working", Icon: HomeIcon }].map((m) => {
          const active = modalita === m.k;
          return (
            <button key={m.k} onClick={() => setModalita(m.k)} className="flex-1 flex items-center justify-center gap-1.5 font-medium" style={{ padding: "10px 0", borderRadius: 12, fontSize: 12, backgroundColor: active ? C.purpleSoft : C.panel, color: active ? C.purple : C.muted, border: `1px solid ${active ? C.purple : C.border}` }}>
              <m.Icon size={13} /> {m.l}
            </button>
          );
        })}
      </div>

      {modalita === "sede" && (
        <div className="mb-4">
          {aziende.length > 0 && (
            <div className="flex gap-2 mb-2" style={{ flexWrap: "wrap" }}>
              {aziende.map((a) => (
                <button key={a.id} onClick={() => { setAziendaId(a.id); setNuovaAzienda(""); }} className="font-medium" style={{ padding: "6px 12px", borderRadius: 9999, fontSize: 12, backgroundColor: aziendaId === a.id ? C.sky : C.panel, color: aziendaId === a.id ? "#0a0b0f" : C.muted, border: `1px solid ${aziendaId === a.id ? C.sky : C.border}` }}>
                  {a.nome}
                </button>
              ))}
            </div>
          )}
          <input value={nuovaAzienda} onChange={(e) => { setNuovaAzienda(e.target.value); setAziendaId(null); }} placeholder="Oppure scrivi una nuova azienda"
            style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 12, color: C.text, outline: "none", boxSizing: "border-box" }} />
        </div>
      )}

      <label className="flex items-center gap-2 mb-4" style={{ cursor: "pointer" }}>
        <input type="checkbox" checked={salvaSuggerimento} onChange={(e) => setSalvaSuggerimento(e.target.checked)} />
        <span className="text-xs" style={{ color: C.muted }}>Salvalo come turno suggerito per riusarlo</span>
      </label>
      {salvaSuggerimento && (
        <input value={nomeSuggerimento} onChange={(e) => setNomeSuggerimento(e.target.value)} placeholder="Nome del suggerimento (es. Mattina Ikea)"
          style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 12, color: C.text, outline: "none", marginBottom: 16, boxSizing: "border-box" }} />
      )}

      {error && <div className="text-xs mb-3" style={{ color: C.red }}>{error}</div>}
      <button onClick={handleSave} disabled={!valido || saving} className="w-full font-semibold"
        style={{ padding: "14px 0", borderRadius: 14, fontSize: 14, backgroundColor: valido ? C.purple : C.panel, color: valido ? "#0a0b0f" : C.muted, opacity: (valido && !saving) ? 1 : 0.6, border: "none" }}>
        {saving ? "Salvataggio..." : `Salva turno${numeroGiorni > 1 ? ` (${numeroGiorni} giorni)` : ""}`}
      </button>
    </Sheet>
  );
}
