import { requireSuperadmin } from "@/lib/auth/session";
import {
  listAllOrganizationsAction,
  listOrgMembersAction,
  listSedesForOrgAction,
} from "@/lib/actions/admin-orgs";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CreateOrganizationButton,
  CreateSedeButton,
  EditOrganizationButton,
  EditSedeButton,
  OrgAdminNotice,
  OrgIconBadge,
  PromoteMemberButton,
  DropMemberButton,
  RoleBadge,
  StatusBadge,
  ToggleOrganizationButton,
  ToggleSedeAdminButton,
} from "@/components/admin/org-forms";

export const metadata = { title: "Admin · Organizaciones" };

export default async function AdminOrganizacionesPage() {
  await requireSuperadmin();

  const organizations = await listAllOrganizationsAction();
  const membershipsByOrg = await Promise.all(
    organizations.map(async (org) => ({
      orgId: org.id,
      members: await listOrgMembersAction(org.id),
    })),
  );
  const sedesByOrg = await Promise.all(
    organizations.map(async (org) => ({
      orgId: org.id,
      sedes: await listSedesForOrgAction(org.id),
    })),
  );

  const membershipMap = new Map(membershipsByOrg.map((x) => [x.orgId, x.members]));
  const sedesMap = new Map(sedesByOrg.map((x) => [x.orgId, x.sedes]));

  return (
    <>
      <PageHeader
        title="Administración de organizaciones"
        description="Da de alta clínicas, gestiona sus sedes y asigna administradores. Solo superadmins."
      />

      <div className="mb-6 flex items-center justify-between gap-3">
        <OrgAdminNotice />
        <CreateOrganizationButton />
      </div>

      <div className="grid gap-6">
        {organizations.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Aún no hay organizaciones. Crea la primera con el botón superior derecho.
            </CardContent>
          </Card>
        )}

        {organizations.map((org) => {
          const orgSedes = sedesMap.get(org.id) ?? [];
          const orgMembers = membershipMap.get(org.id) ?? [];
          return (
            <Card key={org.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <OrgIconBadge activo={org.activo} />
                    <div>
                      <CardTitle className="text-base">{org.nombre}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        slug <span className="font-mono">{org.slug}</span>
                        {org.ruc ? ` · RUC ${org.ruc}` : ""}
                        {` · ${org.timezone}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge activo={org.activo} />
                    <EditOrganizationButton
                      org={{
                        id: org.id,
                        nombre: org.nombre,
                        slug: org.slug,
                        ruc: org.ruc,
                        logo_url: null,
                        timezone: org.timezone,
                        locale: org.locale,
                        activo: org.activo,
                      }}
                    />
                    <ToggleOrganizationButton orgId={org.id} activo={org.activo} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Sedes</h4>
                    <CreateSedeButton orgId={org.id} />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Procesa</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgSedes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-xs text-muted-foreground">
                            Sin sedes registradas.
                          </TableCell>
                        </TableRow>
                      ) : (
                        orgSedes.map((sede) => (
                            <TableRow key={sede.id}>
                              <TableCell className="font-mono text-sm">{sede.codigo}</TableCell>
                              <TableCell className="font-medium">{sede.nombre}</TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">{sede.es_procesadora ? "Sí" : "No"}</span>
                              </TableCell>
                              <TableCell>
                                <StatusBadge activo={sede.activo} />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <EditSedeButton sede={{ ...sede, organization_id: org.id }} />
                                  <ToggleSedeAdminButton sedeId={sede.id} activo={sede.activo} />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Administradores</h4>
                    <PromoteMemberButton
                      orgId={org.id}
                      sedes={orgSedes.map((s) => ({ id: s.id, nombre: s.nombre }))}
                    />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Sede</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgMembers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-xs text-muted-foreground">
                            Sin administradores asignados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        orgMembers.map((m) => {
                          const profile = m.profiles as unknown as { nombre: string; email: string } | null;
                          const sede = m.sedes as unknown as { nombre: string } | null;
                          return (
                            <TableRow key={m.id}>
                              <TableCell>
                                <p className="font-medium">{profile?.nombre ?? "—"}</p>
                                <p className="text-xs text-muted-foreground">{profile?.email}</p>
                              </TableCell>
                              <TableCell>
                                <RoleBadge role={m.role} />
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {sede?.nombre ?? "Toda la organización"}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropMemberButton membershipId={m.id} />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}