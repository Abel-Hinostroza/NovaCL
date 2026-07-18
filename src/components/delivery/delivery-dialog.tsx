"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDeliveryAction } from "@/lib/actions/delivery";
import type { DeliveryChannel } from "@/lib/database.types";

export function DeliveryDialog({
  orderId,
  defaultEmail,
  defaultPhone,
}: {
  orderId: string;
  defaultEmail: string;
  defaultPhone: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [canal, setCanal] = useState<DeliveryChannel>("email");
  const [destino, setDestino] = useState(defaultEmail);
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function onChannelChange(v: string) {
    const c = v as DeliveryChannel;
    setCanal(c);
    setDestino(c === "email" ? defaultEmail : c === "sms" || c === "whatsapp" ? defaultPhone : "");
  }

  function send() {
    start(async () => {
      const res = await createDeliveryAction(orderId, canal, destino);
      if (!("ok" in res)) {
        toast.error(res.error);
        return;
      }
      setLink(res.link ?? null);
      toast.success(res.sent ? "Resultados enviados" : "Enlace generado");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setLink(null); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Send className="h-4 w-4" /> Enviar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar resultados</DialogTitle>
          <DialogDescription>
            Se genera un enlace seguro al portal del paciente (válido 30 días).
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="space-y-3">
            <Label>Enlace del portal</Label>
            <div className="flex gap-2">
              <Input readOnly value={link} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button className="w-full" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select value={canal} onValueChange={onChannelChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Correo electrónico</SelectItem>
                  <SelectItem value="portal">Solo generar enlace</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canal !== "portal" && (
              <div className="space-y-2">
                <Label>{canal === "email" ? "Correo" : "Teléfono"}</Label>
                <Input value={destino} onChange={(e) => setDestino(e.target.value)} />
              </div>
            )}
            <Button className="w-full" onClick={send} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {canal === "portal" ? "Generar enlace" : "Enviar"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
