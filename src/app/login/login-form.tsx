"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react";
import { signInAction, type ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Ingresar
    </Button>
  );
}

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [state, formAction] = useActionState<ActionState, FormData>(signInAction, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <Label htmlFor="email" className="text-white/85">Correo electrónico</Label>
        {/* Contenedor con "focus-within": cuando el input recibe foco, el
            grupo gana un halo sutil y el icono se ilumina, ofreciendo un
            feedback vivo mientras el usuario completa el formulario. */}
        <div className="group relative rounded-md ring-1 ring-transparent transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/50 focus-within:shadow-[0_0_0_4px_rgba(20,184,166,0.12)]">
          <Mail
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-white/45 transition-colors duration-200 group-focus-within:text-cyan-300"
          />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="tu@clinica.com"
            required
            autoComplete="email"
            className="liquid-input border-white/15 bg-black/30 pl-9 text-white shadow-none placeholder:text-white/40 focus-visible:bg-black/40 focus-visible:ring-0"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-white/85">Contraseña</Label>
        <div className="group relative rounded-md ring-1 ring-transparent transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/50 focus-within:shadow-[0_0_0_4px_rgba(20,184,166,0.12)]">
          <KeyRound
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-white/45 transition-colors duration-200 group-focus-within:text-cyan-300"
          />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="liquid-input border-white/15 bg-black/30 pl-9 pr-10 text-white shadow-none placeholder:text-white/40 focus-visible:bg-black/40 focus-visible:ring-0"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex h-9 w-9 items-center justify-center rounded-r-md text-white/50 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {/* Espacio reservado para mensajes de error/advertencia: evita que el
          formulario "salte" de tamaño cuando aparece un mensaje. */}
      <div className="min-h-11" aria-live="polite">
        {state?.error && (
          <p className="rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-xs text-red-200">
            {state.error}
          </p>
        )}
      </div>
      <SubmitButton />
    </form>
  );
}
