export const C = {
  bg: "#0a0b0f",
  panel: "#15171f",
  panel2: "#1a1d29",
  border: "#262a38",
  text: "#f4f6f9",
  muted: "#8b93a7",
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
