import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sin permiso" };

export default function SinPermisoPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <ShieldAlert className="mb-4 h-12 w-12 text-amber-500" />
      <h1 className="text-xl font-semibold">No tienes acceso a esta sección</h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Tu rol actual no incluye permisos para ver esta página. Contacta al
        administrador de tu organización si crees que es un error.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Volver al panel</Link>
      </Button>
    </div>
  );
}
