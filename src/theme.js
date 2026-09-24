export const C = {
  bg: "var(--bg)",
  panel: "var(--panel)",
  panel2: "var(--panel2)",
  border: "var(--border-c)",
  text: "var(--text-c)",
  muted: "var(--muted-c)",
  purple: "var(--accent)",
  purpleSoft: "var(--accent-soft)",
  green: "#3ddc97",
  greenSoft: "rgba(61,220,151,0.14)",
  red: "#fb7185",
  redSoft: "rgba(251,113,133,0.14)",
  violet: "#c084fc",
  blue: "#60a5fa",
  amber: "#fbbf24",
  fuchsia: "#e879f9",
  slate: "#94a3b8",
  orange: "#fb923c",
  sky: "#38bdf8",
};

export function euro(n) {
  const sign = n < 0 ? "-" : "+";
  return sign + Math.abs(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function euroPlain(n) {
  return Math.abs(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function pct(n) {
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

// Data di oggi in fuso orario locale, non UTC — toISOString() sposta la data
// indietro di un giorno per chi è in Italia tra mezzanotte e l'1-2 di notte.
export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const NOMI_MESI = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
export function meseLabelFull(mese) {
  // "2026-08" -> "Agosto 2026"
  const [anno, mm] = mese.split("-");
  return `${NOMI_MESI[parseInt(mm, 10)]} ${anno}`;
}

// Tema: applicato subito (localStorage, niente flash) e poi confermato/sincronizzato
// con la preferenza salvata su Supabase quando l'utente è noto.
export function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
export function applyTheme(tema, coloreCustom) {
  document.documentElement.setAttribute("data-theme", tema === "personalizzato" ? "scuro" : tema);
  if (tema === "personalizzato" && coloreCustom) {
    document.documentElement.style.setProperty("--accent", coloreCustom);
    document.documentElement.style.setProperty("--accent-soft", hexToRgba(coloreCustom, 0.14));
  } else {
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--accent-soft");
  }
  try {
    localStorage.setItem("milagros-tema", tema);
    if (coloreCustom) localStorage.setItem("milagros-accento", coloreCustom);
  } catch (e) { /* storage non disponibile, pazienza */ }
}
export function initThemeFromStorage() {
  try {
    const saved = localStorage.getItem("milagros-tema");
    const accento = localStorage.getItem("milagros-accento");
    if (saved) applyTheme(saved, accento);
  } catch (e) { /* storage non disponibile, resta il tema di default */ }
}
