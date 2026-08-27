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
      <div className="flex gap-2 mb-5" style={{ overflowX: "auto" }}>
        {SUB_NAV.map((item) => {
          const active = item.path === "/app/finanza" ? location.pathname === item.path : location.pathname.startsWith(item.path);
          return (
            <button key={item.path} onClick={() => navigate(item.path)} className="font-medium" style={{
              padding: "7px 14px", borderRadius: 10, fontSize: 12, whiteSpace: "nowrap",
              backgroundColor: active ? C.green : "transparent", color: active ? "#0a0b0f" : C.muted, border: `1px solid ${active ? C.green : C.border}`,
            }}>{item.label}</button>
          );
        })}
      </div>
      <Outlet context={ctx} />
    </div>
  );
}
