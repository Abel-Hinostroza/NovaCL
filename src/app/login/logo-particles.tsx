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
}

function generate(count: number): Particle[] {
  return Array.from({ length: count }, (_, id) => {
    const size = 2 + Math.random() * 7;
    const minOpacity = 0.15 + Math.random() * 0.35;
    return {
      id,
      radius: 110 + Math.random() * 230,
      angleStart: Math.random() * 360,
      duration: 22 + Math.random() * 42,
      size,
      minOpacity,
      maxOpacity: Math.min(0.95, minOpacity + 0.35 + Math.random() * 0.3),
      pulseDuration: 2.4 + Math.random() * 4.5,
      delay: -Math.random() * 30,
      reverse: Math.random() > 0.5,
    };
  });
}

interface LogoParticlesProps {
  count?: number;
  className?: string;
}

/**
 * Cloud of particles that orbit around the center with random size, radius,
 * angular velocity and pulsing opacity. Rendered only on the client to avoid
 * SSR hydration mismatches with Math.random().
 */
export function LogoParticles({ count = 32, className }: LogoParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(generate(count));
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
            className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-white animate-particle-pulse"
            style={{
              width: p.size,
              height: p.size,
              boxShadow: `0 0 ${Math.max(6, p.size * 2.5)}px rgba(255,255,255,${p.maxOpacity * 0.9})`,
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
