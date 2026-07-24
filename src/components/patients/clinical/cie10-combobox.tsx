"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchCie10Action } from "@/lib/actions/clinical";
import type { Tables } from "@/lib/database.types";

/**
 * Buscador CIE-10: escribe código o descripción, elige del listado. Rellena
 * los campos ocultos `cie10_codigo` y (si está vacío) `descripcion`.
 */
export function Cie10Combobox({
  defaultCodigo = "",
  defaultDescripcion = "",
}: {
  defaultCodigo?: string;
  defaultDescripcion?: string;
}) {
  const [codigo, setCodigo] = useState(defaultCodigo);
  const [query, setQuery] = useState(
    defaultCodigo ? `${defaultCodigo} · ${defaultDescripcion}` : ""
  );
  const [results, setResults] = useState<Tables<"LIS_cie10">[]>([]);
  const [openList, setOpenList] = useState(false);
  const [, startSearch] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpenList(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function runSearch(term: string) {
    startSearch(async () => {
      const rows = await searchCie10Action(term);
      setResults(rows);
      setOpenList(true);
    });
  }

  function pick(row: Tables<"LIS_cie10">) {
    setCodigo(row.codigo);
    setQuery(`${row.codigo} · ${row.descripcion}`);
    setOpenList(false);
    // rellena la descripción visible si el usuario no escribió una
    const desc = document.getElementById("descripcion") as HTMLTextAreaElement | HTMLInputElement | null;
    if (desc && !desc.value.trim()) desc.value = row.descripcion;
  }

  function clear() {
    setCodigo("");
    setQuery("");
    setResults([]);
    setOpenList(false);
  }

  return (
    <div className="space-y-2" ref={boxRef}>
      <Label htmlFor="cie10-search">Código CIE-10 (opcional)</Label>
      <input type="hidden" name="cie10_codigo" value={codigo} />
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="cie10-search"
              value={query}
              autoComplete="off"
              placeholder="Ej. E11.9 o 'diabetes'"
              className="pl-8"
              onChange={(e) => {
                setQuery(e.target.value);
                setCodigo("");
                if (e.target.value.trim().length >= 2) runSearch(e.target.value);
                else setOpenList(false);
              }}
              onFocus={() => {
                if (results.length > 0) setOpenList(true);
              }}
            />
          </div>
          {(codigo || query) && (
            <button
              type="button"
              onClick={clear}
              className="rounded-md border px-2 text-muted-foreground hover:bg-muted"
              title="Limpiar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {openList && results.length > 0 && (
          <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md">
            {results.map((r) => (
              <li key={r.codigo}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="shrink-0 font-mono font-medium text-primary">{r.codigo}</span>
                  <span className="text-muted-foreground">{r.descripcion}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {openList && results.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
            Sin coincidencias en el catálogo.
          </div>
        )}
      </div>
    </div>
  );
}
