import * as XLSX from "xlsx";

const NOMI_MESI = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const MESE_INDEX = Object.fromEntries(NOMI_MESI.map((n, i) => [n.toLowerCase(), i]).filter(([k]) => k));

function parseNomeSheetMese(nome) {
  // "Agosto 2026", "Marzo 2026 " (spazio finale), "agosto 2026" -> { anno, mese } oppure null se non è un foglio-mese
  const pulito = nome.trim().toLowerCase();
  const match = pulito.match(/^([a-zàèéìòù]+)\s+(\d{4})$/i);
  if (!match) return null;
  const meseNum = MESE_INDEX[match[1]];
  if (!meseNum) return null;
  return { anno: parseInt(match[2], 10), mese: meseNum };
}

function dateToISO(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Legge il file Excel personale (un foglio per mese, colonne:
 * Uscite del giorno | Data | Chi | Entrata | Uscita | Riporto Mese Precedente | Voce | Micro Categoria | Modalità)
 * e restituisce le transazioni pronte per l'inserimento, più un report di anteprima
 * (categorie non ancora mappate, persone non riconosciute, fogli saltati).
 *
 * Non scrive nulla sul database — solo parsing e anteprima. L'inserimento vero
 * è un passo separato, dopo la conferma dell'utente.
 */
export function parseFinanzaExcel(arrayBuffer, { categoryMicroToMacro, memberNameToId }) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const transazioni = [];
  const microNonMappate = new Set();
  const personeNonRiconosciute = new Set();
  const fogliSaltati = [];
  const fogliElaborati = [];

  for (const sheetName of wb.SheetNames) {
    const info = parseNomeSheetMese(sheetName);
    if (!info) {
      fogliSaltati.push(sheetName.trim());
      continue;
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    let contatore = 0;

    // riga 0 = intestazioni, si parte dalla 1
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const dataCell = row[1];

      // Appena la colonna Data non è più una data vera, siamo usciti dalle
      // transazioni ed entrati nel blocco di riepilogo/budget in fondo al
      // foglio — ci fermiamo qui per questo foglio.
      if (!(dataCell instanceof Date)) break;

      const chi = row[2];
      const entrata = Number(row[3]) || 0;
      const uscita = Number(row[4]) || 0;
      if (!chi || (entrata <= 0 && uscita <= 0)) continue;

      const tipo = entrata > 0 ? "entrata" : "uscita";
      const importo = entrata > 0 ? entrata : uscita;
      const micro = row[7] || null;
      const macro = micro ? (categoryMicroToMacro[micro] || null) : null;
      if (micro && !macro) microNonMappate.add(micro);

      const memberId = memberNameToId[String(chi).trim().toLowerCase()];
      if (!memberId) personeNonRiconosciute.add(chi);

      transazioni.push({
        date: dateToISO(dataCell),
        chi,
        member_id: memberId || null,
        tipo,
        importo,
        voce: row[6] || "(senza descrizione)",
        micro_categoria: micro,
        macro_categoria: macro,
        modalita: row[8] || null,
        foglio: sheetName.trim(),
      });
      contatore++;
    }

    fogliElaborati.push({ nome: sheetName.trim(), anno: info.anno, mese: info.mese, transazioni: contatore });
  }

  return {
    transazioni,
    microNonMappate: [...microNonMappate].sort(),
    personeNonRiconosciute: [...personeNonRiconosciute],
    fogliSaltati,
    fogliElaborati,
  };
}

/**
 * Esporta le transazioni di Finanza in un file Excel con la stessa struttura
 * del file personale — un foglio per mese, saldo corrente calcolato riga per
 * riga (come "Riporto Mese Precedente"), totale uscite del giorno sulla prima
 * riga di ogni giornata.
 *
 * Semplificazioni consapevoli: non replica il blocco di riepilogo/budget che
 * hai in fondo a ogni foglio (è curato a mano, non derivabile dai soli dati
 * delle transazioni) e non tocca i fogli "Complessivo"/"Acquisto Casa".
 */
export function exportFinanzaToExcel(transactions, membersById, saldoIniziale = 0) {
  const ordinate = [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let saldo = saldoIniziale;
  const perMese = {}; // "YYYY-MM" -> righe pronte per il foglio

  let ultimaData = null;
  let usciteDelGiornoAccumulate = 0;
  const usciteGiornoPerRigaIndex = {}; // riferimento riga -> valore, assegnato alla prima riga del giorno

  // Prima passata: calcola saldo progressivo e le uscite giornaliere totali
  const preparate = ordinate.map((t) => {
    const importo = Number(t.importo);
    saldo += t.tipo === "entrata" ? importo : -importo;
    return { ...t, saldoProgressivo: saldo };
  });

  // Raggruppa per data per calcolare il totale uscite del giorno
  const usciteGiorno = {};
  preparate.forEach((t) => {
    if (t.tipo === "uscita") usciteGiorno[t.date] = (usciteGiorno[t.date] || 0) + Number(t.importo);
  });

  const giorniGiaSegnati = new Set();
  preparate.forEach((t) => {
    const mese = t.date.slice(0, 7); // YYYY-MM
    if (!perMese[mese]) perMese[mese] = [];
    const primaRigaDelGiorno = !giorniGiaSegnati.has(t.date);
    if (primaRigaDelGiorno) giorniGiaSegnati.add(t.date);

    const [anno, mm, gg] = t.date.split("-").map(Number);
    perMese[mese].push([
      primaRigaDelGiorno ? Math.round(usciteGiorno[t.date] * 100) / 100 || 0 : null,
      new Date(anno, mm - 1, gg),
      membersById[t.member_id]?.display_name || t.chi_label || "",
      t.tipo === "entrata" ? Number(t.importo) : 0,
      t.tipo === "uscita" ? Number(t.importo) : 0,
      Math.round(t.saldoProgressivo * 100) / 100,
      t.voce || "",
      t.micro_categoria || "",
      t.modalita || "",
    ]);
  });

  const wb = XLSX.utils.book_new();
  const mesiOrdinati = Object.keys(perMese).sort();

  for (const mese of mesiOrdinati) {
    const [anno, mm] = mese.split("-");
    const nomeFoglio = `${NOMI_MESI[parseInt(mm, 10)]} ${anno}`.slice(0, 31);
    const header = ["Uscite del giorno", "Data", "Chi", "Entrata", "Uscita", "Riporto Mese Precedente", "Voce", "Micro Categoria", "Modalità"];
    const ws = XLSX.utils.aoa_to_sheet([header, ...perMese[mese]]);
    ws["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 30 }, { wch: 25 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, nomeFoglio);
  }

  return wb;
}

export function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename);
}
