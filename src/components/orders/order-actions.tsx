"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, Ban, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { anularOrderAction, marcarEntregadaAction } from "@/lib/actions/orders";
import { hasRole } from "@/lib/auth/roles";
import type { OrderStatus, Role } from "@/lib/database.types";

export function OrderActions({
  orderId,
  status,
  roles,
}: {
  orderId: string;
  status: OrderStatus;
  roles: Role[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const canAdmin = hasRole(roles, ["org_admin", "sede_admin", "recepcion"]);
  const canDeliver = hasRole(roles, ["org_admin", "sede_admin", "recepcion", "validador"]);
  if (!canAdmin && !canDeliver) return null;

  const isTerminal = status === "anulada" || status === "entregada";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canDeliver && status === "completada" && (
          <DropdownMenuItem
            onSelect={() =>
              start(async () => {
                const r = await marcarEntregadaAction(orderId);
                if (r.error) toast.error(r.error);
                else {
                  toast.success("Orden marcada como entregada");
                  router.refresh();
                }
              })
            }
          >
            <CheckCircle2 className="h-4 w-4" /> Marcar entregada
          </DropdownMenuItem>
        )}
        {canAdmin && !isTerminal && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() =>
              start(async () => {
                const r = await anularOrderAction(orderId);
                if (r.error) toast.error(r.error);
                else {
                  toast.success("Orden anulada");
                  router.refresh();
                }
              })
            }
          >
            <Ban className="h-4 w-4" /> Anular orden
          </DropdownMenuItem>
        )}
        {isTerminal && (
          <DropdownMenuItem disabled>Sin acciones disponibles</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
