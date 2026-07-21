import type { Role } from "@/lib/database.types";
import type { ModuleKey, PermissionMap } from "@/lib/permissions";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  ClipboardList,
  TestTube2,
  FlaskConical,
  Send,
  Receipt,
  BarChart3,
  History,
  Settings,
  FolderTree,
  Boxes,
  ShieldCheck,
} from "lucide-react";

export const NAV_ICONS = {
  LayoutDashboard,
  CalendarDays,
  Users,
  ClipboardList,
  TestTube2,
  FlaskConical,
  Send,
  Receipt,
  BarChart3,
  History,
  Settings,
  FolderTree,
  Boxes,
  ShieldCheck,
};

export type NavItem = {
  label: string;
  href: string;
  icon: keyof typeof NAV_ICONS;
  roles?: Role[]; // si se omite, visible para todos los miembros
  /** Clave de permiso a usar cuando no coincide 1:1 con `href` (ej. rutas anidadas). */
  module?: ModuleKey;
};

export type NavSection = { title: string; items: NavItem[] };

export const NAV: NavSection[] = [
  {
    title: "Operación",
    items: [
      { label: "Panel", href: "/dashboard", icon: "LayoutDashboard" },
      { label: "Agenda", href: "/agenda", icon: "CalendarDays", roles: ["org_admin", "sede_admin", "recepcion", "medico"] },
      { label: "Pacientes", href: "/pacientes", icon: "Users", roles: ["org_admin", "sede_admin", "recepcion", "medico", "lectura"] },
      { label: "Órdenes / Atención", href: "/ordenes", icon: "ClipboardList" },
      { label: "Muestras", href: "/muestras", icon: "TestTube2", roles: ["org_admin", "sede_admin", "toma_muestra", "analista", "recepcion"] },
      { label: "Resultados", href: "/resultados", icon: "FlaskConical", roles: ["org_admin", "sede_admin", "analista", "validador", "medico"] },
      { label: "Entrega", href: "/entrega", icon: "Send", roles: ["org_admin", "sede_admin", "recepcion", "validador"] },
      { label: "Inventario", href: "/inventario", icon: "Boxes", roles: ["org_admin", "sede_admin", "analista", "toma_muestra", "recepcion", "lectura"] },
    ],
  },
  {
    title: "Administración",
    items: [
      { label: "Analítica", href: "/analitica", icon: "BarChart3", roles: ["org_admin", "sede_admin", "facturacion", "lectura"] },
      { label: "Catálogo", href: "/catalogo", icon: "FolderTree", roles: ["org_admin", "sede_admin"] },
      { label: "Facturación", href: "/facturacion", icon: "Receipt", roles: ["org_admin", "sede_admin", "facturacion"] },
      { label: "Trazabilidad", href: "/trazabilidad", icon: "History", roles: ["org_admin", "sede_admin", "lectura"] },
      { label: "Configuración", href: "/configuracion", icon: "Settings", roles: ["org_admin", "sede_admin"] },
    ],
  },
  {
    title: "Plataforma",
    items: [
      {
        label: "Admin · Organizaciones",
        href: "/admin/organizaciones",
        icon: "ShieldCheck",
        module: "admin_organizaciones",
      },
    ],
  },
];

/**
 * Navegación visible según los permisos efectivos del usuario (defaults +
 * sobrescrituras granulares por organización/sede). El módulo de cada ítem
 * se deriva de su ruta (`/agenda` → `agenda`).
 */
export function visibleNav(perms: PermissionMap): NavSection[] {
  return NAV.map((section) => ({
    ...section,
    items: section.items.filter((it) => {
      const key = it.module ?? (it.href.slice(1) as ModuleKey);
      return perms[key]?.view === true;
    }),
  })).filter((s) => s.items.length > 0);
}
