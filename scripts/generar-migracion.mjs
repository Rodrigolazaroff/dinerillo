// Arma el SQL que pasa la foto de la Sheet a Supabase, y el que la verifica.
//
//   node scripts/generar-migracion.mjs <foto.json> <mail-del-dueno> <carpeta-salida>
//
// La foto sale de scripts/exportar-sheet.mjs. Escribe dos archivos:
//
//   migracion.sql   inserta todo a nombre del usuario con ese mail. Corre en
//                   una sola transaccion: si algo falla, no queda nada a medias.
//   verificacion.sql  cuenta filas y compara una huella (md5) de cada tabla
//                   contra la de la foto. Si todo da "ok", la base tiene
//                   exactamente los mismos datos que la Sheet, y como el
//                   calculo es una funcion pura, los mismos numeros.
//
// Los dos archivos tienen datos personales: van a una carpeta temporal.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [foto, mail, salida] = process.argv.slice(2);
if (!foto || !mail || !salida) {
  console.error("Uso: node scripts/generar-migracion.mjs <foto.json> <mail> <carpeta-salida>");
  process.exit(1);
}

const { datos } = JSON.parse(readFileSync(foto, "utf8"));

// ── formato: el mismo texto que imprime Postgres para cada tipo ─────
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const qn = (s) => (s === "" || s === null || s === undefined ? "null" : q(s));
const dec = (n, escala) => {
  if (Number(n.toFixed(escala)) !== n) {
    throw new Error(`${n} tiene más decimales de los que guarda la base (${escala}).`);
  }
  return n.toFixed(escala);
};
const borrado = (x) => (x.deleted_at ? "t" : "f");

// ── las filas de cada tabla: columnas para el INSERT y huella ───────
const tablas = [
  {
    tabla: "alq_propiedades",
    filas: datos.propiedades,
    insert: (p) => ({
      id: q(p.id), nombre: q(p.nombre), direccion: q(p.direccion), tipo: q(p.tipo),
      nota: q(p.nota), orden: String(p.orden), created_at: q(p.created_at), deleted_at: qn(p.deleted_at),
    }),
    huella: (p) => [p.id, p.nombre, p.direccion, p.tipo, p.nota, p.orden, borrado(p)],
    huellaSql: "id, nombre, direccion, tipo, nota, orden::text, case when deleted_at is null then 'f' else 't' end",
  },
  {
    tabla: "alq_contratos",
    filas: datos.contratos,
    insert: (c) => ({
      id: q(c.id), propiedad_id: q(c.propiedad_id), inquilino: q(c.inquilino), telefono: q(c.telefono),
      email: q(c.email), fecha_inicio: q(c.fecha_inicio), meses: String(c.meses),
      ajuste_tipo: q(c.ajuste_tipo), alquiler_inicial: dec(c.alquiler_inicial, 2),
      aumento_pct: dec(c.aumento_pct, 3), aumento_meses: String(c.aumento_meses),
      comision_pct: dec(c.comision_pct, 3), mora_pct_diario: dec(c.mora_pct_diario, 3),
      dia_vencimiento: String(c.dia_vencimiento), prorrateo_pct: dec(c.prorrateo_pct, 3),
      deposito: dec(c.deposito, 2), nota: q(c.nota), created_at: q(c.created_at), deleted_at: qn(c.deleted_at),
    }),
    huella: (c) => [
      c.id, c.propiedad_id, c.inquilino, c.telefono, c.email, c.fecha_inicio, c.meses, c.ajuste_tipo,
      dec(c.alquiler_inicial, 2), dec(c.aumento_pct, 3), c.aumento_meses, dec(c.comision_pct, 3),
      dec(c.mora_pct_diario, 3), c.dia_vencimiento, dec(c.prorrateo_pct, 3), dec(c.deposito, 2),
      c.nota, borrado(c),
    ],
    huellaSql:
      "id, propiedad_id, inquilino, telefono, email, fecha_inicio::text, meses::text, ajuste_tipo, " +
      "alquiler_inicial::text, aumento_pct::text, aumento_meses::text, comision_pct::text, " +
      "mora_pct_diario::text, dia_vencimiento::text, prorrateo_pct::text, deposito::text, nota, " +
      "case when deleted_at is null then 'f' else 't' end",
  },
  {
    tabla: "alq_fijados",
    filas: datos.alquileres,
    insert: (a) => ({
      id: q(a.id), contrato_id: q(a.contrato_id), periodo: q(a.periodo), monto: dec(a.monto, 2),
      nota: q(a.nota), created_at: q(a.created_at), deleted_at: qn(a.deleted_at),
    }),
    huella: (a) => [a.id, a.contrato_id, a.periodo, dec(a.monto, 2), a.nota, borrado(a)],
    huellaSql: "id, contrato_id, periodo, monto::text, nota, case when deleted_at is null then 'f' else 't' end",
  },
  {
    tabla: "alq_cobros",
    filas: datos.cobros,
    insert: (c) => ({
      id: q(c.id), contrato_id: q(c.contrato_id), periodo: q(c.periodo), fecha_cobro: q(c.fecha_cobro),
      importe: dec(c.importe, 2), nota: q(c.nota), created_at: q(c.created_at), deleted_at: qn(c.deleted_at),
    }),
    huella: (c) => [c.id, c.contrato_id, c.periodo, c.fecha_cobro, dec(c.importe, 2), c.nota, borrado(c)],
    huellaSql:
      "id, contrato_id, periodo, fecha_cobro::text, importe::text, nota, " +
      "case when deleted_at is null then 'f' else 't' end",
  },
  {
    tabla: "alq_boletas",
    filas: datos.gastos,
    insert: (g) => ({
      id: q(g.id), tipo: q(g.tipo), periodo: q(g.periodo), fecha: qn(g.fecha),
      propiedad_id: qn(g.propiedad_id), monto: dec(g.monto, 2), nota: q(g.nota),
      created_at: q(g.created_at), deleted_at: qn(g.deleted_at),
    }),
    huella: (g) => [g.id, g.tipo, g.periodo, g.fecha, g.propiedad_id, dec(g.monto, 2), g.nota, borrado(g)],
    huellaSql:
      "id, tipo, periodo, coalesce(fecha::text, ''), coalesce(propiedad_id, ''), monto::text, nota, " +
      "case when deleted_at is null then 'f' else 't' end",
  },
];

