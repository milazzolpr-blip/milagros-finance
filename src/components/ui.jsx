import React from "react";
import { Bell, User, LogOut, Plus, ChevronDown, Home, Calendar, BookOpen, BarChart3, Settings, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { C } from "../theme";
import { useAuth } from "../contexts/AuthContext";

export function Card({ eyebrow, children, style }) {
  return (
    <div style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, ...style }}>
      {eyebrow && (
        <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 12 }} className="uppercase">
          {eyebrow}
        </div>
      )}
      {children}
    </div>
  );
}

export function SectionLabel({ color, children }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-6">
      <div style={{ width: 4, height: 16, borderRadius: 4, backgroundColor: color }} />
      <span className="font-semibold" style={{ color: C.text, fontSize: 15 }}>{children}</span>
    </div>
  );
}

export function PillTabs({ options, value, onChange }) {
  return (
    <div className="flex gap-2 mb-4" style={{ overflowX: "auto" }}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className="font-medium"
            style={{
              padding: "7px 14px", borderRadius: 10, fontSize: 12, whiteSpace: "nowrap",
              backgroundColor: active ? (o.color || C.purple) : C.panel,
              color: active ? "#0a0b0f" : C.muted,
              border: `1px solid ${active ? (o.color || C.purple) : C.border}`,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function BilancioRow({ persona, entrate, spese, color, maxVal }) {
  const entratePct = Math.max((entrate / maxVal) * 100, entrate > 0 ? 4 : 0);
  const spesePct = Math.max((spese / maxVal) * 100, spese > 0 ? 4 : 0);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 1fr", alignItems: "center", gap: 8 }} className="mb-3">
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
        <span className="text-xs" style={{ color: C.red, fontFamily: "monospace", whiteSpace: "nowrap" }}>
          {Math.abs(spese).toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
        </span>
        <div style={{ height: 7, width: `${spesePct}%`, backgroundColor: C.red, borderRadius: 4, minWidth: 3 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: color, marginBottom: 3 }} />
        <span className="text-xs font-medium" style={{ color: C.text }}>{persona}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ height: 7, width: `${entratePct}%`, backgroundColor: C.green, borderRadius: 4, minWidth: 3 }} />
        <span className="text-xs" style={{ color: C.green, fontFamily: "monospace", whiteSpace: "nowrap" }}>
          {Math.abs(entrate).toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
        </span>
      </div>
    </div>
  );
}

export function Header({ onAdd, workspaceName }) {
  const { signOut } = useAuth();
  return (
    <div className="flex items-center justify-between mb-5">
      <button className="flex items-center gap-1.5" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 9999, paddingLeft: 4, paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}>
        <div style={{ width: 24, height: 24, borderRadius: 9999, background: "linear-gradient(135deg, #a78bfa, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>🏠</div>
        <span className="text-xs" style={{ color: C.muted, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workspaceName || "Workspace"}</span>
        <ChevronDown size={12} style={{ color: C.muted }} />
      </button>
      <div className="flex items-center gap-2">
        <button aria-label="Notifiche" title="Notifiche" style={iconBtnStyle}><Bell size={14} style={{ color: C.muted }} /></button>
        <button aria-label="Profilo" title="Profilo" style={iconBtnStyle}><User size={14} style={{ color: C.muted }} /></button>
        <button onClick={signOut} aria-label="Esci" title="Esci" style={iconBtnStyle}><LogOut size={14} style={{ color: C.muted }} /></button>
        <button onClick={onAdd} aria-label="Nuova transazione" title="Nuova transazione" style={{ ...iconBtnStyle, backgroundColor: C.purple, border: "none" }}>
          <Plus size={16} color="#0a0b0f" />
        </button>
      </div>
    </div>
  );
}
const iconBtnStyle = { width: 32, height: 32, borderRadius: 9999, backgroundColor: C.panel, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" };

const NAV_ITEMS = [
  { path: "/app", icon: Home, label: "Home" },
  { path: "/app/mesi", icon: Calendar, label: "Mesi" },
  { path: "/app/capitoli", icon: BookOpen, label: "Capitoli" },
  { path: "/app/storico", icon: BarChart3, label: "Storico" },
  { path: "/app/altro", icon: Settings, label: "Altro" },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: "#0d0e13", borderTop: `1px solid ${C.border}`, zIndex: 30 }}>
      <div style={{ maxWidth: 384, margin: "0 auto" }} className="flex justify-around py-2">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button key={item.path} onClick={() => navigate(item.path)} className="flex flex-col items-center gap-1" style={{ padding: "4px 12px" }} aria-current={active}>
              <item.icon size={18} color={active ? C.purple : C.muted} />
              <span className="font-medium" style={{ fontSize: 10, color: active ? C.purple : C.muted }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FAB({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed", right: "calc(50% - 192px + 16px)", bottom: 78,
        width: 56, height: 56, borderRadius: 9999, backgroundColor: C.purple,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 8px 24px rgba(139,124,246,0.45)", border: "none", zIndex: 40,
      }}
      aria-label="Nuova transazione"
      title="Nuova transazione"
    >
      <Plus size={24} color="#0a0b0f" />
    </button>
  );
}

export function Sheet({ onClose, children, title, right }) {
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div
        style={{ width: "100%", maxWidth: 384, backgroundColor: C.panel2, borderTopLeftRadius: 24, borderTopRightRadius: 24, border: `1px solid ${C.border}`, borderBottom: "none", padding: 20, maxHeight: "88vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold" style={{ fontSize: 16, color: C.text }}>{title}</span>
          <div className="flex items-center gap-2">
            {right}
            <button onClick={onClose} aria-label="Chiudi" title="Chiudi" style={{ width: 28, height: 28, borderRadius: 9999, backgroundColor: C.panel, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} style={{ color: C.muted }} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
