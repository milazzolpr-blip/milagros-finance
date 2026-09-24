import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { C } from "../theme";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, type }
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = "success") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type });
    timerRef.current = setTimeout(() => setToast(null), type === "error" ? 4000 : 2400);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div
          style={{
            position: "fixed", bottom: 148, left: "50%", transform: "translateX(-50%)",
            backgroundColor: C.panel2, border: `1px solid ${toast.type === "error" ? C.red : C.border}`,
            borderRadius: 12, padding: "10px 16px", fontSize: 12, color: C.text, zIndex: 200,
            display: "flex", alignItems: "center", gap: 8, maxWidth: 320, textAlign: "center",
            boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: toast.type === "error" ? C.red : C.green, flexShrink: 0 }} />
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve essere usato dentro ToastProvider");
  return ctx;
}
