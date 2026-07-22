"use client";

import { useEffect, useState } from "react";

interface Particle {
  id: number;
  radius: number;
  angleStart: number;
  duration: number;
  size: number;
  minOpacity: number;
  maxOpacity: number;
  pulseDuration: number;
  delay: number;
  reverse: boolean;
  rgb: string;
}

function generate(count: number, palette: string[]): Particle[] {
  return Array.from({ length: count }, (_, id) => {
    const size = 2 + Math.random() * 7;
    const minOpacity = 0.15 + Math.random() * 0.35;
    const radius = 110 + Math.random() * 230;
    // Velocidad LINEAL objetivo (px/s) con algo de variación por partícula.
    // El período se deriva del radio (T = 2πr/v): si fuese aleatorio, la
    // velocidad angular sería ~constante y las órbitas internas se verían
    // lentas frente a las externas.
    const speed = 20 + Math.random() * 16;
    return {
      id,
      radius,
      angleStart: Math.random() * 360,
      duration: (2 * Math.PI * radius) / speed,
      size,
      minOpacity,
      maxOpacity: Math.min(0.95, minOpacity + 0.35 + Math.random() * 0.3),
      pulseDuration: 2.4 + Math.random() * 4.5,
      delay: -Math.random() * 30,
      reverse: Math.random() > 0.5,
      rgb: palette[Math.floor(Math.random() * palette.length)],
    };
  });
}

/* Azules y teals saturados: sobre la fotografía clara del laboratorio los
   tonos pálidos (blanco, pasteles) se perdían; estos contrastan bien. */
const DEFAULT_PALETTE = ["14,165,233", "2,132,199", "20,184,166", "56,189,248"];

interface LogoParticlesProps {
  count?: number;
  className?: string;
  /** Colores (r,g,b) posibles; cada partícula toma uno al azar. */
  palette?: string[];
}

/**
 * Cloud of particles that orbit around the center with random size, radius,
 * angular velocity and pulsing opacity. Rendered only on the client to avoid
 * SSR hydration mismatches with Math.random().
 */
export function LogoParticles({ count = 32, className, palette = DEFAULT_PALETTE }: LogoParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(generate(count, palette));
    // La paleta por defecto es una constante de módulo; no la incluimos en
    // las dependencias para no regenerar por un array literal nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden ${className ?? ""}`}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-orbit"
          style={{
            width: p.radius * 2,
            height: p.radius * 2,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationDirection: p.reverse ? "reverse" : "normal",
            ["--orbit-start" as string]: `${p.angleStart}deg`,
          }}
        >
          <span
            className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full animate-particle-pulse"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: `rgb(${p.rgb})`,
              boxShadow: `0 0 ${Math.max(6, p.size * 2.5)}px rgba(${p.rgb},${p.maxOpacity * 0.9})`,
              animationDuration: `${p.pulseDuration}s`,
              animationDelay: `${p.delay}s`,
              ["--min-opacity" as string]: p.minOpacity,
              ["--max-opacity" as string]: p.maxOpacity,
            }}
          />
        </div>
      ))}
    </div>
  );
}
