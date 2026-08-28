import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const STORAGE_KEY = "milagros-workspace-id";

/**
 * Carica TUTTI i workspace di cui l'utente è membro attivo, gestisce quale sia
 * quello "corrente" (ricordato tra un accesso e l'altro), e permette di
 * crearne uno nuovo o passare da uno all'altro.
 */
export function useWorkspace() {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState([]); // righe workspace_members con workspaces annidato
  const [currentId, setCurrentId] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("workspace_members")
      .select("*, workspaces(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setMemberships(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Se il workspace selezionato non è (più) tra quelli disponibili, torna al primo
  useEffect(() => {
    if (loading) return;
    if (memberships.length === 0) return;
    const stillValid = memberships.some((m) => m.workspace_id === currentId);
    if (!stillValid) {
      const first = memberships[0].workspace_id;
      setCurrentId(first);
      try { localStorage.setItem(STORAGE_KEY, first); } catch (e) { /* pazienza */ }
    }
  }, [memberships, loading, currentId]);

  const switchWorkspace = (workspaceId) => {
    setCurrentId(workspaceId);
    try { localStorage.setItem(STORAGE_KEY, workspaceId); } catch (e) { /* pazienza */ }
  };

  const createWorkspace = async (nome, scopo) => {
    const { data: ws, error: wsError } = await supabase
      .from("workspaces")
      .insert({ nome, scopo, owner_user_id: user.id })
      .select()
      .single();
    if (wsError) throw wsError;

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const displayName = profile?.full_name || user.email.split("@")[0];

    const { error: memberError } = await supabase.from("workspace_members").insert({
      workspace_id: ws.id,
      user_id: user.id,
      user_email: user.email,
      display_name: displayName,
      role: "admin",
      colore: "#8b7cf6",
      status: "active",
    });
    if (memberError) throw memberError;

    await load();
    switchWorkspace(ws.id);
    return ws;
  };

  const current = memberships.find((m) => m.workspace_id === currentId) || memberships[0] || null;

  return {
    workspace: current?.workspaces || null,
    member: current || null,
    workspaces: memberships.map((m) => ({ ...m.workspaces, _membership: m })),
    loading,
    error,
    switchWorkspace,
    createWorkspace,
    reload: load,
  };
}
