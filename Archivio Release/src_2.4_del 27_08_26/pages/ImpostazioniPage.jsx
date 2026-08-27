import React, { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { LogOut, Sun, Moon, Palette, RefreshCw, Plus } from "lucide-react";
import { C, applyTheme } from "../theme";
import { Card } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import MembriTab from "../components/MembriTab";
import GoogleCalendarImportSheet from "../components/GoogleCalendarImportSheet";
import { useToast } from "../contexts/ToastContext";

const TEMI = [
  { key: "scuro", nome: "Scuro", desc: "Sfondo nero, testo bianco ad alto contrasto", Icon: Moon, disponibile: true },
  { key: "chiaro", nome: "Chiaro", desc: "Sfondo bianco, testo nero ad alto contrasto", Icon: Sun, disponibile: true },
  { key: "personalizzato", nome: "Personalizzato", desc: "Scegli tu il colore di accento dell'app", Icon: Palette, disponibile: true },
];

const SWATCH_ACCENTO = ["#8b7cf6", "#3ddc97", "#38bdf8", "#f5b942", "#fb7185", "#e879f9", "#fb923c", "#22d3ee"];

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
  const { workspace, member, isReader, restartTour, apriSwitcherWorkspace } = useOutletContext();
  const { user, signOut } = useAuth();
  const isAdmin = member?.role === "admin";

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 4 }} className="uppercase">App</div>
      <h1 className="font-bold mb-5" style={{ fontSize: 26 }}>Impostazioni</h1>

      <SezioneLabel>Profilo</SezioneLabel>
      <div style={{ marginBottom: 28 }}><ProfiloTab member={member} user={user} signOut={signOut} workspace={workspace} isAdmin={isAdmin} apriSwitcherWorkspace={apriSwitcherWorkspace} /></div>

      {workspace && (
        <>
          <SezioneLabel>Workspace</SezioneLabel>
          <div style={{ marginBottom: 28 }}><WorkspaceGeneraleTab workspace={workspace} isAdmin={isAdmin} member={member} /></div>
        </>
      )}

      {isAdmin && workspace && (
        <>
          <SezioneLabel>Membri</SezioneLabel>
          <div style={{ marginBottom: 28 }}><MembriTab workspace={workspace} currentUserId={user.id} /></div>
        </>
      )}

      {user && (
        <>
          <SezioneLabel>Preferenze</SezioneLabel>
          <PreferenzeTab user={user} restartTour={restartTour} />
        </>
      )}
    </div>
  );
}

function SezioneLabel({ children }) {
  return <div style={{ fontSize: 11, letterSpacing: "0.06em", color: C.muted, fontWeight: 700, marginBottom: 8, marginTop: 4 }} className="uppercase">{children}</div>;
}

const RUOLI_INFO = {
  admin: { label: "Admin", desc: "Accesso completo: transazioni, categorie, budget, membri e inviti." },
  member: { label: "Membro", desc: "Può registrare e modificare dati, ma non gestisce categorie, budget o membri." },
  reader: { label: "Sola lettura", desc: "Può consultare tutto, ma non può modificare nulla." },
};
const SWATCH_MEMBRO = ["#3ddc97", "#8b7cf6", "#38bdf8", "#f5b942", "#fb7185", "#e879f9", "#fb923c", "#c084fc"];

