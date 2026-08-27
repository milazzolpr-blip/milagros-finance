import { supabase } from "./supabase";

/**
 * Supabase limita ogni query a 1000 righe di default. Con migliaia di
 * transazioni, una query "semplice" ne restituisce solo le prime 1000.
 * Questo helper pagina automaticamente finché non ha letto tutto.
 */
export async function fetchAllTransactions(workspaceId, { mese } = {}) {
  const PAGE_SIZE = 1000;
  let all = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (mese) query = query.eq("mese", mese);

    const { data, error } = await query;
    if (error) throw error;

    all = all.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}
