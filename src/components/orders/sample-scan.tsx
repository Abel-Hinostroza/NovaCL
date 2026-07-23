"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScanLine, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { findSampleByBarcodeAction } from "@/lib/actions/orders";

/**
 * Campo de escaneo de muestras. Un lector de códigos actúa como teclado que
 * "tipea" el valor y envía Enter; por eso basta un input dentro de un form.
 * Al resolver, navega a la orden de la muestra.
 */
export function SampleScan() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = code.trim();
    if (!value) return;
    start(async () => {
      const res = await findSampleByBarcodeAction(value);
      if ("error" in res && res.error) {
        toast.error(res.error);
        setCode("");
        inputRef.current?.focus();
        return;
      }
      toast.success(`Muestra encontrada · abriendo orden`);
      router.push(`/ordenes/${res.orderId}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <div className="relative">
        <ScanLine className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Escanear o escribir código…"
          className="w-64 pl-8 font-mono"
          autoFocus
          disabled={pending}
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending || !code.trim()}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
        Buscar
      </Button>
    </form>
  );
}
