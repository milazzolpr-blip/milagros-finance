import React, { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { C } from "../theme";
import { Header, BottomNav, FAB } from "./ui";
import { useWorkspace } from "../hooks/useWorkspace";
import TransactionModal from "./TransactionModal";
import SearchSheet from "./SearchSheet";
import WorkspaceSwitcherSheet from "./WorkspaceSwitcherSheet";
import OnboardingScreen from "./OnboardingScreen";
import { generateDueRecurring } from "../lib/generateRecurring";

export default function Layout() {
  const { workspace, member, workspaces, loading, error, switchWorkspace, createWorkspace, reload } = useWorkspace();
  const [showTxModal, setShowTxModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [toast, setToast] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const recurringChecked = useRef(null);

  const isReader = member?.role === "reader";
  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  const handleSaved = () => {
    setShowTxModal(false);
    setToast("Transazione salvata");
    bumpRefresh();
    setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (!workspace || recurringChecked.current === workspace.id) return;
    recurringChecked.current = workspace.id;
    generateDueRecurring(workspace.id).then((count) => {
      if (count > 0) {
        bumpRefresh();
        setToast(`${count} ${count === 1 ? "spesa ricorrente generata" : "spese ricorrenti generate"} automaticamente`);
        setTimeout(() => setToast(null), 3600);
      }
    });
  }, [workspace]);

  if (!loading && workspaces.length === 0) {
    return <OnboardingScreen createWorkspace={createWorkspace} reload={reload} switchWorkspace={switchWorkspace} />;
  }

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh", width: "100%", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 384, margin: "0 auto", padding: "24px 16px 96px", color: C.text }}>
        <Header
          onAdd={isReader ? null : () => setShowTxModal(true)}
          onSearch={() => setShowSearch(true)}
          onWorkspaceClick={() => setShowSwitcher(true)}
          workspaceName={workspace?.nome}
          hideAdd={isReader}
        />

        <Outlet context={{ workspace, member, refreshKey, bumpRefresh, isReader }} />
      </div>

      {!isReader && <FAB onClick={() => setShowTxModal(true)} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 148, left: "50%", transform: "translateX(-50%)", backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", fontSize: 12, color: C.text, zIndex: 60, display: "flex", alignItems: "center", gap: 8, maxWidth: 320, textAlign: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: C.green, flexShrink: 0 }} />
          {toast}
        </div>
      )}

      <BottomNav />

      {showTxModal && workspace && member && !isReader && (
        <TransactionModal workspace={workspace} member={member} onClose={() => setShowTxModal(false)} onSaved={handleSaved} />
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
    </div>
  );
}