function ProfiloTab({ member, user, signOut, workspace, isAdmin, apriSwitcherWorkspace }) {
  const showToast = useToast();
  const fileInputRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [coloreMembro, setColoreMembro] = useState(member?.colore || C.purple);
  const [nuovaPassword, setNuovaPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [richiestaInviata, setRichiestaInviata] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle().then(({ data }) => setAvatarUrl(data?.avatar_url || null));
  }, [user.id]);

  const handleUploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const path = `${user.id}/avatar-${Date.now()}.${file.name.split(".").pop()}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploadingAvatar(false); showToast("Upload non riuscito: " + upErr.message, "error"); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
    setUploadingAvatar(false);
    if (dbErr) { showToast("Salvataggio non riuscito: " + dbErr.message, "error"); return; }
    setAvatarUrl(pub.publicUrl);
    showToast("Foto profilo aggiornata");
  };

  const handleColoreMembro = async (colore) => {
    if (!member) return;
    setColoreMembro(colore);
    const { error } = await supabase.from("workspace_members").update({ colore }).eq("id", member.id);
    if (error) { showToast("Salvataggio colore non riuscito: " + error.message, "error"); return; }
    showToast("Colore aggiornato — visibile anche agli altri membri");
  };

  const handleCambiaPassword = async () => {
    if (nuovaPassword.length < 6) { showToast("La password deve avere almeno 6 caratteri", "error"); return; }
    if (nuovaPassword !== confermaPassword) { showToast("Le due password non coincidono", "error"); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: nuovaPassword });
    setSavingPassword(false);
    if (error) { showToast("Cambio password non riuscito: " + error.message, "error"); return; }
    setNuovaPassword(""); setConfermaPassword("");
    showToast("Password aggiornata");
  };

  const handleRichiediAdmin = async () => {
    if (!workspace || !member) return;
    const { data: admins } = await supabase.from("workspace_members").select("user_id").eq("workspace_id", workspace.id).eq("role", "admin").eq("status", "active");
    const righe = (admins || []).filter((a) => a.user_id).map((a) => ({
      workspace_id: workspace.id, recipient_user_id: a.user_id, type: "richiesta_admin", entity_type: "richiesta_admin",
      title: `${member.display_name} vuole diventare admin`, body: "Puoi cambiare il suo ruolo da Impostazioni → Membri.",
    }));
    if (righe.length === 0) { showToast("Nessun admin trovato da avvisare", "error"); return; }
    const { error } = await supabase.from("notifications").insert(righe);
    if (error) { showToast("Richiesta non inviata: " + error.message, "error"); return; }
    setRichiestaInviata(true);
    showToast("Richiesta inviata agli admin");
  };

  const ruoloInfo = RUOLI_INFO[member?.role] || RUOLI_INFO.member;

  return (
    <>
      <Card eyebrow="Connesso come" style={{ marginBottom: 10 }}>
        <div className="flex items-center gap-3">
          <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} style={{ width: 52, height: 52, borderRadius: 9999, backgroundColor: coloreMembro, display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0b0f", fontWeight: 700, fontSize: 18, flexShrink: 0, border: "none", overflow: "hidden", position: "relative" }}>
            {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (member?.display_name || user?.email || "?")[0].toUpperCase()}
            {uploadingAvatar && <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 9, color: "white" }}>...</span></div>}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUploadAvatar} />
          <div className="flex-1">
            <div className="font-medium text-sm" style={{ color: C.text }}>{member?.display_name || "Utente"}</div>
            <div className="text-xs" style={{ color: C.muted }}>{user?.email}</div>
          </div>
          <span style={{ backgroundColor: C.purpleSoft, color: C.purple, borderRadius: 9999, padding: "3px 10px", fontSize: 11 }}>{ruoloInfo.label}</span>
        </div>
        <div className="text-xs mt-2" style={{ color: C.muted }}>Tocca l'avatar per cambiare foto profilo.</div>
      </Card>

      {member && (
        <Card eyebrow="Il tuo colore" style={{ marginBottom: 10 }}>
          <div className="text-xs mb-3" style={{ color: C.muted }}>Ti identifica in ogni sezione dell'app — visibile anche agli altri membri del workspace.</div>
          <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
            {SWATCH_MEMBRO.map((colore) => (
              <button key={colore} onClick={() => handleColoreMembro(colore)} aria-label={`Colore ${colore}`} style={{ width: 30, height: 30, borderRadius: 9999, backgroundColor: colore, border: coloreMembro === colore ? "3px solid white" : "3px solid transparent", boxShadow: `0 0 0 1px ${C.border}` }} />
            ))}
          </div>
        </Card>
      )}

      <Card eyebrow="Ruolo e permessi" style={{ marginBottom: 10 }}>
        <div className="text-sm mb-1" style={{ color: C.text, fontWeight: 600 }}>{ruoloInfo.label}</div>
        <div className="text-xs mb-3" style={{ color: C.muted }}>{ruoloInfo.desc}</div>
        {!isAdmin && (
          <button onClick={handleRichiediAdmin} disabled={richiestaInviata} className="w-full font-medium text-xs" style={{ padding: "10px 0", borderRadius: 10, backgroundColor: richiestaInviata ? C.panel2 : C.purpleSoft, color: richiestaInviata ? C.muted : C.purple, border: `1px solid ${richiestaInviata ? C.border : C.purple}` }}>
            {richiestaInviata ? "Richiesta inviata" : "Richiedi di diventare admin"}
          </button>
        )}
      </Card>

      <Card eyebrow="Cambia password" style={{ marginBottom: 10 }}>
        <input type="password" value={nuovaPassword} onChange={(e) => setNuovaPassword(e.target.value)} placeholder="Nuova password"
          style={{ width: "100%", backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.text, outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
        <input type="password" value={confermaPassword} onChange={(e) => setConfermaPassword(e.target.value)} placeholder="Conferma nuova password"
          style={{ width: "100%", backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.text, outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
        <button onClick={handleCambiaPassword} disabled={savingPassword || !nuovaPassword} className="w-full font-semibold text-xs" style={{ padding: "11px 0", borderRadius: 10, backgroundColor: C.purple, color: "#0a0b0f", border: "none", opacity: (savingPassword || !nuovaPassword) ? 0.6 : 1 }}>
          {savingPassword ? "Salvataggio..." : "Aggiorna password"}
        </button>
      </Card>

      <button onClick={apriSwitcherWorkspace} className="w-full flex items-center gap-2" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
        <Plus size={16} style={{ color: C.purple }} />
        <span className="text-sm font-medium" style={{ color: C.text }}>Crea un nuovo workspace</span>
      </button>

      <button onClick={signOut} className="w-full flex items-center gap-2" style={{ backgroundColor: "rgba(251,113,133,0.1)", border: `1px solid ${C.red}`, borderRadius: 14, padding: 14 }}>
        <LogOut size={16} style={{ color: C.red }} />
        <span className="text-sm font-medium" style={{ color: C.red }}>Esci dall'account</span>
      </button>
    </>
  );
}

function WorkspaceGeneraleTab({ workspace, isAdmin, member }) {
  const showToast = useToast();
  const [moduli, setModuli] = useState(workspace.moduli_attivi || {});
  const [settimanaInizio, setSettimanaInizio] = useState(workspace.settimana_inizio ?? 1);
  const [nomeModuloFigli, setNomeModuloFigli] = useState(workspace.nome_modulo_figli || "Figli");
  const [error, setError] = useState("");
  const [savingNome, setSavingNome] = useState(false);
  const [nomeSalvato, setNomeSalvato] = useState(false);
  const [altriMembri, setAltriMembri] = useState([]);
  const [turniVisibili, setTurniVisibili] = useState(member?.turni_visibili_ids || []);
  const [nastroMostraAltri, setNastroMostraAltri] = useState(member?.nastro_mostra_altri !== false);

  const toggleNastroMostraAltri = async () => {
    const nuovo = !nastroMostraAltri;
    setNastroMostraAltri(nuovo); // aggiornamento ottimistico
    const { error: updError } = await supabase.from("workspace_members").update({ nastro_mostra_altri: nuovo }).eq("id", member.id);
    if (updError) { setNastroMostraAltri(!nuovo); showToast("Salvataggio non riuscito: " + updError.message, "error"); return; }
    showToast("Preferenza salvata");
  };

  useEffect(() => {
    if (!member) return;
    supabase.from("workspace_members").select("id, display_name").eq("workspace_id", workspace.id).eq("status", "active").neq("id", member.id)
      .then(({ data }) => setAltriMembri(data || []));
  }, [workspace.id, member?.id]); // eslint-disable-line

  const toggleTurnoVisibile = async (altroId) => {
    const nuovi = turniVisibili.includes(altroId) ? turniVisibili.filter((id) => id !== altroId) : [...turniVisibili, altroId];
    setTurniVisibili(nuovi); // aggiornamento ottimistico
    const { error: updError } = await supabase.from("workspace_members").update({ turni_visibili_ids: nuovi }).eq("id", member.id);
    if (updError) { setTurniVisibili(turniVisibili); showToast("Salvataggio non riuscito: " + updError.message, "error"); return; }
    showToast("Preferenza salvata");
  };

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

      <Card eyebrow="Il nastro del giorno" style={{ marginBottom: 10 }}>
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-3">
            <div className="text-sm" style={{ color: C.text }}>Mostra anche gli altri membri</div>
            <div className="text-xs" style={{ color: C.muted, marginTop: 2 }}>Se disattivato, in Home vedrai solo i tuoi impegni, scadenze, appuntamenti e attività — non quelli degli altri membri del workspace.</div>
          </div>
          <button onClick={toggleNastroMostraAltri} style={{ width: 40, height: 22, borderRadius: 9999, backgroundColor: nastroMostraAltri ? C.purple : C.border, position: "relative", border: "none", flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9999, backgroundColor: "#0a0b0f", position: "absolute", top: 2, left: nastroMostraAltri ? 20 : 2, transition: "left 0.15s" }} />
          </button>
        </div>
      </Card>

      {moduli.turni && altriMembri.length > 0 && (
        <Card eyebrow="Turni visibili in Home" style={{ marginBottom: 10 }}>
          <div className="text-xs mb-3" style={{ color: C.muted }}>Scegli di chi vuoi vedere il turno di oggi nella tua Home, oltre al tuo.</div>
          <div className="space-y-2">
            {altriMembri.map((m) => {
              const attivo = turniVisibili.includes(m.id);
              return (
                <div key={m.id} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: C.text }}>{m.display_name}</span>
                  <button onClick={() => toggleTurnoVisibile(m.id)} style={{ width: 40, height: 22, borderRadius: 9999, backgroundColor: attivo ? C.purple : C.border, position: "relative", border: "none", flexShrink: 0 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 9999, backgroundColor: "#0a0b0f", position: "absolute", top: 2, left: attivo ? 20 : 2, transition: "left 0.15s" }} />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <SincronizzazioneEsterna workspace={workspace} member={member} />
    </>
  );
}

function SincronizzazioneEsterna({ workspace, member }) {
  const [messaggio, setMessaggio] = useState("");
  const [showImportGoogle, setShowImportGoogle] = useState(false);
  const servizi = [
    { key: "apple", nome: "Apple Calendario", colore: "#8b93a7", requisito: "Apple non offre un'API di sincronizzazione diretta come Google — la strada più realistica è l'export in formato .ics, non un collegamento live." },
    { key: "outlook", nome: "Microsoft Outlook", colore: "#0078D4", requisito: "Serve registrare l'app su Microsoft Entra ID (Azure) con permessi Calendars.Read prima che questo pulsante possa funzionare davvero." },
  ];
  return (
    <Card eyebrow="Sincronizzazione calendari esterni">
      <div className="flex items-center gap-3 mb-3" style={{ paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ width: 30, height: 30, borderRadius: 9999, backgroundColor: "#4285F422", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <RefreshCw size={13} style={{ color: "#4285F4" }} />
        </div>
        <div className="flex-1">
          <div className="text-sm" style={{ color: C.text }}>Google Calendar</div>
          <div className="text-xs" style={{ color: C.muted }}>Importa i tuoi appuntamenti (una tantum)</div>
        </div>
        <button onClick={() => setShowImportGoogle(true)} className="text-xs font-semibold" style={{ padding: "7px 14px", borderRadius: 9999, backgroundColor: C.purple, color: "#0a0b0f", border: "none" }}>
          Importa
        </button>
      </div>

      <div className="text-xs mb-3" style={{ color: C.muted }}>Gli altri servizi richiedono ancora una configurazione — tocca "Dettagli" per sapere cosa serve.</div>
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

      {showImportGoogle && (
        <GoogleCalendarImportSheet workspace={workspace} member={member} onClose={() => setShowImportGoogle(false)} onImported={() => {}} />
      )}
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
      if (data?.tema) applyTheme(data.tema, data.tema_colore_custom);
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
    applyTheme(tema, profile.tema_colore_custom);
    const { error } = await supabase.from("profiles").update({ tema }).eq("id", user.id);
    if (error) {
      setProfile((p) => ({ ...p, tema: precedente }));
      applyTheme(precedente);
      showToast("Salvataggio tema non riuscito: " + error.message, "error");
      return;
    }
    showToast("Tema aggiornato");
  };

  const setColoreAccento = async (colore) => {
    setProfile((p) => ({ ...p, tema_colore_custom: colore }));
    applyTheme("personalizzato", colore);
    const { error } = await supabase.from("profiles").update({ tema_colore_custom: colore, tema: "personalizzato" }).eq("id", user.id);
    if (error) { showToast("Salvataggio colore non riuscito: " + error.message, "error"); return; }
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

      {profile.tema === "personalizzato" && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", color: C.muted, fontWeight: 700, marginBottom: 10 }} className="uppercase">Colore di accento</div>
          <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
            {SWATCH_ACCENTO.map((colore) => (
              <button key={colore} onClick={() => setColoreAccento(colore)} aria-label={`Colore ${colore}`} style={{
                width: 34, height: 34, borderRadius: 9999, backgroundColor: colore, border: profile.tema_colore_custom === colore ? "3px solid white" : "3px solid transparent", boxShadow: `0 0 0 1px ${C.border}`,
              }} />
            ))}
            <label style={{ width: 34, height: 34, borderRadius: 9999, border: `1px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", overflow: "hidden" }}>
              <Palette size={14} style={{ color: C.muted }} />
              <input type="color" value={profile.tema_colore_custom || "#8b7cf6"} onChange={(e) => setColoreAccento(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            </label>
          </div>
          <div className="text-xs" style={{ color: C.muted }}>Tocca un colore, o l'ultimo cerchio per sceglierne uno libero.</div>
        </Card>
      )}

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
