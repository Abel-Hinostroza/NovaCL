import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/lib/constants";
import type { OrderStatus, OrderPriority } from "@/lib/database.types";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge className={cn(ORDER_STATUS_COLORS[status])}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: OrderPriority }) {
  if (priority === "rutina") return null;
  return <Badge className={cn(PRIORITY_COLORS[priority])}>{PRIORITY_LABELS[priority]}</Badge>;
}
