import { createClient } from "@/lib/supabase/client";

/** Bucket público donde viven las fotos de los artículos de inventario. */
export const INVENTORY_BUCKET = "inventory";

const PUBLIC_MARKER = `/storage/v1/object/public/${INVENTORY_BUCKET}/`;

/**
 * Extrae la ruta dentro del bucket a partir de una URL pública de Storage.
 * Devuelve null si la URL no pertenece al bucket `inventory`.
 */
export function storagePathFromUrl(url: string): string | null {
  const i = url.indexOf(PUBLIC_MARKER);
  if (i === -1) return null;
  // Descartar cualquier query string (?token, etc.) que pudiera venir adjunto.
  return url.slice(i + PUBLIC_MARKER.length).split("?")[0];
}

/**
 * Borra del bucket `inventory` las imágenes indicadas por su URL pública.
 * Best-effort: ignora URLs ajenas al bucket y no lanza si el borrado falla
 * (la limpieza no debe bloquear el flujo del usuario).
 */
export async function removeInventoryImages(urls: string[]): Promise<void> {
  const paths = urls
    .map(storagePathFromUrl)
    .filter((p): p is string => p !== null);
  if (paths.length === 0) return;
  const supabase = createClient();
  await supabase.storage.from(INVENTORY_BUCKET).remove(paths);
}
