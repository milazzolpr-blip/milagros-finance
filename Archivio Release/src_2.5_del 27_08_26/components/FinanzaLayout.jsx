import React from "react";
import { Outlet, useNavigate, useLocation, useOutletContext } from "react-router-dom";
import { C } from "../theme";

const SUB_NAV = [
  { path: "/app/finanza", label: "Home" },
  { path: "/app/finanza/mesi", label: "Mesi" },
  { path: "/app/finanza/capitoli", label: "Capitoli" },
  { path: "/app/finanza/storico", label: "Storico" },
  { path: "/app/finanza/categorie", label: "Categorie e abbonamenti" },
];

export default function FinanzaLayout() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 4 }} className="uppercase">Finanza</div>
      <div style={{ display: "flex", backgroundColor: C.panel, borderRadius: 12, padding: 3, overflowX: "auto", marginBottom: 20 }}>
        {SUB_NAV.map((item) => {
          const active = item.path === "/app/finanza" ? location.pathname === item.path : location.pathname.startsWith(item.path);
          return (
            <button key={item.path} onClick={() => navigate(item.path)} className="font-semibold" style={{
              flex: "1 0 auto", padding: "8px 12px", borderRadius: 9, fontSize: 12, whiteSpace: "nowrap", border: "none", transition: "background-color 0.18s",
              backgroundColor: active ? C.green : "transparent", color: active ? "#0a0b0f" : C.muted,
            }}>{item.label}</button>
          );
        })}
      </div>
      <Outlet context={ctx} />
    </div>
  );
}
