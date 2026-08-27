import React, { useEffect, useState } from "react";
import { Copy, Ticket, X, UserX } from "lucide-react";
import { C } from "../theme";
import { Card } from "./ui";
import { supabase } from "../lib/supabase";
import { generateInviteCode } from "../lib/inviteCode";

const RUOLI = [
  { key: "admin", label: "Admin" },
  { key: "member", label: "Membro" },
  { key: "reader", label: "Sola lettura" },
];

export default function MembriTab({ workspace, currentUserId }) {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      supabase.from("workspace_members").select("*").eq("workspace_id", workspace.id).eq("status", "active").order("role"),
      supabase.from("workspace_invites").select("*").eq("workspace_id", workspace.id).eq("status", "active").order("created_at", { ascending: false }),
    ]).then(([memRes, invRes]) => {
      setMembers(memRes.data || []);
      setInvites(invRes.data || []);
      setLoading(false);
    });
  }, [workspace.id]);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (memberId, newRole) => {
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
    await supabase.from("workspace_members").update({ role: newRole }).eq("id", memberId);
  };

  const handleRemove = async (memberId) => {
    await supabase.from("workspace_members").update({ status: "removed" }).eq("id", memberId);
    load();
  };

  const handleGenerateInvite = async () => {
    setGenerating(true);
    const code = generateInviteCode();
    await supabase.from("workspace_invites").insert({
      workspace_id: workspace.id,
      code,
      created_by_user_id: currentUserId,
      status: "active",
    });
    setGenerating(false);
    load();
  };

  const handleRevoke = async (inviteId) => {
    await supabase.from("workspace_invites").update({ status: "revoked" }).eq("id", inviteId);
    load();
  };

  const handleCopy = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  if (loading) return <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>Caricamento...</div>;

  return (
    <>
      <Card eyebrow="Membri" style={{ marginBottom: 10 }}>
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <div style={{ width: 32, height: 32, borderRadius: 9999, backgroundColor: m.colore || C.purple, display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0b0f", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {m.display_name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="text-sm font-medium truncate" style={{ color: C.text }}>{m.display_name}{m.user_id === currentUserId && " (tu)"}</div>
                <div className="text-xs truncate" style={{ color: C.muted }}>{m.user_email || "Invito in sospeso"}</div>
              </div>
              <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value)}
                style={{ backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 8px", fontSize: 11, color: C.text, outline: "none", flexShrink: 0 }}>
                {RUOLI.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
              {m.user_id !== currentUserId && (
                <button onClick={() => handleRemove(m.id)} aria-label="Rimuovi membro" title="Rimuovi" style={{ background: "none", border: "none", flexShrink: 0 }}>
                  <UserX size={15} style={{ color: C.red }} />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card eyebrow="Inviti">
        <div className="text-xs mb-3" style={{ color: C.muted }}>
          Genera un codice e condividilo (WhatsApp, messaggio) — chi lo inserisce entra automaticamente come "Membro" (puoi cambiargli ruolo dopo).
        </div>

        {invites.length > 0 && (
          <div className="space-y-2 mb-3">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2" style={{ backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px" }}>
                  <Ticket size={13} style={{ color: C.green, flexShrink: 0 }} />
                  <span style={{ fontFamily: "monospace", fontSize: 14, letterSpacing: "0.1em", color: C.text }}>{inv.code}</span>
                  <span className="text-xs" style={{ color: C.muted, marginLeft: "auto" }}>{inv.uses_count} usi</span>
                </div>
                <button onClick={() => handleCopy(inv.code)} aria-label="Copia codice" title="Copia" style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.panel2, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Copy size={13} style={{ color: copiedCode === inv.code ? C.green : C.muted }} />
                </button>
                <button onClick={() => handleRevoke(inv.id)} aria-label="Revoca codice" title="Revoca" style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.panel2, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <X size={13} style={{ color: C.red }} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button onClick={handleGenerateInvite} disabled={generating} className="w-full flex items-center justify-center gap-2 font-medium"
          style={{ padding: "12px 0", borderRadius: 12, fontSize: 13, backgroundColor: C.purple, color: "#0a0b0f", border: "none", opacity: generating ? 0.6 : 1 }}>
          <Ticket size={14} /> {generating ? "Generazione..." : "Genera nuovo codice"}
        </button>
      </Card>
    </>
  );
}
