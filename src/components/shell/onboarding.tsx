"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import { bootstrapOrgAction } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOutAction } from "@/lib/actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Crear organización
    </Button>
  );
}

export function OnboardingCard({ email }: { email: string }) {
  const router = useRouter();
  const [state, action] = useActionState(bootstrapOrgAction, undefined);

  useEffect(() => {
    if (state && "ok" in state && state.ok) router.refresh();
  }, [state, router]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Configura tu laboratorio</CardTitle>
        <CardDescription>
          Aún no perteneces a ninguna organización. Crea una para comenzar; quedarás
          como administrador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre de la organización / clínica</Label>
            <Input id="nombre" name="nombre" placeholder="Laboratorio San Rafael" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sede">Primera sede</Label>
            <Input id="sede" name="sede" placeholder="Sede Central" defaultValue="Sede Central" />
          </div>
          {state && "error" in state && state.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <Submit />
        </form>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>{email}</span>
          <button onClick={() => void signOutAction()} className="underline">
            Cerrar sesión
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
