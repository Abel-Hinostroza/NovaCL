import Image from "next/image";
import { redirect } from "next/navigation";
import { ShieldCheck, FileText, Clock, Lock } from "lucide-react";
import { readPortalSession } from "@/lib/portal/session";
import { PortalLinkForm } from "./portal-link-form";

export const metadata = { title: "Portal del paciente · Resultados" };
export const dynamic = "force-dynamic";

export default async function PortalAccessPage() {
  const session = await readPortalSession();
  if (session) redirect("/portal/mis-resultados");

  return (
    <div
      className="theme-light relative min-h-screen w-full lg:grid lg:grid-cols-[1.05fr_1fr]"
      style={{ ["--portal-accent" as string]: "#0f8a8d" }}
    >
      {/* ── Panel de marca (izquierda en desktop, cabecera en móvil) ── */}
      <aside className="relative flex flex-col justify-between overflow-hidden px-8 py-10 text-white lg:px-14 lg:py-16">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 12% 15%, #17a39a 0%, rgba(23,163,154,0) 55%), radial-gradient(ellipse 85% 80% at 90% 90%, #1d5fa0 0%, rgba(29,95,160,0) 58%), linear-gradient(150deg, #0e7d84 0%, #12688f 100%)",
          }}
        />
        {/* Rejilla hexagonal sutil (misma textura molecular del login) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18]"
          style={{
            backgroundImage:
              "url(data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='28'%20height='49'%20viewBox='0%200%2028%2049'%3E%3Cpath%20d='M13.99%209.25l13%207.5v15l-13%207.5L1%2031.75v-15l12.99-7.5zM3%2017.9v12.7l10.99%206.34%2011-6.35V17.9l-11-6.34L3%2017.9z'%20fill='%23ffffff'%20fill-opacity='0.5'/%3E%3C/svg%3E)",
            backgroundSize: "44px 78px",
          }}
        />

        <div className="flex items-center gap-3">
          <Image
            src="/logo/logo fondo negro.png"
            alt="Nova Lab"
            width={148}
            height={40}
            className="h-9 w-auto object-contain"
            priority
          />
        </div>

        <div className="hidden py-10 lg:block">
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Tus resultados de laboratorio, cuando los necesites.
          </h1>
          <p className="mt-3 max-w-md text-sm text-white/80">
            Consulta y descarga tus informes validados de forma segura, sin
            filas ni esperas. Solo necesitas tu documento y tu fecha de
            nacimiento.
          </p>

          <ul className="mt-8 space-y-4">
            <TrustItem icon={ShieldCheck} title="Resultados validados">
              Solo mostramos informes revisados y firmados por el laboratorio.
            </TrustItem>
            <TrustItem icon={FileText} title="Descarga en PDF">
              Guarda o imprime tus resultados para compartirlos con tu médico.
            </TrustItem>
            <TrustItem icon={Clock} title="Disponible 24/7">
              Accede a tu historial de órdenes cuando quieras, desde cualquier
              dispositivo.
            </TrustItem>
          </ul>
        </div>

        <p className="hidden text-xs text-white/60 lg:block">
          © {new Date().getFullYear()} Nova Lab · Sistema de información de
          laboratorio
        </p>
      </aside>

      {/* ── Panel del formulario ── */}
      <main className="flex items-center justify-center bg-slate-50 px-5 py-10 sm:px-8 lg:py-16">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Portal del paciente
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Ingresa tus datos para ver tus resultados.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_24px_-8px_rgba(15,138,141,0.18)] sm:p-7">
            <PortalLinkForm />
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <Lock className="h-3.5 w-3.5" />
            Conexión segura · Tus datos se usan solo para verificar tu identidad.
          </p>
        </div>
      </main>
    </div>
  );
}

function TrustItem({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs leading-relaxed text-white/70">{children}</p>
      </div>
    </li>
  );
}