const ajustes = Object.entries(datos.config).map(([clave, valor]) => ({ clave, valor }));

// ── migracion.sql ───────────────────────────────────────────────────
const lineas = [
  "-- Migracion de la Sheet a Supabase. Generado por scripts/generar-migracion.mjs.",
  "-- Todo o nada: corre adentro de un solo bloque.",
  "do $$",
  "declare uid uuid;",
  "begin",
  `  select id into uid from auth.users where email = ${q(mail)};`,
  "  if uid is null then",
  `    raise exception 'No hay usuario con el mail ${mail}. Entrá una vez a la app antes de migrar.';`,
  "  end if;",
  "  if exists (select 1 from public.alq_propiedades where user_id = uid) then",
  "    raise exception 'Ese usuario ya tiene propiedades cargadas: la migración ya corrió.';",
  "  end if;",
];
for (const t of tablas) {
  if (!t.filas.length) continue;
  const cols = Object.keys(t.insert(t.filas[0]));
  lineas.push(`  insert into public.${t.tabla} (user_id, ${cols.join(", ")}) values`);
  lineas.push(
    t.filas
      .map((f) => `    (uid, ${Object.values(t.insert(f)).join(", ")})`)
      .join(",\n") + ";"
  );
}
if (ajustes.length) {
  lineas.push("  insert into public.ajustes (user_id, clave, valor) values");
  lineas.push(ajustes.map((a) => `    (uid, ${q(a.clave)}, ${q(a.valor)})`).join(",\n") + ";");
}
lineas.push("end $$;");
writeFileSync(join(salida, "migracion.sql"), lineas.join("\n") + "\n");

// ── verificacion.sql ────────────────────────────────────────────────
const md5 = (s) => createHash("md5").update(s, "utf8").digest("hex");
const huella = (filas, fn) =>
  md5(
    filas
      .map(fn)
      .map((campos) => [campos[0], campos.map(String).join("|")])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([, linea]) => linea)
      .join("\n")
  );

const consultas = tablas.map((t) => {
  const esperada = huella(t.filas, t.huella);
  return (
    `select ${q(t.tabla)} as tabla, count(*) as filas, ${t.filas.length} as esperadas, ` +
    `md5(coalesce(string_agg(concat_ws('|', ${t.huellaSql}), E'\\n' order by id collate "C"), '')) = ${q(esperada)} as huella_ok ` +
    `from public.${t.tabla} where user_id = (select id from auth.users where email = ${q(mail)})`
  );
});
const esperadaAjustes = huella(ajustes, (a) => [a.clave, a.valor]);
consultas.push(
  `select 'ajustes', count(*), ${ajustes.length}, ` +
    `md5(coalesce(string_agg(concat_ws('|', clave, valor), E'\\n' order by clave collate "C"), '')) = ${q(esperadaAjustes)} ` +
    `from public.ajustes where user_id = (select id from auth.users where email = ${q(mail)})`
);
writeFileSync(join(salida, "verificacion.sql"), consultas.join("\nunion all\n") + ";\n");

console.log("Listo:", tablas.map((t) => `${t.tabla} ${t.filas.length}`).join(", "), `, ajustes ${ajustes.length}`);
