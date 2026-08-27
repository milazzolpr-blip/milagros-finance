import React, { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { C } from "../theme";
import { Header, BottomNav, FAB } from "./ui";
import { useWorkspace } from "../hooks/useWorkspace";
import TransactionModal from "./TransactionModal";
import SearchSheet from "./SearchSheet";
import { generateDueRecurring } from "../lib/generateRecurring";

export default function Layout() {
  const { workspace, member, loading, error } = useWorkspace();
  const [showTxModal, setShowTxModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [toast, setToast] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const recurringChecked = useRef(false);

  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  const handleSaved = () => {
    setShowTxModal(false);
    setToast("Transazione salvata");
    bumpRefresh();
    setTimeout(() => setToast(null), 2600);
  };

  // Genera le spese ricorrenti scadute una sola volta per sessione, al primo caricamento del workspace
  useEffect(() => {
    if (!workspace || recurringChecked.current) return;
    recurringChecked.current = true;
    generateDueRecurring(workspace.id).then((count) => {
      if (count > 0) {
        bumpRefresh();
        setToast(`${count} ${count === 1 ? "spesa ricorrente generata" : "spese ricorrenti generate"} automaticamente`);
        setTimeout(() => setToast(null), 3600);
      }
    });
  }, [workspace]);

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh", width: "100%", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 384, margin: "0 auto", padding: "24px 16px 96px", color: C.text }}>
        <Header onAdd={() => setShowTxModal(true)} onSearch={() => setShowSearch(true)} workspaceName={workspace?.nome} />

        {!loading && !workspace && (
          <div style={{ backgroundColor: C.panel, border: `1px solid ${error ? C.red : C.border}`, borderRadius: 16, padding: 16, marginBottom: 16, fontSize: 13, color: C.muted }}>
            {error ? (
              <>Errore nel caricare il workspace: <span style={{ color: C.red }}>{error}</span></>
            ) : (
              <>Nessun workspace trovato per il tuo account. Creane uno dalla tabella <code>workspaces</code> su Supabase e aggiungiti come membro in <code>workspace_members</code>, oppure chiedimi di costruire il flusso di onboarding.</>
            )}
          </div>
        )}

        <Outlet context={{ workspace, member, refreshKey, bumpRefresh }} />
      </div>

      <FAB onClick={() => setShowTxModal(true)} />

      {toast && (
        <div style={{ position: "fixed", bottom: 148, left: "50%", transform: "translateX(-50%)", backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", fontSize: 12, color: C.text, zIndex: 60, display: "flex", alignItems: "center", gap: 8, maxWidth: 320, textAlign: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: C.green, flexShrink: 0 }} />
          {toast}
        </div>
      )}

      <BottomNav />

      {showTxModal && workspace && member && (
        <TransactionModal workspace={workspace} member={member} onClose={() => setShowTxModal(false)} onSaved={handleSaved} />
      )}
      {showSearch && workspace && (
        <SearchSheet workspace={workspace} onClose={() => setShowSearch(false)} bumpRefresh={bumpRefresh} />
      )}
    </div>
  );
}
