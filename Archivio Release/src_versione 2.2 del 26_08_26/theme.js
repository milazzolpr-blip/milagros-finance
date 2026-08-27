export const C = {
  bg: "var(--bg)",
  panel: "var(--panel)",
  panel2: "var(--panel2)",
  border: "var(--border-c)",
  text: "var(--text-c)",
  muted: "var(--muted-c)",
  purple: "#8b7cf6",
  purpleSoft: "rgba(139,124,246,0.14)",
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
export function applyTheme(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  try { localStorage.setItem("milagros-tema", tema); } catch (e) { /* storage non disponibile, pazienza */ }
}
export function initThemeFromStorage() {
  try {
    const saved = localStorage.getItem("milagros-tema");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  } catch (e) { /* storage non disponibile, resta il tema di default */ }
}
