import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  FileText,
  FlaskConical,
  Inbox,
  TriangleAlert,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { readPortalSession } from "@/lib/portal/session";
import { getPortalOrders, type PortalOrderCard } from "@/lib/portal/data";
import { formatDate } from "@/lib/utils";
import { PortalTopbar } from "../_components/portal-topbar";

export const metadata = { title: "Mis resultados · Portal del paciente" };
export const dynamic = "force-dynamic";

export default async function MisResultadosPage() {
  const session = await readPortalSession();
  if (!session) redirect("/portal");

  const admin = createAdminClient();
  const orders = await getPortalOrders(admin, session.pids);

  const totalEstudios = orders.reduce((n, o) => n + o.estudios, 0);
  const conAlertas = orders.filter((o) => o.anormales > 0).length;

  return (
    <div
      className="theme-light min-h-screen bg-slate-50"
      style={{ ["--portal-accent" as string]: "#0f8a8d" }}
    >
      <PortalTopbar nombre={session.nombre} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Saludo + resumen */}
        <div className="mb-7">
          <p className="text-sm text-slate-500">Hola,</p>
          <h1 className="text-2xl font-semibold capitalize tracking-tight text-slate-900">
            {session.nombre.toLowerCase()}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Aquí están tus resultados de laboratorio disponibles.
          </p>
        </div>

        {orders.length > 0 && (
          <div className="mb-7 grid grid-cols-3 gap-3 sm:max-w-xl">
            <StatTile
              label="Órdenes"
              value={orders.length}
              icon={FileText}
            />
            <StatTile label="Estudios" value={totalEstudios} icon={FlaskConical} />
            <StatTile
              label="Con alertas"
              value={conAlertas}
              icon={TriangleAlert}
              alert={conAlertas > 0}
            />
          </div>
        )}

        {orders.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}

        <p className="mx-auto mt-10 max-w-xl text-center text-xs leading-relaxed text-slate-400">
          Los resultados mostrados están validados por el laboratorio. Este
          informe es de carácter referencial: consulta siempre a tu médico para
          su interpretación.
        </p>
      </main>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  alert,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon
          className={`h-3.5 w-3.5 ${alert ? "text-amber-500" : "text-[var(--portal-accent)]"}`}
        />
        {label}
      </div>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          alert ? "text-amber-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function OrderCard({ order }: { order: PortalOrderCard }) {
  return (
    <Link
      href={`/portal/orden/${order.id}`}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--portal-accent)]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-slate-900">
            {order.codigo}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDate(order.fecha)}
          </p>
        </div>
        {order.critico ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-100">
            <TriangleAlert className="h-3 w-3" /> Revisar
          </span>
        ) : order.anormales > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
            <TriangleAlert className="h-3 w-3" /> {order.anormales} fuera de rango
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
            <CheckCircle2 className="h-3 w-3" /> En rango
          </span>
        )}
      </div>

      <div className="mt-4 space-y-1.5 text-sm text-slate-600">
        <p className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-slate-400" />
          {order.estudios} {order.estudios === 1 ? "estudio" : "estudios"}
        </p>
        <p className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-400" />
          <span className="truncate">{order.sede || order.organizacion}</span>
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> Resultado listo
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--portal-accent)]">
          Ver
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Inbox className="h-7 w-7 text-slate-400" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-800">
        Aún no hay resultados disponibles
      </h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
        Cuando tu laboratorio valide tus resultados, aparecerán aquí
        automáticamente. Vuelve a consultar más tarde.
      </p>
    </div>
  );
}
