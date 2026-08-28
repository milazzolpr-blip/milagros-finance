import { fetchAllTransactions } from "./fetchAllTransactions";

function csvEscape(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function exportTransactionsCsv(workspaceId, membersById) {
  const transactions = await fetchAllTransactions(workspaceId);
  const headers = ["Data", "Persona", "Tipo", "Importo", "Descrizione", "Macro categoria", "Micro categoria", "Modalità", "Capitolo"];
  const rows = transactions.map((t) => [
    t.date,
    membersById[t.member_id]?.display_name || "",
    t.tipo,
    Number(t.importo).toFixed(2).replace(".", ","),
    t.voce,
    t.macro_categoria || "",
    t.micro_categoria || "",
    t.modalita || "",
    t.capitolo_id ? "sì" : "",
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `milagros_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return transactions.length;
}
