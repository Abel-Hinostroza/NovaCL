"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Receipt, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emitInvoiceAction } from "@/lib/actions/billing";

export function InvoiceButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await emitInvoiceAction(orderId);
          if (r.error) toast.error(r.error);
          else {
            toast.success("Comprobante emitido");
            router.refresh();
          }
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
      Emitir
    </Button>
  );
}
