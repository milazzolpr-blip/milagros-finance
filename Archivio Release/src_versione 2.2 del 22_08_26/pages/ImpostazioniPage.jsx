import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { LogOut, Sun, Moon, Palette, RefreshCw } from "lucide-react";
import { C, applyTheme } from "../theme";
import { Card, PillTabs } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import MembriTab from "../components/MembriTab";
import { useToast } from "../contexts/ToastContext";

const TEMI = [
  { key: "scuro", nome: "Scuro", desc: "Sfondo nero, testo bianco ad alto contrasto", Icon: Moon, disponibile: true },
  { key: "chiaro", nome: "Chiaro", desc: "Sfondo bianco, testo nero ad alto contrasto", Icon: Sun, disponibile: true },
  { key: "personalizzato", nome: "Personalizzato", desc: "Definisci i tuoi colori — in arrivo", Icon: Palette, disponibile: false },
];

const MODULI_INFO = [
  { key: "finanza", label: "Finanza", desc: "Budget, transazioni, capitoli di spesa.", bloccato: false },
  { key: "scadenzePagamenti", label: "Scadenze & Promemoria", desc: "Pagamenti e adempimenti con promemoria.", bloccato: false },
  { key: "turni", label: "Turni di lavoro", desc: "Gestione turni, aziende, orari suggeriti.", bloccato: false },
  { key: "figli", label: "Figli & Famiglia", desc: "Logistica di figli, animali o altro.", bloccato: false },
  { key: "liste", label: "Liste", desc: "Liste della spesa o di progetti condivise.", bloccato: false },
];

function Toggle({ on, onClick, label, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} role="switch" aria-checked={on}
      style={{ width: 36, height: 20, borderRadius: 9999, backgroundColor: on ? C.purple : C.border, position: "relative", flexShrink: 0, border: "none", transition: "background-color 0.15s", opacity: disabled ? 0.5 : 1 }}>
      <div style={{ width: 16, height: 16, borderRadius: 9999, backgroundColor: "#0a0b0f", position: "absolute", top: 2, left: on ? 18 : 2, transition: "left 0.15s" }} />
    </button>
  );
}

