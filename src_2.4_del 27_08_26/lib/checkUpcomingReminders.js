import { supabase } from "./supabase";

const SOGLIE_ORE = [24, 8, 1];

function parseDateTime(data, ora) {
  if (!data) return null;
  const [y, m, d] = data.split("-").map(Number);
  const [hh, mm] = (ora || "09:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh || 9, mm || 0);
}

/**
 * Controlla scadenze/turni/appuntamenti/attività nelle prossime 24 ore e
 * genera un promemoria (riga nella tabella notifications) per ogni soglia
 * raggiunta (24h/8h/1h prima) non ancora notificata.
 *
 * Importante: questi sono promemoria IN-APP, visibili quando apri l'app
 * (icona campanella in alto) — non sono notifiche push del sistema
 * operativo. Per avere un avviso anche a telefono chiuso servirebbe un
 * servizio push lato server, che non abbiamo attivato.
 */
export async function checkUpcomingReminders(workspaceId, userId) {
  const now = new Date();
  const tra24h = new Date(now.getTime() + 25 * 3600 * 1000); // margine di un'ora

  const [scadenze, turni, eventi, attivita, esistenti] = await Promise.all([
    supabase.from("scadenze").select("id, titolo, data_scadenza").eq("workspace_id", workspaceId).eq("stato", "da_pagare")
      .gte("data_scadenza", now.toISOString().slice(0, 10)),
    supabase.from("turni_assegnati").select("id, data, ora_inizio, member_id").eq("workspace_id", workspaceId)
      .gte("data", now.toISOString().slice(0, 10)),
    supabase.from("eventi_generici").select("id, titolo, data, ora_inizio").eq("workspace_id", workspaceId)
      .gte("data", now.toISOString().slice(0, 10)),
    supabase.from("entita_attivita").select("id, titolo, data, ora, entita_familiari(nome)").eq("workspace_id", workspaceId)
      .gte("data", now.toISOString().slice(0, 10)),
    supabase.from("notifications").select("entity_id, threshold_pct").eq("recipient_user_id", userId).eq("type", "promemoria"),
  ]);

  const giaNotificate = new Set((esistenti.data || []).map((n) => `${n.entity_id}|${n.threshold_pct}`));
  const daInserire = [];

  function valuta(items, getDateTime, getTitolo, entityType, navigateTo) {
    (items || []).forEach((item) => {
      const momento = getDateTime(item);
      if (!momento || momento < now || momento > tra24h) return;
      const oreRimanenti = (momento - now) / 3600000;

      for (const soglia of SOGLIE_ORE) {
        if (oreRimanenti > soglia) continue; // non ancora arrivati a questa soglia
        const chiave = `${item.id}|${soglia}`;
        if (giaNotificate.has(chiave)) continue;

        daInserire.push({
          workspace_id: workspaceId,
          recipient_user_id: userId,
          type: "promemoria",
          title: getTitolo(item),
          body: soglia >= 24 ? "Tra circa 24 ore" : soglia >= 8 ? "Tra circa 8 ore" : "Tra circa 1 ora",
          entity_type: entityType,
          entity_id: item.id,
          threshold_pct: soglia,
          navigate_to: navigateTo,
        });
        giaNotificate.add(chiave); // evita doppie soglie nello stesso giro
      }
    });
  }

  valuta(scadenze.data, (s) => parseDateTime(s.data_scadenza, "09:00"), (s) => `Scadenza: ${s.titolo}`, "scadenza", "/app/scadenze");
  valuta(turni.data, (t) => parseDateTime(t.data, t.ora_inizio), () => "Turno di lavoro", "turno", "/app/calendario");
  valuta(eventi.data, (e) => parseDateTime(e.data, e.ora_inizio), (e) => e.titolo, "evento", "/app/calendario");
  valuta(attivita.data, (a) => parseDateTime(a.data, a.ora), (a) => `${a.titolo}${a.entita_familiari?.nome ? ` (${a.entita_familiari.nome})` : ""}`, "figlio", "/app/attivita");

  if (daInserire.length > 0) {
    await supabase.from("notifications").insert(daInserire);
  }
  return daInserire.length;
}
