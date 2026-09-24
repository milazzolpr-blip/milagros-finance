import { supabase } from "./supabase";
import { todayLocal } from "../theme";

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Controlla le spese ricorrenti attive del workspace e genera la transazione
 * del mese corrente per quelle già scadute (giorno del mese raggiunto) e non
 * ancora generate questo mese. Non è un cron reale — gira al momento in cui
 * qualcuno apre l'app, quindi la transazione compare con il ritardo di quanto
 * tempo passa prima del prossimo accesso, non esattamente a mezzanotte del
 * giorno previsto.
 */
export async function generateDueRecurring(workspaceId) {
  const { data: ricorrenti } = await supabase
    .from("recurring_categories")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  if (!ricorrenti || ricorrenti.length === 0) return 0;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const oggi = todayLocal();
  const oggiGiorno = now.getDate();

  let generated = 0;

  for (const r of ricorrenti) {
    if (r.frequenza !== "mensile") continue; // per ora gestiamo solo le ricorrenze mensili
    if (r.data_fine && r.data_fine < oggi) continue;
    if (r.num_occorrenze && r.occorrenze_generate >= r.num_occorrenze) continue;

    const giornoScaduto = r.giorno <= Math.min(oggiGiorno, daysInMonth(now.getFullYear(), now.getMonth() + 1));
    const giaGeneratoQuestoMese = r.last_generated_date && r.last_generated_date.slice(0, 7) === currentMonth;

    if (!giornoScaduto || giaGeneratoQuestoMese) continue;

    const dataTransazione = `${currentMonth}-${String(Math.min(r.giorno, daysInMonth(now.getFullYear(), now.getMonth() + 1))).padStart(2, "0")}`;

    const { error: insertError } = await supabase.from("transactions").insert({
      workspace_id: workspaceId,
      member_id: r.member_id,
      date: dataTransazione,
      mese: currentMonth,
      tipo: "uscita",
      importo: r.importo,
      voce: r.nome,
      macro_categoria: r.macro_categoria,
      micro_categoria: r.micro_categoria || null,
      modalita: r.modalita || null,
      note: "Generata automaticamente da spesa ricorrente",
    });

    if (insertError) continue;

    const nuoveOccorrenze = (r.occorrenze_generate || 0) + 1;
    await supabase.from("recurring_categories").update({
      last_generated_date: oggi,
      occorrenze_generate: nuoveOccorrenze,
      status: r.num_occorrenze && nuoveOccorrenze >= r.num_occorrenze ? "stopped" : "active",
    }).eq("id", r.id);

    generated++;
  }

  return generated;
}
