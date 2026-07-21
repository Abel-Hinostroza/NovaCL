import { Suspense } from "react";
import Image from "next/image";
import { ShieldCheck, Activity, Layers } from "lucide-react";
import { LoginForm } from "./login-form";
import { LogoParticles } from "./logo-particles";

export const metadata = { title: "Ingresar · NovaLIS" };

const highlights = [
  { icon: Layers, label: "Multi-sede" },
  { icon: ShieldCheck, label: "RBAC granular" },
  { icon: Activity, label: "Trazabilidad total" },
];

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Panel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-gradient p-10 text-primary-foreground lg:flex xl:p-14">
        {/* Halos de fondo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-32 h-112 w-md rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-48 -left-24 h-128 w-lg rounded-full bg-white/10 blur-3xl"
        />
        {/* Retícula sutil */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
            maskImage:
              "radial-gradient(ellipse 60% 55% at 50% 45%, black 40%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 60% 55% at 50% 45%, black 40%, transparent 80%)",
          }}
        />

        {/* Marca superior */}
        <div className="relative z-10 flex items-center gap-2.5 animate-fade-in">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm ring-1 ring-white/25">
            <Image
              src="/logo/logo.png"
              alt="NovaLIS"
              width={40}
              height={40}
              priority
              className="h-6 w-6 object-contain"
            />
          </span>
          <span className="text-sm font-medium tracking-wide text-white/90">
            Nova Lab
          </span>
        </div>

        {/* Escenario del isotipo con partículas */}
        <div className="relative z-10 flex flex-1 items-center justify-center py-10">
          <div className="relative flex h-104 w-104 items-center justify-center">
            <LogoParticles count={34} />
            {/* Halo detrás del logo */}
            <div
              aria-hidden
              className="absolute h-64 w-64 rounded-full bg-white/25 blur-3xl animate-halo-breathe"
            />
            <div
              aria-hidden
              className="absolute h-40 w-40 rounded-full bg-white/40 blur-2xl"
            />
            {/* Isotipo prominente */}
            <div className="relative animate-logo-float">
              <Image
                src="/isotipo/Isotipo.png"
                alt="NovaLIS"
                width={520}
                height={620}
                priority
                className="relative z-10 h-64 w-auto object-contain drop-shadow-[0_18px_45px_rgba(0,0,0,0.35)]"
              />
            </div>
          </div>
        </div>

        {/* Tagline compacta */}
        <div className="relative z-10 max-w-md space-y-6 animate-fade-up">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight xl:text-4xl">
              Laboratorio clínico,{" "}
              <span className="text-white/70">sin fricción.</span>
            </h1>
            <p className="text-sm leading-relaxed text-primary-foreground/75 xl:text-base">
              Pacientes, órdenes, muestras y resultados —conectados en tiempo
              real a través de todas tus sedes.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {highlights.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm"
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Nova Lab · Todos los derechos reservados
        </p>
      </div>

      {/* Formulario */}
      <div className="relative flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8 animate-fade-up">
          {/* Isotipo compacto en móvil */}
          <div className="flex flex-col items-center gap-3 text-center lg:hidden">
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full bg-primary/25 blur-2xl"
              />
              <Image
                src="/isotipo/Isotipo.png"
                alt="NovaLIS"
                width={260}
                height={310}
                priority
                className="relative h-28 w-auto object-contain"
              />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Bienvenido de nuevo
            </h2>
            <p className="text-sm text-muted-foreground">
              Ingresa a tu cuenta para continuar en NovaLIS.
            </p>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>

          <p className="text-center text-xs text-muted-foreground">
            Acceso restringido · Uso profesional
          </p>
        </div>
      </div>
    </div>
  );
}
