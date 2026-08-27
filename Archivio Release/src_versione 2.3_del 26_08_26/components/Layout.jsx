import React, { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { C } from "../theme";
import { Header, BottomNav, FAB } from "./ui";
import { useWorkspace } from "../hooks/useWorkspace";
import { useAuth } from "../contexts/AuthContext";
import TransactionModal from "./TransactionModal";
import SearchSheet from "./SearchSheet";
import WorkspaceSwitcherSheet from "./WorkspaceSwitcherSheet";
import OnboardingScreen from "./OnboardingScreen";
import AddMenuSheet from "./AddMenuSheet";
import ScadenzaSheet from "./ScadenzaSheet";
import TurnoSheet from "./TurnoSheet";
import EventoGenericoSheet from "./EventoGenericoSheet";
import AttivitaFiglioSheet from "./AttivitaFiglioSheet";
import QuickAddListaSheet from "./QuickAddListaSheet";
import OnboardingTour from "./OnboardingTour";
import NotificationsSheet from "./NotificationsSheet";
import { generateDueRecurring } from "../lib/generateRecurring";
import { checkUpcomingReminders } from "../lib/checkUpcomingReminders";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";

export default function Layout() {
  const navigate = useNavigate();
  const showToast = useToast();
  const { user } = useAuth();
  const { workspace, member, workspaces, loading, error, switchWorkspace, createWorkspace, reload } = useWorkspace();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null); // "transazione" | "scadenza" | "turno" | "evento" | "figlio"
  const [showSearch, setShowSearch] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const recurringChecked = useRef(null);
  const remindersChecked = useRef(null);
  const tourChecked = useRef(null);

  const isReader = member?.role === "reader";
  const moduli = workspace?.moduli_attivi || {};
  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  const handleSheetSaved = (msg) => {
    setActiveSheet(null);
    if (msg) showToast(msg);
    bumpRefresh();
  };

  const loadUnreadCount = React.useCallback(() => {
    if (!user) return;
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_user_id", user.id).eq("read", false)
      .then(({ count }) => setUnreadCount(count || 0));
  }, [user]);

  useEffect(() => { loadUnreadCount(); }, [loadUnreadCount, refreshKey]);

  useEffect(() => {
    if (!workspace || tourChecked.current === workspace.id) return;
    tourChecked.current = workspace.id;
    try {
      const visto = localStorage.getItem(`milagros-tour-seen-${workspace.id}`);
      if (!visto) setShowTour(true);
    } catch (e) { /* storage non disponibile, pazienza */ }
  }, [workspace]);

  const finishTour = (nonMostrarePiu) => {
    setShowTour(false);
    if (nonMostrarePiu && workspace) {
      try { localStorage.setItem(`milagros-tour-seen-${workspace.id}`, "1"); } catch (e) { /* pazienza */ }
    }
  };
  const restartTour = () => setShowTour(true);

  // Spese ricorrenti scadute
  useEffect(() => {
    if (!workspace || recurringChecked.current === workspace.id) return;
    recurringChecked.current = workspace.id;
    generateDueRecurring(workspace.id).then((count) => {
      if (count > 0) {
        bumpRefresh();
        showToast(`${count} ${count === 1 ? "spesa ricorrente generata" : "spese ricorrenti generate"} automaticamente`);
      }
    });
  }, [workspace]); // eslint-disable-line

  // Promemoria in-app (scadenze/turni/eventi/attività nelle prossime 24 ore)
  useEffect(() => {
    if (!workspace || !user || remindersChecked.current === workspace.id) return;
    remindersChecked.current = workspace.id;
    checkUpcomingReminders(workspace.id, user.id).then((count) => {
      if (count > 0) loadUnreadCount();
    });
  }, [workspace, user]); // eslint-disable-line

  if (!loading && workspaces.length === 0) {
    return <OnboardingScreen createWorkspace={createWorkspace} reload={reload} switchWorkspace={switchWorkspace} />;
  }

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh", width: "100%", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 384, margin: "0 auto", padding: "24px 16px 96px", color: C.text }}>
        <Header
          onAdd={isReader ? null : () => setShowAddMenu(true)}
          onSearch={() => setShowSearch(true)}
          onWorkspaceClick={() => setShowSwitcher(true)}
          onNotifications={() => setShowNotifications(true)}
          unreadCount={unreadCount}
          workspaceName={workspace?.nome}
          hideAdd={isReader}
        />

        <Outlet context={{ workspace, member, refreshKey, bumpRefresh, isReader, restartTour, showToast }} />
      </div>

      {!isReader && <FAB onClick={() => setShowAddMenu(true)} />}

      <BottomNav moduli={moduli} />

      {showAddMenu && (
        <AddMenuSheet moduli={moduli} onClose={() => setShowAddMenu(false)} onSelect={(key) => {
          setShowAddMenu(false);
          setActiveSheet(key);
        }} />
      )}

      {activeSheet === "transazione" && workspace && member && (
        <TransactionModal workspace={workspace} member={member} onClose={() => setActiveSheet(null)} onSaved={() => handleSheetSaved("Transazione salvata")} />
      )}
      {activeSheet === "scadenza" && workspace && (
        <ScadenzaSheet workspace={workspace} onClose={() => setActiveSheet(null)} onSaved={() => handleSheetSaved("Scadenza creata")} />
      )}
      {activeSheet === "turno" && workspace && (
        <TurnoSheet workspace={workspace} member={member} onClose={() => setActiveSheet(null)} onSaved={() => handleSheetSaved("Turno salvato")} />
      )}
      {activeSheet === "evento" && workspace && (
        <EventoGenericoSheet workspace={workspace} onClose={() => setActiveSheet(null)} onSaved={() => handleSheetSaved("Appuntamento salvato")} />
      )}
      {activeSheet === "figlio" && workspace && (
        <AttivitaFiglioSheet workspace={workspace} onClose={() => setActiveSheet(null)} onSaved={() => handleSheetSaved("Attività salvata")} />
      )}
      {activeSheet === "lista" && workspace && (
        <QuickAddListaSheet workspace={workspace} onClose={() => setActiveSheet(null)} onSaved={bumpRefresh} />
      )}

      {showSearch && workspace && (
        <SearchSheet workspace={workspace} onClose={() => setShowSearch(false)} bumpRefresh={bumpRefresh} readOnly={isReader} />
      )}
      {showSwitcher && (
        <WorkspaceSwitcherSheet
          workspaces={workspaces}
          currentWorkspaceId={workspace?.id}
          onSwitch={switchWorkspace}
          onCreate={createWorkspace}
          onClose={() => setShowSwitcher(false)}
        />
      )}
      {showNotifications && user && (
        <NotificationsSheet userId={user.id} onClose={() => setShowNotifications(false)} onChanged={loadUnreadCount} />
      )}
      {showTour && workspace && (
        <OnboardingTour moduli={moduli} nomeFigli={workspace.nome_modulo_figli} onFinish={finishTour} />
      )}
    </div>
  );
}
