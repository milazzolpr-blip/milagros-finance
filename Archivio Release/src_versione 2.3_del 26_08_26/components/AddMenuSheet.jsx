import React from "react";
import { Wallet, Receipt, Clock, CalendarPlus, Baby, ListPlus } from "lucide-react";
import { C } from "../theme";
import { Sheet } from "./ui";

export default function AddMenuSheet({ moduli, onClose, onSelect }) {
  const opzioni = [
    { key: "transazione", label: "Transazione", desc: "Entrata o uscita in Finanza", Icon: Wallet, color: C.green, visibile: moduli?.finanza !== false },
    { key: "scadenza", label: "Scadenza / Pagamento", desc: "Con promemoria, collegabile a Finanza", Icon: Receipt, color: C.amber, visibile: moduli?.scadenzePagamenti !== false },
    { key: "turno", label: "Turno di lavoro", desc: "Assegna un turno a uno o più giorni", Icon: Clock, color: C.sky, visibile: moduli?.turni },
    { key: "evento", label: "Appuntamento", desc: "Un impegno sul calendario", Icon: CalendarPlus, color: C.violet, visibile: moduli?.calendario !== false },
    { key: "figlio", label: "Attività figlio", desc: "Uscita, visita, extrascolastica...", Icon: Baby, color: C.orange, visibile: moduli?.figli },
    { key: "lista", label: "Elemento lista", desc: "Aggiungi a una lista esistente", Icon: ListPlus, color: C.fuchsia, visibile: moduli?.liste },
  ].filter((o) => o.visibile);

  return (
    <Sheet onClose={onClose} title="Cosa vuoi aggiungere?">
      <div className="space-y-2">
        {opzioni.map((o) => (
          <button key={o.key} onClick={() => onSelect(o.key)} className="w-full flex items-center gap-3" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, textAlign: "left" }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: `${o.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <o.Icon size={17} style={{ color: o.color }} />
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: C.text }}>{o.label}</div>
              <div className="text-xs" style={{ color: C.muted }}>{o.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
