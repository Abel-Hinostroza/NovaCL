"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

export function StatusFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("status") ?? "todas";

  function set(value: string) {
    const next = new URLSearchParams(params);
    if (value === "todas") next.delete("status");
    else next.set("status", value);
    router.replace(`${pathname}?${next.toString()}` as never);
  }

  return (
    <Select value={current} onValueChange={set}>
      <SelectTrigger className="w-[190px]">
        <SelectValue placeholder="Estado" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todas">Todos los estados</SelectItem>
        {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
