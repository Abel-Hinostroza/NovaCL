#!/usr/bin/env node
// ============================================================================
// Carga masiva del catálogo CIE-10 en la tabla public."LIS_cie10".
//
//   Lee scripts/data/cie10.csv (columnas: codigo,descripcion,categoria,capitulo)
//   y lo inserta en lotes con el service role (omite RLS). Usa
//   `ignoreDuplicates`, así que los códigos ya sembrados por la migración
//   0029 (glosas curadas en español) se conservan intactos.
//
//   Requisitos: la migración 0029 debe estar aplicada (tabla LIS_cie10 creada).
//   Variables (de .env.local o del entorno):
//     NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
//   Uso:
//     node scripts/load-cie10.mjs                 # usa scripts/data/cie10.csv
//     node scripts/load-cie10.mjs ruta/otro.csv   # otro archivo
// ============================================================================
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Carga .env.local sin sobrescribir variables ya presentes ────────────────
function loadEnvLocal() {
  const p = resolve(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

// ── Parser CSV robusto (comillas dobles, comas y saltos escapados) ──────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* ignore */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (en .env.local o el entorno)."
    );
    process.exit(1);
  }

  const csvPath = resolve(process.argv[2] ?? resolve(ROOT, "scripts/data/cie10.csv"));
  if (!existsSync(csvPath)) {
    console.error(`No se encontró el archivo de datos: ${csvPath}`);
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const header = rows[0].map((h) => h.trim());
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  if (col.codigo === undefined || col.descripcion === undefined) {
    console.error("El CSV debe tener al menos las columnas: codigo, descripcion");
    process.exit(1);
  }

  const records = [];
  const seen = new Set();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;
    const codigo = (row[col.codigo] || "").trim().toUpperCase();
    const descripcion = (row[col.descripcion] || "").trim();
    if (!codigo || !descripcion || seen.has(codigo)) continue;
    seen.add(codigo);
    records.push({
      codigo,
      descripcion,
      categoria: col.categoria !== undefined ? (row[col.categoria] || "").trim() || null : null,
      capitulo: col.capitulo !== undefined ? (row[col.capitulo] || "").trim() || null : null,
      activo: true,
    });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase
      .from("LIS_cie10")
      .upsert(batch, { onConflict: "codigo", ignoreDuplicates: true });
    if (error) {
      console.error(`Error en el lote ${i / BATCH + 1}:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    process.stdout.write(`\rProcesados ${inserted}/${records.length}…`);
  }

  const { count } = await supabase
    .from("LIS_cie10")
    .select("*", { count: "exact", head: true });
  console.log(`\n✓ Carga completa. Filas totales en LIS_cie10: ${count ?? "?"}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
