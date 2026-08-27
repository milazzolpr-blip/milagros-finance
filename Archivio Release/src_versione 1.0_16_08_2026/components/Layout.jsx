import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { C } from "../theme";
import { Header, BottomNav, FAB } from "./ui";
import { useWorkspace } from "../hooks/useWorkspace";
import TransactionModal from "./TransactionModal";

export default function Layout() {
  const { workspace, member, loading } = useWorkspace();
  const [showTxModal, setShowTxModal] = useState(false);
  const [toast, setToast] = useState(false);

  const handleSaved = () => {
    setShowTxModal(false);
    setToast(true);
    setTimeout(() => setToast(false), 2600);
  };

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh", width: "100%", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 384, margin: "0 auto", padding: "24px 16px 96px", color: C.text }}>
        <Header onAdd={() => setShowTxModal(true)} workspaceName={workspace?.nome} />

        {!loading && !workspace && (
          <div style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 16, fontSize: 13, color: C.muted }}>
            Nessun workspace trovato per il tuo account. Creane uno dalla tabella <code>workspaces</code> su Supabase e aggiungiti come membro in <code>workspace_members</code>, oppure chiedimi di costruire il flusso di onboarding.
          </div>
        )}

        <Outlet context={{ workspace, member }} />
      </div>

      <FAB onClick={() => setShowTxModal(true)} />

      {toast && (
        <div style={{ position: "fixed", bottom: 148, left: "50%", transform: "translateX(-50%)", backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", fontSize: 12, color: C.text, zIndex: 60, display: "flex", alignItems: "center", gap: 8, maxWidth: 320, textAlign: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: C.green, flexShrink: 0 }} />
          Transazione salvata
        </div>
      )}

      <BottomNav />

      {showTxModal && workspace && member && (
        <TransactionModal workspace={workspace} member={member} onClose={() => setShowTxModal(false)} onSaved={handleSaved} />
      )}
    </div>
  );
}
