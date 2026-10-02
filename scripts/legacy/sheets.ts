import { google, type sheets_v4 } from "googleapis";

// La Sheet es solo base de datos: valores planos, sin formulas ni formato.
// Todo el calculo vive en lib/calc.ts, asi la planilla no se puede "romper"
// tocando una celda.

export const TABS = {
  propiedades: "propiedades",
  contratos: "contratos",
  alquileres: "alquileres",
  cobros: "cobros",
  gastos: "gastos",
  config: "config",
} as const;

export type TabName = (typeof TABS)[keyof typeof TABS];

export const HEADERS: Record<TabName, string[]> = {
  propiedades: ["id","nombre","direccion","tipo","nota","orden","created_at","deleted_at"],
  contratos: [
    "id","propiedad_id","inquilino","telefono","email","fecha_inicio","meses","ajuste_tipo",
    "alquiler_inicial","aumento_pct","aumento_meses","comision_pct","mora_pct_diario",
    "dia_vencimiento","prorrateo_pct","deposito","nota","created_at","deleted_at",
  ],
  alquileres: ["id","contrato_id","periodo","monto","nota","created_at","deleted_at"],
  cobros: ["id","contrato_id","periodo","fecha_cobro","importe","nota","created_at","deleted_at"],
  gastos: ["id","tipo","periodo","fecha","propiedad_id","monto","reparte","nota","created_at","deleted_at"],
  config: ["clave","valor"],
};

function credenciales() {
  const email = process.env.GOOGLE_SA_EMAIL;
  const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error("Faltan GOOGLE_SA_EMAIL o GOOGLE_SA_PRIVATE_KEY en las variables de entorno.");
  }
  // Vercel y los .env guardan la clave con los saltos de linea escapados, y
  // algunos paneles la envuelven en comillas. Normalizamos las dos cosas.
  let key = rawKey.trim();
  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
  key = key.replace(/\n/g, "\n");
  return { email, key };
}

let clienteCache: sheets_v4.Sheets | null = null;

export function getSheets(): sheets_v4.Sheets {
  if (clienteCache) return clienteCache;
  const { email, key } = credenciales();
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  clienteCache = google.sheets({ version: "v4", auth });
  return clienteCache;
}

export function getSheetId(): string {
  const id = process.env.SHEET_ID;
  if (!id) throw new Error("Falta SHEET_ID en las variables de entorno.");
  return id;
}

/** Lee varias pestañas en un solo request: Sheets tarda ~400ms por llamada. */
export async function batchGet(tabs: TabName[]): Promise<Record<string, string[][]>> {
  const res = await getSheets().spreadsheets.values.batchGet({
    spreadsheetId: getSheetId(),
    ranges: tabs.map((t) => `${t}!A:Z`),
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const out: Record<string, string[][]> = {};
  (res.data.valueRanges ?? []).forEach((vr, i) => {
    out[tabs[i]] = (vr.values ?? []) as string[][];
  });
  return out;
}

/** Convierte la matriz cruda en objetos usando la fila 1 como header. */
export function filasAObjetos(matriz: string[][]): Record<string, string>[] {
  if (!matriz?.length) return [];
  const [header, ...filas] = matriz;
  return filas
    .filter((f) => f.some((c) => String(c ?? "").trim() !== ""))
    .map((f) => {
      const o: Record<string, string> = {};
      header.forEach((h, i) => {
        o[String(h).trim()] = f[i] === undefined || f[i] === null ? "" : String(f[i]);
      });
      return o;
    });
}

/**
 * Los headers reales de la planilla, cacheados por proceso.
 *
 * Escribimos mapeando por nombre de columna y no por posicion: si algun dia
 * abris la planilla y moves una columna de lugar, los datos siguen cayendo
 * donde corresponde en vez de correrse todos.
 */
const headerCache = new Map<TabName, string[]>();

async function headerReal(tab: TabName): Promise<string[]> {
  const cacheado = headerCache.get(tab);
  if (cacheado) return cacheado;
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${tab}!A1:Z1`,
  });
  const fila = ((res.data.values?.[0] ?? []) as unknown[]).map((h) => String(h ?? "").trim());
  const header = fila.length ? fila : HEADERS[tab];
  headerCache.set(tab, header);
  return header;
}

export async function appendRow(tab: TabName, obj: Record<string, unknown>) {
  const header = await headerReal(tab);
  const fila = header.map((h) => {
    const v = obj[h];
    return v === undefined || v === null ? "" : v;
  });
  await getSheets().spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${tab}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [fila] },
  });
}

/**
 * Ubica la fila por `id` y la reescribe completa, mergeando sobre lo que ya
 * estaba para que un cambio parcial no vacie las otras columnas.
 * Devuelve false si el id no existe.
 */
export async function updateRowById(
  tab: TabName,
  id: string,
  nuevo: Record<string, unknown>
): Promise<boolean> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${tab}!A:Z`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const matriz = (res.data.values ?? []) as string[][];
  if (!matriz.length) return false;
  const header = matriz[0].map((h) => String(h).trim());
  const iId = header.indexOf("id");
  if (iId < 0) return false;

  const idx = matriz.findIndex((f, i) => i > 0 && String(f[iId]) === id);
  if (idx < 0) return false;

  const actual: Record<string, unknown> = {};
  header.forEach((h, i) => (actual[h] = matriz[idx][i] ?? ""));
  const merged = { ...actual, ...nuevo };
  const fila = header.map((h) => {
    const v = merged[h];
    return v === undefined || v === null ? "" : v;
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `${tab}!A${idx + 1}`,
    valueInputOption: "RAW",
    requestBody: { values: [fila] },
  });
  return true;
}

/** Reemplaza todas las filas de config de una vez (son pocas y sin id). */
export async function escribirConfig(pares: [string, string][]) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: getSheetId(),
    range: "config!A2:B",
  });
  if (!pares.length) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: "config!A2",
    valueInputOption: "RAW",
    requestBody: { values: pares },
  });
}

/** Borrado fisico. Solo lo usa "vaciar papelera". */
export async function deleteRowsByIds(tab: TabName, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: getSheetId() });
  const sheetId = meta.data.sheets?.find((s) => s.properties?.title === tab)?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return 0;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${tab}!A:Z`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const matriz = (res.data.values ?? []) as string[][];
  const set = new Set(ids);
  const indices: number[] = [];
  matriz.forEach((f, i) => {
    if (i > 0 && set.has(String(f[0]))) indices.push(i);
  });
  if (!indices.length) return 0;

  // De abajo hacia arriba: borrar una fila corre las de abajo.
  indices.sort((a, b) => b - a);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSheetId(),
    requestBody: {
      requests: indices.map((i) => ({
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: i, endIndex: i + 1 },
        },
      })),
    },
  });
  return indices.length;
}
