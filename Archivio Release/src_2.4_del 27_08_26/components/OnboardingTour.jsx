import React, { useState } from "react";
import { Home, CalendarDays, Wallet, Receipt, Clock, Baby, ListChecks, Plus, X } from "lucide-react";
import { C } from "../theme";

function buildSteps(moduli, nomeFigli) {
  const steps = [
    { Icon: Home, colore: C.purple, titolo: "Benvenuto", testo: "Un giro veloce di cosa trovi nell'app — 30 secondi, poi puoi sempre rivederlo da Impostazioni." },
    { Icon: CalendarDays, colore: C.violet, titolo: "Calendario", testo: "Il cuore dell'app: qui confluisce tutto quello che pianifichi, di qualunque modulo." },
  ];
  if (moduli.finanza !== false) steps.push({ Icon: Wallet, colore: C.green, titolo: "Finanza", testo: "Budget, transazioni, capitoli di spesa e categorie — tutto quello che avevi già." });
  if (moduli.scadenzePagamenti !== false) steps.push({ Icon: Receipt, colore: C.amber, titolo: "Scadenze & Promemoria", testo: "Pagamenti e adempimenti con promemoria. Segnarli come pagati genera automaticamente la transazione in Finanza." });
  if (moduli.turni) steps.push({ Icon: Clock, colore: C.sky, titolo: "Turni di lavoro", testo: "Assegna turni a uno o più giorni, anche non consecutivi, con orari che puoi salvare e riusare." });
  if (moduli.figli) steps.push({ Icon: Baby, colore: C.orange, titolo: nomeFigli || "Figli", testo: "Logistica di figli, animali o altro — chi accompagna, chi riprende, dove." });
  if (moduli.liste) steps.push({ Icon: ListChecks, colore: C.fuchsia, titolo: "Liste", testo: "Liste condivise con checklist e assegnazione — collegabili a un luogo se serve andarci apposta." });
  steps.push({ Icon: Plus, colore: C.purple, titolo: "Aggiungi da ovunque", testo: "Il tasto in basso a destra apre un menu rapido per ogni tipo di dato, da qualunque schermata tu sia." });
  return steps;
}

export default function OnboardingTour({ moduli, nomeFigli, onFinish }) {
  const steps = buildSteps(moduli, nomeFigli);
  const [i, setI] = useState(0);
  const [nonMostrare, setNonMostrare] = useState(true);
  const step = steps[i];
  const ultimo = i === steps.length - 1;

  const chiudi = () => onFinish(nonMostrare);

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 340, backgroundColor: C.panel2, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24, textAlign: "center" }}>
        <button onClick={chiudi} aria-label="Salta" style={{ float: "right", background: "none", border: "none", marginTop: -6, marginRight: -6 }}>
          <X size={16} style={{ color: C.muted }} />
        </button>

        <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: `${step.colore}22`, display: "flex", alignItems: "center", justifyContent: "center", margin: "8px auto 16px" }}>
          <step.Icon size={26} style={{ color: step.colore }} />
        </div>
        <div className="font-bold" style={{ fontSize: 18, color: C.text, marginBottom: 8 }}>{step.titolo}</div>
        <div className="text-sm" style={{ color: C.muted, lineHeight: 1.5, marginBottom: 20 }}>{step.testo}</div>

        <div className="flex items-center justify-center gap-1.5 mb-5">
          {steps.map((_, idx) => (
            <div key={idx} style={{ width: idx === i ? 16 : 6, height: 6, borderRadius: 9999, backgroundColor: idx === i ? step.colore : C.border, transition: "width 0.2s" }} />
          ))}
        </div>

        <button onClick={() => (ultimo ? chiudi() : setI(i + 1))} className="w-full font-semibold" style={{ padding: "13px 0", borderRadius: 12, fontSize: 14, backgroundColor: step.colore, color: "#0a0b0f", border: "none", marginBottom: 12 }}>
          {ultimo ? "Iniziamo" : "Avanti"}
        </button>

        <label className="flex items-center justify-center gap-2" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={nonMostrare} onChange={(e) => setNonMostrare(e.target.checked)} />
          <span className="text-xs" style={{ color: C.muted }}>Non mostrare più</span>
        </label>
      </div>
    </div>
  );
}
