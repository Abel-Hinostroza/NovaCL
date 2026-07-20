"use client";

import { useState } from "react";
import Image from "next/image";
import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

/** Galería de imágenes del artículo con miniatura seleccionable. */
export function ItemGallery({ imagenes, nombre }: { imagenes: string[]; nombre: string }) {
  const [activa, setActiva] = useState(0);

  if (imagenes.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl border bg-muted text-muted-foreground">
        <Boxes className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted">
        <Image
          src={imagenes[activa]}
          alt={nombre}
          fill
          sizes="(max-width: 768px) 100vw, 320px"
          className="object-cover"
          unoptimized
        />
      </div>
      {imagenes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {imagenes.map((url, i) => (
            <button
              key={url}
              onClick={() => setActiva(i)}
              className={cn(
                "relative h-14 w-14 overflow-hidden rounded-md border-2 transition-colors",
                i === activa ? "border-primary" : "border-transparent hover:border-primary/40"
              )}
            >
              <Image src={url} alt={`${nombre} ${i + 1}`} fill sizes="56px" className="object-cover" unoptimized />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
