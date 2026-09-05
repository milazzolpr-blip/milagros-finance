import React, { useEffect, useState } from "react";
import { CalendarDays, Check, Square, CheckSquare, AlertTriangle } from "lucide-react";
import { C, todayLocal } from "../theme";
import { Sheet } from "./ui";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

function addGiorni(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function caricaScriptGoogle() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossibile caricare le librerie Google"));
    document.head.appendChild(script);
  });
}

export default function GoogleCalendarImportSheet({ workspace, member, onClose, onImported }) {
  const showToast = useToast();
  const [fase, setFase] = useState("iniziale"); // iniziale | connessione | caricamento | anteprima | importazione | errore
  const [errore, setErrore] = useState("");
  const [eventi, setEventi] = useState([]);
  const [selezionati, setSelezionati] = useState({});
  const [giorniPassati, setGiorniPassati] = useState(30);
  const [giorniFuturi, setGiorniFuturi] = useState(90);

  const configurato = !!CLIENT_ID;

  const handleConnetti = async () => {
    if (!configurato) return;
    setFase("connessione");
    setErrore("");
    try {
      await caricaScriptGoogle();
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: async (risposta) => {
          if (risposta.error) {
            setErrore("Accesso a Google negato o annullato.");
            setFase("iniziale");
            return;
          }
          await caricaEventi(risposta.access_token);
        },
      });
      client.requestAccessToken();
    } catch (e) {
      setErrore(e.message);
      setFase("errore");
    }
  };

  const caricaEventi = async (accessToken) => {
    setFase("caricamento");
    try {
      const timeMin = new Date(addGiorni(todayLocal(), -giorniPassati) + "T00:00:00Z").toISOString();
      const timeMax = new Date(addGiorni(todayLocal(), giorniFuturi) + "T23:59:59Z").toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`Google ha risposto con un errore (${res.status})`);
      const dati = await res.json();
      const eventiTrovati = (dati.items || [])
        .filter((e) => e.status !== "cancelled" && (e.start?.date || e.start?.dateTime))
        .map((e) => {
          const tuttoIlGiorno = !!e.start.date;
          const dataInizio = tuttoIlGiorno ? e.start.date : e.start.dateTime.slice(0, 10);
          const oraInizio = tuttoIlGiorno ? null : e.start.dateTime.slice(11, 16);
          const oraFine = tuttoIlGiorno ? null : e.end?.dateTime?.slice(11, 16) || null;
          return { id: e.id, titolo: e.summary || "(Senza titolo)", data: dataInizio, ora: oraInizio, oraFine, luogo: e.location || null, tipo: "appuntamento" };
        });
      setEventi(eventiTrovati);
      setSelezionati(Object.fromEntries(eventiTrovati.map((e) => [e.id, true])));
      setFase("anteprima");
    } catch (e) {
      setErrore("Recupero eventi fallito: " + e.message);
      setFase("errore");
    }
  };

  const toggleSelezione = (id) => setSelezionati((prev) => ({ ...prev, [id]: !prev[id] }));
  const selezionaTutti = (valore) => setSelezionati(Object.fromEntries(eventi.map((e) => [e.id, valore])));
  const toggleTipo = (id) => setEventi((prev) => prev.map((e) => e.id === id ? { ...e, tipo: e.tipo === "appuntamento" ? "turno" : "appuntamento" } : e));

  const handleImporta = async () => {
    const daImportare = eventi.filter((e) => selezionati[e.id]);
    if (daImportare.length === 0) return;
    setFase("importazione");

    const turniDaImportare = daImportare.filter((e) => e.tipo === "turno" && e.ora && e.oraFine);
    const appuntamentiDaImportare = daImportare.filter((e) => !(e.tipo === "turno" && e.ora && e.oraFine));

    let erroreRiscontrato = null;
    let totaleImportati = 0;

    if (appuntamentiDaImportare.length > 0) {
      const righe = appuntamentiDaImportare.map((e) => ({
        workspace_id: workspace.id, titolo: e.titolo, data: e.data, ora_inizio: e.ora, luogo: e.luogo,
        member_ids: member ? [member.id] : [], google_event_id: e.id,
      }));
      const { error, data } = await supabase.from("eventi_generici").upsert(righe, { onConflict: "workspace_id,google_event_id", ignoreDuplicates: true }).select();
      if (error) erroreRiscontrato = error; else totaleImportati += data?.length ?? righe.length;
    }

    if (!erroreRiscontrato && turniDaImportare.length > 0) {
      const righe = turniDaImportare.map((e) => ({
        workspace_id: workspace.id, member_id: member?.id, data: e.data, ora_inizio: e.ora, ora_fine: e.oraFine,
        modalita: "sede", azienda_id: null, google_event_id: e.id,
      }));
      const { error, data } = await supabase.from("turni_assegnati").upsert(righe, { onConflict: "workspace_id,google_event_id", ignoreDuplicates: true }).select();
      if (error) erroreRiscontrato = error; else totaleImportati += data?.length ?? righe.length;
    }

    if (erroreRiscontrato) { setErrore("Import non riuscito: " + erroreRiscontrato.message); setFase("errore"); return; }

    showToast(`${totaleImportati} elementi importati dal tuo Google Calendar`);
    onImported?.();
    onClose();
  };

  if (!configurato) {
    return (
      <Sheet onClose={onClose} title="Google Calendar">
        <div className="flex items-start gap-2" style={{ backgroundColor: "rgba(251,191,36,0.1)", border: `1px solid ${C.amber}`, borderRadius: 12, padding: "12px 14px" }}>
          <AlertTriangle size={16} style={{ color: C.amber, flexShrink: 0, marginTop: 1 }} />
          <span className="text-xs" style={{ color: C.amber }}>Questa funzione non è ancora configurata — manca il Client ID di Google Cloud Console (variabile VITE_GOOGLE_CLIENT_ID).</span>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} title="Importa da Google Calendar">
      {fase === "iniziale" && (
        <>
          <div className="text-sm mb-4" style={{ color: C.muted }}>
            Ti connetti al tuo account Google, scegli il periodo, e importi i tuoi eventi — come appuntamenti o, se hanno un orario di inizio e fine, anche come turni di lavoro.
          </div>
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <div className="text-xs mb-1" style={{ color: C.muted }}>Giorni passati</div>
              <input type="number" min="0" max="365" value={giorniPassati} onChange={(e) => setGiorniPassati(Number(e.target.value))}
                style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div className="flex-1">
              <div className="text-xs mb-1" style={{ color: C.muted }}>Giorni futuri</div>
              <input type="number" min="0" max="365" value={giorniFuturi} onChange={(e) => setGiorniFuturi(Number(e.target.value))}
                style={{ width: "100%", backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          {errore && <div className="text-xs mb-3" style={{ color: C.red }}>{errore}</div>}
          <button onClick={handleConnetti} className="w-full flex items-center justify-center gap-2 font-semibold" style={{ padding: "13px 0", borderRadius: 12, fontSize: 14, backgroundColor: C.purple, color: "#0a0b0f", border: "none" }}>
            <CalendarDays size={15} /> Connetti Google Calendar
          </button>
        </>
      )}

      {(fase === "connessione" || fase === "caricamento") && (
        <div className="text-sm text-center" style={{ color: C.muted, padding: "30px 0" }}>
          {fase === "connessione" ? "In attesa dell'autorizzazione Google..." : "Recupero i tuoi appuntamenti..."}
        </div>
      )}

      {fase === "errore" && (
        <>
          <div className="flex items-start gap-2 mb-4" style={{ backgroundColor: "rgba(251,113,133,0.1)", border: `1px solid ${C.red}`, borderRadius: 12, padding: "12px 14px" }}>
            <AlertTriangle size={16} style={{ color: C.red, flexShrink: 0, marginTop: 1 }} />
            <span className="text-xs" style={{ color: C.red }}>{errore}</span>
          </div>
          <button onClick={() => setFase("iniziale")} className="w-full font-medium text-sm" style={{ padding: "12px 0", borderRadius: 12, backgroundColor: C.panel, color: C.text, border: `1px solid ${C.border}` }}>Riprova</button>
        </>
      )}

      {fase === "anteprima" && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: C.text }}>{eventi.length} appuntamenti trovati</span>
            <div className="flex gap-3">
              <button onClick={() => selezionaTutti(true)} className="text-xs font-medium" style={{ color: C.purple, background: "none", border: "none" }}>Tutti</button>
              <button onClick={() => selezionaTutti(false)} className="text-xs font-medium" style={{ color: C.muted, background: "none", border: "none" }}>Nessuno</button>
            </div>
          </div>

          {eventi.length === 0 && <div className="text-sm text-center" style={{ color: C.muted, padding: "20px 0" }}>Nessun appuntamento trovato in questo periodo.</div>}

          <div className="space-y-2 mb-4" style={{ maxHeight: 340, overflowY: "auto" }}>
            {eventi.map((e) => {
              const puoEssereConvertitoInTurno = !!(e.ora && e.oraFine);
              return (
                <div key={e.id} className="flex items-center gap-2.5" style={{ padding: "6px 0" }}>
                  <button onClick={() => toggleSelezione(e.id)} style={{ background: "none", border: "none", flexShrink: 0, padding: 0 }}>
                    {selezionati[e.id] ? <CheckSquare size={17} style={{ color: C.purple }} /> : <Square size={17} style={{ color: C.muted }} />}
                  </button>
                  <div className="flex-1" style={{ minWidth: 0 }} onClick={() => toggleSelezione(e.id)}>
                    <div className="text-sm truncate" style={{ color: C.text }}>{e.titolo}</div>
                    <div className="text-xs" style={{ color: C.muted }}>{e.data}{e.ora ? ` · ${e.ora}${e.oraFine ? `–${e.oraFine}` : ""}` : ""}{e.luogo ? ` · ${e.luogo}` : ""}</div>
                  </div>
                  {puoEssereConvertitoInTurno && (
                    <button onClick={() => toggleTipo(e.id)} className="text-xs font-medium flex-shrink-0" style={{
                      padding: "5px 10px", borderRadius: 9999, backgroundColor: e.tipo === "turno" ? C.sky : C.panel2, color: e.tipo === "turno" ? "#0a0b0f" : C.muted, border: `1px solid ${e.tipo === "turno" ? C.sky : C.border}`,
                    }}>{e.tipo === "turno" ? "Turno" : "Appuntamento"}</button>
                  )}
                </div>
              );
            })}
          </div>

          {eventi.length > 0 && (
            <button onClick={handleImporta} disabled={fase === "importazione"} className="w-full flex items-center justify-center gap-2 font-semibold" style={{ padding: "13px 0", borderRadius: 12, fontSize: 14, backgroundColor: C.purple, color: "#0a0b0f", border: "none", opacity: fase === "importazione" ? 0.6 : 1 }}>
              <Check size={15} /> Importa {Object.values(selezionati).filter(Boolean).length} selezionati
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}
