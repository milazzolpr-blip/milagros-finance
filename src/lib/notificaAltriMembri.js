import { supabase } from "./supabase";

/**
 * Notifica tutti gli altri membri attivi del workspace (esclude chi ha compiuto
 * l'azione) che è successo qualcosa. Non blocca né fa fallire l'azione
 * principale se l'invio della notifica va storto — è un "best effort".
 */
export async function notificaAltriMembri({ workspaceId, escludiUserId, entityType, title, body, navigateTo }) {
  try {
    const { data: membri } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .neq("user_id", escludiUserId);

    const righe = (membri || [])
      .filter((m) => m.user_id)
      .map((m) => ({
        workspace_id: workspaceId,
        recipient_user_id: m.user_id,
        type: "attivita_workspace",
        entity_type: entityType,
        title,
        body: body || null,
        navigate_to: navigateTo || null,
      }));

    if (righe.length === 0) return;
    await supabase.from("notifications").insert(righe);
  } catch (e) {
    // silenzioso: una notifica non riuscita non deve mai far fallire l'azione principale
    console.warn("Notifica agli altri membri non riuscita:", e.message);
  }
}
