import React, { useEffect, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { C, euroPlain } from "../theme";
import { Sheet } from "./ui";
import { supabase } from "../lib/supabase";
import TransactionModal from "./TransactionModal";

export default function SearchSheet({ workspace, onClose, bumpRefresh }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("workspace_id", workspace.id)
        .or(`voce.ilike.%${query}%,micro_categoria.ilike.%${query}%,macro_categoria.ilike.%${query}%`)
        .order("date", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setResults(data || []);
      setLoading(false);
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query, workspace.id]);

  const handleEditDone = () => {
    setEditing(null);
    bumpRefresh?.();
    setQuery((q) => q);
  };

  return (
    <Sheet onClose={onClose} title="Cerca transazioni">
      <div className="flex items-center gap-2 mb-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px" }}>
        <SearchIcon size={15} style={{ color: C.muted, flexShrink: 0 }} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome, categoria..."
          style={{ background: "transparent", border: "none", outline: "none", fontSize: 14, color: C.text, width: "100%" }}
        />
      </div>

      {query.trim().length > 0 && query.trim().length < 2 && (
        <div className="text-xs" style={{ color: C.muted, padding: "8px 4px" }}>Scrivi almeno 2 caratteri.</div>
      )}
      {loading && <div className="text-xs" style={{ color: C.muted, padding: "8px 4px" }}>Ricerca...</div>}
      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="text-xs" style={{ color: C.muted, padding: "8px 4px" }}>Nessun risultato per "{query}".</div>
      )}

      <div className="space-y-2.5">
        {results.map((t) => (
          <button key={t.id} onClick={() => setEditing(t)} className="w-full flex items-center justify-between"
            style={{ background: "none", border: "none", textAlign: "left", padding: "6px 2px" }}>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="text-sm truncate" style={{ color: C.text }}>{t.voce}</div>
              <div className="text-xs truncate" style={{ color: C.muted }}>{t.macro_categoria}{t.micro_categoria ? ` · ${t.micro_categoria}` : ""} · {t.date}</div>
            </div>
            <div className="text-sm" style={{ color: t.tipo === "uscita" ? C.red : C.green, fontFamily: "monospace", flexShrink: 0 }}>
              {t.tipo === "uscita" ? "-" : "+"}{euroPlain(t.importo)}
            </div>
          </button>
        ))}
      </div>

      {editing && (
        <TransactionModal workspace={workspace} existing={editing} zIndex={55} onClose={() => setEditing(null)} onSaved={handleEditDone} onDeleted={handleEditDone} />
      )}
    </Sheet>
  );
}
