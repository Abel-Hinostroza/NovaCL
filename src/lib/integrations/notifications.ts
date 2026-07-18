/**
 * Capa de notificaciones (email/SMS) desacoplada del proveedor.
 * Por defecto usa Resend si hay RESEND_API_KEY; si no, opera en modo "dev"
 * (registra en consola y devuelve ok), útil para desarrollo local.
 */

type SendResult = { ok: boolean; error?: string };

export async function sendResultEmail(to: string, link: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Nova Lab";

  if (!to) return { ok: false, error: "Destino de email vacío" };

  if (!apiKey || apiKey === "your-resend-key") {
    console.info(`[notifications:dev] Email a ${to} → ${link}`);
    return { ok: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${appName} <resultados@novalab.dev>`,
        to,
        subject: `Tus resultados de laboratorio están listos`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:auto">
            <h2>${appName}</h2>
            <p>Hola, tus resultados de laboratorio ya están disponibles.</p>
            <p>
              <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;
                 padding:10px 18px;border-radius:8px;text-decoration:none">
                Ver mis resultados
              </a>
            </p>
            <p style="color:#666;font-size:12px">Si no reconoces esta solicitud, ignora este mensaje.</p>
          </div>`,
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend: ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
