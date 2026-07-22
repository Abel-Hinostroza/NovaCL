import { Suspense } from "react";
import Image from "next/image";
import { Lock } from "lucide-react";
import { LoginForm } from "./login-form";
import { LogoParticles } from "./logo-particles";

export default function LoginPage() {
  return (
    // El login siempre usa el tema claro: "theme-light" redeclara las variables
    // de color para que no le afecte el theme (claro/oscuro) del resto de la app.
    <div className="theme-light relative min-h-screen overflow-hidden bg-[#03181d]">
      {/* Fotografía de laboratorio: sin velos ni tintes, se muestra tal cual;
          el contraste del formulario lo aporta la propia tarjeta de vidrio. */}
      <Image
        src="/laboratory.png"
        alt=""
        aria-hidden
        fill
        priority
        className="pointer-events-none object-cover object-[32%_45%]"
      />

      {/* Formulario único y centrado: la marca vive dentro de la tarjeta */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-6 sm:p-10">
        {/* Partículas orbitando alrededor de la tarjeta (elemento dinámico) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="relative h-184 w-184">
            <LogoParticles count={30} />
          </div>
        </div>

        {/* Tarjeta de vidrio: sin bordes ni filos; solo desenfoque intenso
            del fondo con un tinte negro ligero que mantiene la transparencia.
            Nota: el elemento con "backdrop-filter" no lleva fondo propio
            (algunos motores dejan de renderizar el desenfoque); el tinte va
            en una capa aparte pintada encima del vidrio ya desenfocado. */}
        {/* Ojo: nada de animaciones/transform/opacity en los ancestros de la
            tarjeta — una animación de opacidad promueve el elemento a su
            propia capa y crea un "backdrop root": el vidrio dejaría de ver
            (y desenfocar) la fotografía. El fade-in va en el contenido. */}
        <div className="relative w-full max-w-md">
          <div className="relative overflow-hidden rounded-[1.25rem] shadow-2xl shadow-black/50 backdrop-blur-[15px] backdrop-saturate-125">
            {/* Tinte negro translúcido, como la tarjeta de la referencia */}
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/35" />
            {/* Barniz diagonal: luz atravesando el vidrio */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-black/20"
            />

            <div className="relative flex animate-fade-in flex-col gap-8 px-9 py-10 sm:px-12">
              {/* Marca integrada. El isotipo va estático a propósito: en un
                  login profesional el movimiento continuo del logo compite
                  con la tarea y ya hay vida en las partículas del fondo. */}
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative">
                  {/* Enfoque claro: halo radial detrás del isotipo para que
                      destaque sobre el vidrio oscuro */}
                  <div
                    aria-hidden
                    className="absolute -inset-x-14 -inset-y-8 rounded-full blur-xl"
                    style={{
                      background:
                        "radial-gradient(closest-side, rgba(255,255,255,0.55), rgba(255,255,255,0.22) 55%, transparent 100%)",
                    }}
                  />
                  <Image
                    src="/isotipo/Isotipo cristalB.png"
                    alt="NovaLIS"
                    width={260}
                    height={310}
                    priority
                    className="relative h-32 w-auto object-contain brightness-90"
                  />
                </div>

                <div className="space-y-2 [text-shadow:0_1px_3px_rgb(0_0_0/0.65)]">
                  {/* Azul clínico de la paleta (hue de --brand-2) aclarado
                      para mantener contraste sobre el vidrio oscuro */}
                  <h2 className="text-xl font-bold uppercase tracking-[0.28em] text-[oklch(0.78_0.11_232)]">
                    Iniciar sesión
                  </h2>
                  <p className="text-sm font-medium text-white/85">
                    Laboratory Information System
                  </p>
                  <p className="mx-auto max-w-xs text-xs leading-relaxed text-white/75">
                    Sistema avanzado para la gestión completa del proceso de
                    examen de laboratorio clínico.
                  </p>
                </div>
              </div>

              <Suspense>
                <LoginForm />
              </Suspense>

              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-white/75 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
                <Lock className="h-3 w-3" />
                Acceso restringido · Uso profesional
              </p>
            </div>
          </div>
        </div>

        <p className="absolute inset-x-0 bottom-6 text-center text-xs text-white/75 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
          © {new Date().getFullYear()} Nova Lab
        </p>
      </div>
    </div>
  );
}
