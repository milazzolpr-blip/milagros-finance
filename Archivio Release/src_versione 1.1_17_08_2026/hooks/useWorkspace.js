import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

/**
 * Carica il primo workspace attivo di cui l'utente loggato è membro,
 * più la riga workspace_members corrispondente (nome visualizzato, colore, ruolo).
 *
 * Nota: per ora prende il primo workspace disponibile. Quando servirà gestire
 * più workspace per utente, qui aggiungiamo un selettore.
 */
export function useWorkspace() {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data: memberRow, error: memberErr } = await supabase
        .from("workspace_members")
        .select("*, workspaces(*)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (memberErr) {
        setError(memberErr.message);
      } else if (memberRow) {
        setMember(memberRow);
        setWorkspace(memberRow.workspaces);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  return { workspace, member, loading, error };
}