export default function ImpostazioniPage() {
  const { workspace, member, isReader, restartTour } = useOutletContext();
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
      {tab === "workspace" && workspace && <WorkspaceGeneraleTab workspace={workspace} isAdmin={isAdmin} />}
      {tab === "preferenze" && user && <PreferenzeTab user={user} restartTour={restartTour} />}
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

function WorkspaceGeneraleTab({ workspace, isAdmin }) {
  const showToast = useToast();
  const [moduli, setModuli] = useState(workspace.moduli_attivi || {});
  const [settimanaInizio, setSettimanaInizio] = useState(workspace.settimana_inizio ?? 1);
  const [nomeModuloFigli, setNomeModuloFigli] = useState(workspace.nome_modulo_figli || "Figli");
  const [error, setError] = useState("");
  const [savingNome, setSavingNome] = useState(false);
  const [nomeSalvato, setNomeSalvato] = useState(false);

  const toggleModulo = async (key) => {
    if (!isAdmin) return;
    setError("");
    const precedenti = moduli;
    const nuovi = { ...moduli, [key]: !moduli[key] };
    setModuli(nuovi); // aggiornamento ottimistico
    const { error: updError } = await supabase.from("workspaces").update({ moduli_attivi: nuovi }).eq("id", workspace.id);
    if (updError) {
      setModuli(precedenti); // rollback se il salvataggio è fallito davvero
      showToast("Salvataggio non riuscito: " + updError.message, "error");
      return;
    }
    showToast(nuovi[key] ? "Modulo attivato" : "Modulo disattivato");
  };

  const cambiaSettimanaInizio = async (val) => {
    setError("");
    const precedente = settimanaInizio;
    setSettimanaInizio(val);
    const { error: updError } = await supabase.from("workspaces").update({ settimana_inizio: val }).eq("id", workspace.id);
    if (updError) {
      setSettimanaInizio(precedente);
      showToast("Salvataggio non riuscito: " + updError.message, "error");
      return;
    }
    showToast("Preferenza aggiornata");
  };

  const salvaNomeFigli = async () => {
    setError("");
    setSavingNome(true);
    setNomeSalvato(false);
    const { error: updError } = await supabase.from("workspaces").update({ nome_modulo_figli: nomeModuloFigli.trim() || "Figli" }).eq("id", workspace.id);
    setSavingNome(false);
    if (updError) {
      showToast("Salvataggio non riuscito: " + updError.message, "error");
      return;
    }
    setNomeSalvato(true);
    setTimeout(() => setNomeSalvato(false), 2000);
  };

  const GIORNI = [{ v: 1, l: "Lunedì" }, { v: 0, l: "Domenica" }];

  return (
    <>
      {error && (
        <div className="text-xs mb-3" style={{ color: C.red, backgroundColor: "rgba(251,113,133,0.1)", border: `1px solid ${C.red}`, borderRadius: 10, padding: "8px 12px" }}>
          {error}
        </div>
      )}

      <Card eyebrow="Moduli attivi" style={{ marginBottom: 10 }}>
        <div className="text-xs mb-3" style={{ color: C.muted }}>Calendario resta sempre attivo — è il punto in cui confluisce tutto il resto. Scegli il resto in base a cosa usi davvero.</div>
        <div className="space-y-3">
          {MODULI_INFO.map((m, i) => (
            <div key={m.key} className="flex items-center justify-between" style={{ paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ maxWidth: 240 }}>
                <div className="text-sm" style={{ color: C.text }}>{m.key === "figli" ? nomeModuloFigli : m.label}</div>
                <div className="text-xs" style={{ color: C.muted }}>{m.desc}</div>
              </div>
              <Toggle on={!!moduli[m.key]} onClick={() => toggleModulo(m.key)} label={m.label} disabled={!isAdmin} />
            </div>
          ))}
        </div>
      </Card>

      {moduli.figli && isAdmin && (
        <Card eyebrow="Rinomina il modulo Figli" style={{ marginBottom: 10 }}>
          <div className="text-xs mb-3" style={{ color: C.muted }}>Se non ti serve chiamarlo "Figli" (es. solo animali), rinominalo come preferisci.</div>
          <div className="flex gap-2">
            <input value={nomeModuloFigli} onChange={(e) => setNomeModuloFigli(e.target.value)} style={{ flex: 1, backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, color: C.text, outline: "none" }} />
            <button onClick={salvaNomeFigli} disabled={savingNome} className="text-xs font-medium" style={{ padding: "9px 14px", borderRadius: 10, backgroundColor: nomeSalvato ? C.green : C.purple, color: "#0a0b0f", border: "none", opacity: savingNome ? 0.6 : 1, minWidth: 70 }}>
              {savingNome ? "..." : nomeSalvato ? "✓ Salvato" : "Salva"}
            </button>
          </div>
        </Card>
      )}

      <Card eyebrow="Calendario" style={{ marginBottom: 10 }}>
        <div className="text-xs mb-3" style={{ color: C.muted }}>Da quale giorno partono le viste settimanali di Calendario e Turni.</div>
        <div className="flex gap-2">
          {GIORNI.map((g) => (
            <button key={g.v} onClick={() => isAdmin && cambiaSettimanaInizio(g.v)} disabled={!isAdmin} className="flex-1 font-medium" style={{
              padding: "9px 0", borderRadius: 10, fontSize: 12,
              backgroundColor: settimanaInizio === g.v ? C.violet : C.panel2, color: settimanaInizio === g.v ? "#0a0b0f" : C.muted, border: `1px solid ${settimanaInizio === g.v ? C.violet : C.border}`,
            }}>{g.l}</button>
          ))}
        </div>
      </Card>

      <SincronizzazioneEsterna />
    </>
  );
}

function SincronizzazioneEsterna() {
  const [messaggio, setMessaggio] = useState("");
  const servizi = [
    { key: "google", nome: "Google Calendar", colore: "#4285F4", requisito: "Serve creare un progetto su Google Cloud Console con credenziali OAuth (client ID/secret) prima che questo pulsante possa funzionare davvero." },
    { key: "apple", nome: "Apple Calendario", colore: "#8b93a7", requisito: "Apple non offre un'API di sincronizzazione diretta come Google — la strada più realistica è l'export in formato .ics, non un collegamento live." },
    { key: "outlook", nome: "Microsoft Outlook", colore: "#0078D4", requisito: "Serve registrare l'app su Microsoft Entra ID (Azure) con permessi Calendars.Read prima che questo pulsante possa funzionare davvero." },
  ];
  return (
    <Card eyebrow="Sincronizzazione calendari esterni">
      <div className="text-xs mb-3" style={{ color: C.muted }}>
        Non è ancora un collegamento vero — serve prima creare delle credenziali presso ciascun servizio (non è qualcosa che posso fare da solo, richiede un account sviluppatore tuo). Tocca "Dettagli" per sapere cosa serve.
      </div>
      <div className="space-y-2">
        {servizi.map((s) => (
          <div key={s.key} className="flex items-center gap-3">
            <div style={{ width: 30, height: 30, borderRadius: 9999, backgroundColor: `${s.colore}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <RefreshCw size={13} style={{ color: s.colore }} />
            </div>
            <span className="text-sm flex-1" style={{ color: C.text }}>{s.nome}</span>
            <button onClick={() => setMessaggio(messaggio === s.requisito ? "" : s.requisito)} className="text-xs font-medium" style={{ padding: "6px 12px", borderRadius: 9999, backgroundColor: C.panel2, color: C.muted, border: `1px solid ${C.border}` }}>
              Dettagli
            </button>
          </div>
        ))}
      </div>
      {messaggio && <div className="text-xs mt-3" style={{ color: C.amber, backgroundColor: "rgba(251,191,36,0.1)", border: `1px solid ${C.amber}`, borderRadius: 8, padding: "8px 10px" }}>{messaggio}</div>}
    </Card>
  );
}

function PreferenzeTab({ user, restartTour }) {
  const showToast = useToast();
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
    const { error } = await supabase.from("profiles").update({ [field]: newValue }).eq("id", user.id);
    if (error) {
      setProfile((p) => ({ ...p, [field]: !newValue }));
      showToast("Salvataggio non riuscito: " + error.message, "error");
      return;
    }
    showToast(newValue ? "Notifica attivata" : "Notifica disattivata");
  };

  const setTema = async (tema) => {
    const precedente = profile.tema;
    setProfile((p) => ({ ...p, tema }));
    applyTheme(tema);
    const { error } = await supabase.from("profiles").update({ tema }).eq("id", user.id);
    if (error) {
      setProfile((p) => ({ ...p, tema: precedente }));
      applyTheme(precedente);
      showToast("Salvataggio tema non riuscito: " + error.message, "error");
      return;
    }
    showToast("Tema aggiornato");
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

      <button onClick={restartTour} className="w-full text-xs font-medium" style={{ marginTop: 16, padding: "10px 0", background: "none", border: "none", color: C.muted, textDecoration: "underline" }}>
        Rivedi il tour di benvenuto
      </button>
    </>
  );
}
