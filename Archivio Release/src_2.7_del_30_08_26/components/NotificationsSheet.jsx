import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Clock, CalendarPlus, Baby, BellOff, ShieldAlert, Wallet } from "lucide-react";
import { C } from "../theme";
import { Sheet } from "./ui";
import { supabase } from "../lib/supabase";

const ICONE = { scadenza: Receipt, turno: Clock, evento: CalendarPlus, figlio: Baby, richiesta_admin: ShieldAlert, transazione: Wallet };
const COLORI = { scadenza: C.amber, turno: C.sky, evento: C.violet, figlio: C.orange, richiesta_admin: C.purple, transazione: C.green };

export default function NotificationsSheet({ userId, onClose, onChanged }) {
  const navigate = useNavigate();
  const [notifiche, setNotifiche] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    supabase.from("notifications").select("*").eq("recipient_user_id", userId).eq("read", false).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { setNotifiche(data || []); setLoading(false); });
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleTap = async (n) => {
    await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    setNotifiche((prev) => prev.filter((x) => x.id !== n.id));
    onChanged?.();
    onClose();
    if (n.navigate_to) navigate(n.navigate_to);
  };

  const handleSegnaTutteLette = async () => {
    const idsNonLette = notifiche.map((n) => n.id);
    if (idsNonLette.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", idsNonLette);
    setNotifiche([]);
    onChanged?.();
  };

  return (
    <Sheet onClose={onClose} title="Notifiche" right={
      notifiche.length > 0 ? (
        <button onClick={handleSegnaTutteLette} className="text-xs font-medium" style={{ color: C.purple, background: "none", border: "none" }}>
          Segna tutte lette
        </button>
      ) : null
    }>
      <div className="text-xs mb-4" style={{ color: C.muted }}>
        Promemoria interni all'app — li vedi quando la apri, non sono notifiche del telefono.
      </div>

      {loading && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>Caricamento...</div>}

      {!loading && notifiche.length === 0 && (
        <div className="flex flex-col items-center gap-2" style={{ padding: "40px 0", color: C.muted }}>
          <BellOff size={28} />
          <span className="text-sm">Nessuna notifica per ora.</span>
        </div>
      )}

      <div className="space-y-2.5">
        {notifiche.map((n) => {
          const Icon = ICONE[n.entity_type] || CalendarPlus;
          const colore = COLORI[n.entity_type] || C.violet;
          return (
            <button key={n.id} onClick={() => handleTap(n)} className="w-full flex items-start gap-3 text-left" style={{
              backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 9999, backgroundColor: `${colore}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={14} style={{ color: colore }} />
              </div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="text-sm truncate" style={{ color: C.text }}>{n.title}</div>
                <div className="text-xs" style={{ color: C.muted }}>{n.body}</div>
              </div>
              <div style={{ width: 7, height: 7, borderRadius: 9999, backgroundColor: colore, flexShrink: 0, marginTop: 6 }} />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
