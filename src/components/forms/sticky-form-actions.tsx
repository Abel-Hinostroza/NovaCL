"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { ReactNode } from "react";

export function StickyFormActions({
  label,
  busyLabel = "Guardando…",
  pending,
  cancel,
  extra,
  variant = "primary",
  placement = "footer",
}: {
  label: string;
  busyLabel?: string;
  pending?: boolean;
  cancel?: { label: string; onClick?: () => void; href?: string };
  extra?: ReactNode;
  variant?: "primary" | "secondary";
  placement?: "footer" | "inline";
}) {
  const { pending: formPending } = useFormStatus();
  const isPending = pending ?? formPending;

  return (
    <div
      data-sticky-actions={placement === "footer" ? "true" : undefined}
      className={
        placement === "footer"
          ? "sticky bottom-0 z-20 -mx-4 mt-6 flex items-center justify-between gap-3 border-t bg-card/95 px-4 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.04)] backdrop-blur sm:-mx-6 sm:px-6"
          : "mt-4 flex items-center justify-between gap-3"
      }
    >
      <div className="flex items-center gap-2">{extra}</div>
      <div className="flex items-center gap-2">
        {cancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={cancel.onClick}
            asChild={Boolean(cancel.href)}
          >
            {cancel.href ? <a href={cancel.href}>{cancel.label}</a> : cancel.label}
          </Button>
        )}
        <Button
          type="submit"
          variant={variant === "primary" ? "default" : "secondary"}
          disabled={isPending}
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? busyLabel : label}
        </Button>
      </div>
    </div>
  );
}

