"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, Stethoscope, X } from "lucide-react";
import { searchProfessionalsAction, type ProfessionalLite } from "@/lib/actions/professionals";
import { professionalTypeLabel } from "@/lib/professionals";
import { cn } from "@/lib/utils";

/**
 * Selector con búsqueda del directorio de profesionales.
 *
 * Pensado para usarse como "Médico solicitante" en la creación de
 * órdenes y citas, y como "Se avisó a" en la constancia de valor
 * crítico. Permite limpiar la selección y, si se quiere, complementar
 * con texto libre (`freeText`) para mantener compatibilidad con
 * profesionales externos que aún no estén en el directorio.
 */
type ProfessionalPickerProps = {
  value: string | null;
  onChange: (id: string | null, prof: ProfessionalLite | null) => void;
  /** Texto libre controlado por el padre (se sincroniza al elegir un profesional). */
  freeText?: string;
  onFreeTextChange?: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

export function ProfessionalPicker({
  value,
  onChange,
  onFreeTextChange,
  placeholder = "Buscar por nombre, apellido, colegiatura o especialidad…",
  required = false,
  className,
}: ProfessionalPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ProfessionalLite[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [searching, startSearch] = useTransition();
  const [selected, setSelected] = useState<ProfessionalLite | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carga inicial y búsqueda con debounce
  useEffect(() => {
    let cancelled = false;
    startSearch(async () => {
      const res = await searchProfessionalsAction(query);
      if (cancelled) return;
      setItems(res);
      setActiveIdx(0);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Click-outside para cerrar
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(p: ProfessionalLite) {
    setSelected(p);
    onChange(p.id, p);
    // Si el picker está vinculado a un input de texto libre, también lo
    // rellenamos con la versión canónica: "Apellidos, Nombres — CMP 12345".
    if (onFreeTextChange) {
      const cred = p.numero_colegiatura
        ? `${p.colegio ?? ""} ${p.numero_colegiatura}`.trim()
        : "";
      onFreeTextChange(cred ? `${p.apellidos}, ${p.nombres} — ${cred}` : `${p.apellidos}, ${p.nombres}`);
    }
    setOpen(false);
  }

  function clear() {
    setSelected(null);
    onChange(null, null);
    setQuery("");
    setItems([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = items[activeIdx];
      if (p) pick(p);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Si el value controlado cambió desde fuera (reset del formulario),
  // sincronizamos la selección local.
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id !== value) {
      const match = items.find((p) => p.id === value);
      if (match) setSelected(match);
    }
  }, [value, items, selected]);
  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {selected ? (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {selected.apellidos}, {selected.nombres}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {professionalTypeLabel(selected.tipo)}
              {selected.numero_colegiatura
                ? ` · ${selected.colegio ?? ""} ${selected.numero_colegiatura}`.trim()
                : ""}
              {selected.externo ? " · Externo" : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Quitar selección"
            onClick={clear}
            className="ml-2 rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 10);
          }}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm hover:bg-accent/40"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <Stethoscope className="h-4 w-4" />
            {required ? "Selecciona un profesional *" : "Selecciona un profesional (opcional)"}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      )}

      {open && !selected && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {items.length === 0 && !searching && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Sin coincidencias. Si el profesional no está en el directorio,
                {onFreeTextChange ? " escríbelo abajo en texto libre." : " pídele al admin que lo registre."}
              </li>
            )}
            {items.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm",
                    i === activeIdx ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {p.apellidos}, {p.nombres}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {professionalTypeLabel(p.tipo)}
                      {p.numero_colegiatura
                        ? ` · ${p.colegio ?? ""} ${p.numero_colegiatura}`.trim()
                        : ""}
                      {p.especialidad ? ` · ${p.especialidad}` : ""}
                    </span>
                  </span>
                  {i === activeIdx && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
