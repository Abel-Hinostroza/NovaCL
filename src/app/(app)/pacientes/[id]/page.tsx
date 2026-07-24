import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Mail,
  Phone,
  MapPin,
  IdCard,
  Shield,
  Droplet,
  AlertTriangle,
  HeartPulse,
} from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PatientDialog } from "@/components/patients/patient-dialog";
import { ConsolidatedReportCard } from "@/components/patients/consolidated-report-card";
import { ClinicalProfileDialog } from "@/components/patients/clinical/clinical-profile-dialog";
import { ConditionsSection } from "@/components/patients/clinical/conditions-section";
import { AllergiesSection } from "@/components/patients/clinical/allergies-section";
import { MedicationsSection } from "@/components/patients/clinical/medications-section";
import { VitalsSection } from "@/components/patients/clinical/vitals-section";
import { NotesSection } from "@/components/patients/clinical/notes-section";
import { AttachmentsSection } from "@/components/patients/clinical/attachments-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderStatusBadge } from "@/components/status-badge";
import { calcAge, formatDate } from "@/lib/utils";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("LIS_patients")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.activeOrgId!)
    .maybeSingle();

  if (!patient) notFound();

  // Data de la historia clínica + directorio de profesionales (para las firmas)
  const [
    { data: orders },
    { data: clinicalProfile },
    { data: conditions },
    { data: allergies },
    { data: medications },
    { data: vitals },
    { data: notes },
    { data: attachments },
    { data: professionals },
  ] = await Promise.all([
    supabase
      .from("v_order_overview")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("LIS_clinical_profile").select("*").eq("patient_id", id).maybeSingle(),
    supabase
      .from("LIS_clinical_conditions")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("LIS_allergies")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("LIS_medications")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("LIS_vitals")
      .select("*")
      .eq("patient_id", id)
      .order("tomado_at", { ascending: false }),
    supabase
      .from("LIS_clinical_notes")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("LIS_clinical_attachments")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("LIS_professionals")
      .select("id,nombres,apellidos,numero_colegiatura")
      .eq("organization_id", ctx.activeOrgId!)
      .eq("activo", true)
      .order("apellidos"),
  ]);

  const professionalsList = professionals ?? [];
  const profById = new Map(professionalsList.map((p) => [p.id, p]));
  const notesWithProf = (notes ?? []).map((note) => ({
    ...note,
    profesional: note.profesional_id ? profById.get(note.profesional_id) ?? null : null,
  }));

  const info = [
    { icon: IdCard, label: "Documento", value: `${patient.tipo_documento} ${patient.numero_documento}` },
    { icon: Phone, label: "Teléfono", value: patient.telefono ?? "—" },
    { icon: Mail, label: "Email", value: patient.email ?? "—" },
    { icon: MapPin, label: "Dirección", value: patient.direccion ?? "—" },
    { icon: Shield, label: "Seguro", value: patient.seguro ?? "—" },
    {
      icon: Droplet,
      label: "Grupo sanguíneo",
      value:
        patient.grupo_sanguineo && patient.grupo_sanguineo !== "desconocido"
          ? `${patient.grupo_sanguineo}${
              clinicalProfile?.factor_rh && clinicalProfile.factor_rh !== "desconocido"
                ? ` ${clinicalProfile.factor_rh}`
                : ""
            }`
          : "—",
    },
  ];

  // Órdenes elegibles para el informe consolidado: con resultados validados
  const elegibles = (orders ?? [])
    .filter((o) => o.items_validados > 0 && o.status !== "anulada")
    .map((o) => ({
      id: o.id,
      codigo: o.codigo,
      created_at: o.created_at,
      items_validados: o.items_validados,
      items_total: o.items_total,
    }));

  // Banner de seguridad: alergias estructuradas + texto legado del paciente
  const alergiasActivas = (allergies ?? []).filter((a) => !a.anulado && a.activa);
  const alergiaResumen =
    alergiasActivas.length > 0
      ? alergiasActivas
          .map((a) => a.agente + (a.severidad ? ` (${a.severidad})` : ""))
          .join(", ")
      : patient.alergias ?? null;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link href="/pacientes">
          <ArrowLeft className="h-4 w-4" /> Pacientes
        </Link>
      </Button>

      <PageHeader
        title={`${patient.nombres} ${patient.apellidos}`}
        description={`${calcAge(patient.fecha_nacimiento)} · ${
          patient.sexo === "F" ? "Femenino" : patient.sexo === "M" ? "Masculino" : "Sexo no especificado"
        }`}
      >
        <ClinicalProfileDialog
          patientId={patient.id}
          sexo={patient.sexo}
          profile={clinicalProfile ?? null}
          trigger={<Button variant="outline">Datos clínicos</Button>}
        />
        <PatientDialog patient={patient} trigger={<Button variant="outline">Editar</Button>} />
        <Button asChild>
          <Link href={`/ordenes/nueva?patient=${patient.id}`}>
            <FileText className="h-4 w-4" /> Nueva atención
          </Link>
        </Button>
      </PageHeader>

      {alergiaResumen && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-300">Alergias conocidas</p>
            <p className="text-red-700/90 dark:text-red-300/90">{alergiaResumen}</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="resumen">
        <TabsList className="flex-wrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="historia">Historia clínica</TabsTrigger>
          <TabsTrigger value="signos">Signos vitales</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="adjuntos">Adjuntos</TabsTrigger>
        </TabsList>

        {/* Resumen */}
        <TabsContent value="resumen">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Datos de contacto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {info.map((i) => (
                    <div key={i.label} className="flex items-start gap-3">
                      <i.icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">{i.label}</p>
                        <p className="text-sm">{i.value}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <ConsolidatedReportCard patientId={patient.id} orders={elegibles} />
            </div>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Historial de atenciones</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Estudios</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders && orders.length > 0 ? (
                      orders.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell>
                            <Link href={`/ordenes/${o.id}`} className="font-medium text-primary hover:underline">
                              {o.codigo}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <OrderStatusBadge status={o.status} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {o.items_validados}/{o.items_total}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(o.created_at)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                          Sin atenciones registradas.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Historia clínica */}
        <TabsContent value="historia">
          {clinicalProfile?.consent_datos && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <HeartPulse className="h-4 w-4" />
              Consentimiento de tratamiento de datos registrado
              {clinicalProfile.consent_datos_at
                ? ` el ${formatDate(clinicalProfile.consent_datos_at)}`
                : ""}
              .
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <AllergiesSection
              patientId={patient.id}
              items={allergies ?? []}
              professionals={professionalsList}
            />
            <ConditionsSection
              patientId={patient.id}
              items={conditions ?? []}
              professionals={professionalsList}
            />
            <div className="lg:col-span-2">
              <MedicationsSection
                patientId={patient.id}
                items={medications ?? []}
                professionals={professionalsList}
              />
            </div>
          </div>
        </TabsContent>

        {/* Signos vitales */}
        <TabsContent value="signos">
          <VitalsSection
            patientId={patient.id}
            items={vitals ?? []}
            professionals={professionalsList}
          />
        </TabsContent>

        {/* Notas de evolución */}
        <TabsContent value="notas">
          <NotesSection
            patientId={patient.id}
            items={notesWithProf}
            professionals={professionalsList}
          />
        </TabsContent>

        {/* Adjuntos */}
        <TabsContent value="adjuntos">
          <AttachmentsSection patientId={patient.id} items={attachments ?? []} />
        </TabsContent>
      </Tabs>
    </>
  );
}
