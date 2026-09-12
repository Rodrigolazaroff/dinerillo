// Prepara la Sheet que la app usa como base de datos.
//
//   npm run bootstrap
//
// Idempotente: crea las pestañas y los headers que falten, y nunca toca datos
// ya cargados. Se puede correr todas las veces que quieras.

import { google } from "googleapis";

const HEADERS = {
  propiedades: ["id","nombre","direccion","tipo","nota","orden","created_at","deleted_at"],
  contratos: ["id","propiedad_id","inquilino","telefono","email","fecha_inicio","meses","ajuste_tipo","alquiler_inicial","aumento_pct","aumento_meses","comision_pct","mora_pct_diario","dia_vencimiento","prorrateo_pct","deposito","nota","created_at","deleted_at"],
  alquileres: ["id","contrato_id","periodo","monto","nota","created_at","deleted_at"],
  cobros: ["id","contrato_id","periodo","fecha_cobro","importe","nota","created_at","deleted_at"],
  gastos: ["id","tipo","periodo","fecha","propiedad_id","monto","reparte","nota","created_at","deleted_at"],
  config: ["clave","valor"],
};

// Condiciones que vienen precargadas al levantar un contrato nuevo.
// Son solo el default del formulario: cada contrato guarda las suyas.
const CONFIG_INICIAL = [
  ["def_aumento_pct", "15"],
  ["def_aumento_meses", "3"],
  ["def_meses", "12"],
  ["def_comision_pct", "7"],
  ["def_mora_pct_diario", "2"],
  ["def_dia_vencimiento", "10"],
  ["def_prorrateo_pct", "50"],
];

function auth() {
  const email = process.env.GOOGLE_SA_EMAIL;
  let key = (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").trim();
  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
  key = key.replace(/\n/g, "\n");
  if (!email || !key) throw new Error("Faltan GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY");
  return new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

async function main() {
  const jwt = auth();
  const sheets = google.sheets({ version: "v4", auth: jwt });
  const drive = google.drive({ version: "v3", auth: jwt });

  let sheetId = process.env.SHEET_ID;

  if (!sheetId) {
    const res = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: "Rentifay · base de datos", locale: "es_AR" },
        sheets: Object.keys(HEADERS).map((t) => ({ properties: { title: t } })),
      },
    });
    sheetId = res.data.spreadsheetId;
    console.log("Planilla creada:", sheetId);
    if (process.env.SHARE_WITH) {
      await drive.permissions.create({
        fileId: sheetId,
        requestBody: { type: "user", role: "writer", emailAddress: process.env.SHARE_WITH },
        sendNotificationEmail: false,
      });
      console.log("Compartida con:", process.env.SHARE_WITH);
    }
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const existentes = new Set((meta.data.sheets ?? []).map((s) => s.properties.title));
  const requests = [];
  for (const t of Object.keys(HEADERS)) {
    if (!existentes.has(t)) requests.push({ addSheet: { properties: { title: t } } });
  }
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests } });
    console.log("Pestañas creadas:", requests.map((r) => r.addSheet.properties.title).join(", "));
  }

  // Reconcilia los headers. Si la pestaña esta vacia se reescriben; si ya tiene
  // datos, solo se agregan al final las columnas que falten, asi una version
  // nueva de la app no pisa nada de lo ya cargado.
  for (const [tab, header] of Object.entries(HEADERS)) {
    const actual = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tab}!A1:Z`,
    });
    const filas = actual.data.values ?? [];
    const puestos = (filas[0] ?? []).map((h) => String(h ?? "").trim()).filter(Boolean);
    const hayDatos = filas.slice(1).some((f) => f.some((c) => String(c ?? "").trim() !== ""));

    if (!puestos.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tab}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [header] },
      });
      console.log(`Headers escritos en "${tab}"`);
      continue;
    }

    const faltan = header.filter((h) => !puestos.includes(h));
    if (!faltan.length) {
      console.log(`"${tab}" ya estaba al día`);
      continue;
    }

    if (!hayDatos) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tab}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [header] },
      });
      console.log(`Headers de "${tab}" actualizados (estaba vacía)`);
    } else {
      const nuevos = [...puestos, ...faltan];
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tab}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [nuevos] },
      });
      console.log(`"${tab}": columnas agregadas al final -> ${faltan.join(", ")}`);
    }
  }

  const cfg = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "config!A2:B",
  });
  if (!cfg.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "config!A2",
      valueInputOption: "RAW",
      requestBody: { values: CONFIG_INICIAL },
    });
    console.log("Condiciones por defecto cargadas");
  }

  // Negrita en la fila 1 y congelada, para cuando abras la planilla a mano.
  const meta2 = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const formato = [];
  for (const s of meta2.data.sheets ?? []) {
    const t = s.properties.title;
    if (!HEADERS[t]) continue;
    formato.push({
      updateSheetProperties: {
        properties: { sheetId: s.properties.sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    });
    formato.push({
      repeatCell: {
        range: { sheetId: s.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: "userEnteredFormat.textFormat.bold",
      },
    });
  }
  // Saca la hoja por defecto que viene vacia.
  const sobrante = (meta2.data.sheets ?? []).find(
    (s) => !HEADERS[s.properties.title] && /^(Hoja ?1|Sheet ?1|Untitled)/i.test(s.properties.title)
  );
  if (sobrante && (meta2.data.sheets ?? []).length > Object.keys(HEADERS).length) {
    formato.push({ deleteSheet: { sheetId: sobrante.properties.sheetId } });
  }
  if (formato.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests: formato } });
  }

  console.log("\nListo.");
  console.log("SHEET_ID=" + sheetId);
  console.log("https://docs.google.com/spreadsheets/d/" + sheetId + "/edit");
}

main().catch((e) => {
  console.error("\nFalló:", e?.message ?? e);
  process.exit(1);
});
