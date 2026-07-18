"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Dispara el diálogo de impresión del navegador (Guardar como PDF). */
export function PrintButton({ label = "Imprimir / PDF" }: { label?: string }) {
  return (
    <Button onClick={() => window.print()} className="no-print">
      <Printer className="h-4 w-4" /> {label}
    </Button>
  );
}
