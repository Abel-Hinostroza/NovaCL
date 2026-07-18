import type { Role } from "@/lib/database.types";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  TestTube2,
  FlaskConical,
  Send,
  Receipt,
  History,
  Settings,
  FolderTree,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: Role[]; // si se omite, visible para todos los miembros
};

export type NavSection = { title: string; items: NavItem[] };

export const NAV: NavSection[] = [
  {
    title: "Operación",
    items: [
      { label: "Panel", href: "/dashboard", icon: LayoutDashboard },
      { label: "Pacientes", href: "/pacientes", icon: Users, roles: ["org_admin", "sede_admin", "recepcion", "medico", "lectura"] },
      { label: "Órdenes / Atención", href: "/ordenes", icon: ClipboardList },
      { label: "Muestras", href: "/muestras", icon: TestTube2, roles: ["org_admin", "sede_admin", "toma_muestra", "analista", "recepcion"] },
      { label: "Resultados", href: "/resultados", icon: FlaskConical, roles: ["org_admin", "sede_admin", "analista", "validador", "medico"] },
      { label: "Entrega", href: "/entrega", icon: Send, roles: ["org_admin", "sede_admin", "recepcion", "validador"] },
    ],
  },
  {
    title: "Administración",
    items: [
      { label: "Catálogo", href: "/catalogo", icon: FolderTree, roles: ["org_admin", "sede_admin"] },
      { label: "Facturación", href: "/facturacion", icon: Receipt, roles: ["org_admin", "sede_admin", "facturacion"] },
      { label: "Trazabilidad", href: "/trazabilidad", icon: History, roles: ["org_admin", "sede_admin", "lectura"] },
      { label: "Configuración", href: "/configuracion", icon: Settings, roles: ["org_admin", "sede_admin"] },
    ],
  },
];

export function visibleNav(roles: Role[], isSuperadmin = false): NavSection[] {
  return NAV.map((section) => ({
    ...section,
    items: section.items.filter(
      (it) => !it.roles || isSuperadmin || it.roles.some((r) => roles.includes(r))
    ),
  })).filter((s) => s.items.length > 0);
}
