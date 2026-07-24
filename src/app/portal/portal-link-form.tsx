"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarDays, IdCard, Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import { linkPortalAction, type PortalActionState } from "@/lib/actions/portal";

function SubmitButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !ready}
      className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--portal-accent)] text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      )}
      {pending ? "Verificando…" : "Ver mis resultados"}
    </button>
  );
}

export function PortalLinkForm() {
  const [state, formAction] = useActionState<PortalActionState, FormData>(
    linkPortalAction,
    undefined
  );
  const [doc, setDoc] = useState("");
  const [dob, setDob] = useState("");
  const ready = doc.trim().length >= 6 && dob.length === 10;

  // El DNI peruano es numérico de 8 dígitos; otros documentos aceptan letras.
  const [tipo, setTipo] = useState("DNI");
  const numericOnly = tipo === "DNI";

  return (
    <form action={formAction} className="space-y-5">
      {/* Documento: tipo + número en una sola fila unificada */}
      <div className="space-y-1.5">
        <label htmlFor="numero_documento" className="text-sm font-medium text-slate-700">
          Documento de identidad
        </label>
        <div className="flex overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm transition focus-within:border-[var(--portal-accent)] focus-within:ring-2 focus-within:ring-[var(--portal-accent)]/25">
          <div className="relative">
            <select
              name="tipo_documento"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              aria-label="Tipo de documento"
              className="h-12 cursor-pointer appearance-none border-r border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-medium text-slate-700 outline-none"
            >
              <option value="DNI">DNI</option>
              <option value="CE">CE</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            >
              <path fill="currentColor" d="M5.5 7.5L10 12l4.5-4.5H5.5z" />
            </svg>
          </div>
          <div className="relative flex-1">
            <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              id="numero_documento"
              name="numero_documento"
              inputMode={numericOnly ? "numeric" : "text"}
              autoComplete="off"
              maxLength={numericOnly ? 8 : 20}
              placeholder={numericOnly ? "Ej. 45678912" : "Número de documento"}
              value={doc}
              onChange={(e) =>
                setDoc(numericOnly ? e.target.value.replace(/\D/g, "") : e.target.value)
              }
              className="h-12 w-full bg-transparent pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Fecha de nacimiento */}
      <div className="space-y-1.5">
        <label htmlFor="fecha_nacimiento" className="text-sm font-medium text-slate-700">
          Fecha de nacimiento
        </label>
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
          <input
            id="fecha_nacimiento"
            name="fecha_nacimiento"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[var(--portal-accent)]/25"
          />
        </div>
      </div>

      {/* Mensaje de error (altura reservada para evitar saltos) */}
      <div className="min-h-[1.25rem]" aria-live="polite">
        {state?.error && (
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {state.error}
          </p>
        )}
      </div>

      <SubmitButton ready={ready} />
    </form>
  );
}
