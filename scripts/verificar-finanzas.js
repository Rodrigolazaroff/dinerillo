// Verificacion de las cuentas del mes (lib/finanzas.ts).
//
//   npm test
//
// Casos chicos y hechos a mano, cada uno con el numero que tiene que dar.
const f = require("../.test-build/finanzas.js");

let fallas = 0;
function chequeo(nombre, obtenido, esperado) {
  const ok = typeof esperado === "number"
    ? Math.abs(obtenido - esperado) <= 0.01
    : JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallas++;
  console.log(`${ok ? "  ok  " : " FALLA"} ${nombre.padEnd(52)} ${String(obtenido).padStart(14)}  esperado ${esperado}`);
}

const base = { nota: "", created_at: "", deleted_at: "" };
const vacio = {
  ingresos: [], ingresoCobros: [], categorias: [], misGastos: [], divGastos: [],
  divCierres: [], calculados: [], config: {},
};

console.log("\n=== ingresos en varias monedas ===");
{
  const e = {
    ...vacio,
    ingresos: [
      { ...base, id: "sueldo", nombre: "Sueldo", moneda: "ARS", orden: 0, archivado_at: "" },
      { ...base, id: "consu", nombre: "Consultoría", moneda: "EUR", orden: 1, archivado_at: "" },
    ],
    ingresoCobros: [
      { ...base, id: "a", ingreso_id: "sueldo", fecha: "2026-10-05", periodo: "2026-10", monto: 1000000, tipo_cambio: 1 },
      { ...base, id: "b", ingreso_id: "consu", fecha: "2026-10-12", periodo: "2026-10", monto: 300, tipo_cambio: 1500 },
      // Cobrado en noviembre pero corresponde a octubre: cuenta en octubre.
      { ...base, id: "c", ingreso_id: "consu", fecha: "2026-11-02", periodo: "2026-10", monto: 100, tipo_cambio: 1600 },
      // Borrado: no cuenta.
      { ...base, id: "d", ingreso_id: "sueldo", fecha: "2026-10-06", periodo: "2026-10", monto: 999, tipo_cambio: 1, deleted_at: "x" },
    ],
  };
  const r = f.resumenDelMes(e, "2026-10");
  const consu = r.ingresos.lineas.find((l) => l.id === "consu");
  chequeo("consultoría en euros, original", consu.original, 400);
  chequeo("consultoría en pesos, con el TC de cada cobro", consu.pesos, 300 * 1500 + 100 * 1600);
  chequeo("total de ingresos del mes", r.ingresos.total, 1000000 + 610000);
  chequeo("ahorro sugerido por defecto (15%)", r.ahorroSugerido, 1610000 * 0.15);
  chequeo("ahorro sugerido con 20% en ajustes",
    f.resumenDelMes({ ...e, config: { ahorro_pct: "20" } }, "2026-10").ahorroSugerido, 1610000 * 0.2);
}

console.log("\n=== gastos: los tuyos y tu parte de lo compartido ===");
{
  const e = {
    ...vacio,
    categorias: [{ ...base, id: "super", nombre: "Super", color: 3, orden: 0 }],
    misGastos: [
      { ...base, id: "g1", fecha: "2026-10-03", periodo: "2026-10", descripcion: "Café", monto: 5000, categoria_id: "" },
      { ...base, id: "g2", fecha: "2026-10-04", periodo: "2026-10", descripcion: "Chino", monto: 20000, categoria_id: "super" },
    ],
    divGastos: [
      // Pagaste vos el super de 300k al 50%: tu gasto es 150k, te deben 150k.
      { ...base, id: "d1", fecha: "2026-10-05", periodo: "2026-10", descripcion: "Super", monto: 300000, pago: "yo", mi_pct: 50, categoria_id: "super" },
      // Pagó tu pareja 100k al 50%: tu gasto es 50k, le debés 50k.
      { ...base, id: "d2", fecha: "2026-10-08", periodo: "2026-10", descripcion: "Luz", monto: 100000, pago: "pareja", mi_pct: 50, categoria_id: "" },
      // Pagaste vos algo que era 100% de ella: no es gasto tuyo.
      { ...base, id: "d3", fecha: "2026-10-09", periodo: "2026-10", descripcion: "Regalo", monto: 40000, pago: "yo", mi_pct: 0, categoria_id: "" },
    ],
  };
  const r = f.resumenDelMes(e, "2026-10");
  chequeo("gastos propios", r.gastos.propios, 25000);
  chequeo("compartidos: solo tu parte", r.gastos.compartidos, 150000 + 50000);
  chequeo("total de gastos", r.gastos.total, 225000);
  chequeo("Super junta lo tuyo y tu parte", r.gastos.categorias.find((c) => c.id === "super").total, 170000);
  chequeo("saldo: pagaste 340k, tu parte 200k, te deben", r.division.saldo, 140000);
  chequeo("su parte", r.division.suParte, 240000);
  chequeo("quedó sin ingresos = −gastos", r.quedo, -225000);
  chequeo("tasa de ahorro sin ingresos", r.tasaAhorro, null);
}

console.log("\n=== el ajuste ya transferido no avisa más ===");
{
  const div = [
    { ...base, id: "d1", fecha: "2026-10-05", periodo: "2026-10", descripcion: "Super", monto: 100000, pago: "yo", mi_pct: 50, categoria_id: "" },
  ];
  const conDeuda = f.avisos({ ...vacio, divGastos: div, config: { pareja_nombre: "Nahi" } }, "2026-10", "2026-10-20");
  chequeo("avisa que te deben", conDeuda.map((a) => a.texto), ["Nahi te debe $ 50.000"]);
  const cerrado = f.avisos({
    ...vacio, divGastos: div,
    divCierres: [{ ...base, id: "c", periodo: "2026-10", monto: 50000, fecha: "2026-10-31" }],
  }, "2026-10", "2026-10-31");
  chequeo("con el cierre, sin aviso", cerrado.length, 0);
}

console.log("\n=== el ritmo del mes ===");
{
  const e = {
    ...vacio,
    misGastos: [{ ...base, id: "g", fecha: "2026-10-10", periodo: "2026-10", descripcion: "x", monto: 100000, categoria_id: "" }],
  };
  const ritmo = f.insights(e, "2026-10", "2026-10-10").find((i) => i.id === "ritmo");
  chequeo("100k en 10 días → 310k en 31", ritmo.valor, "$ 310.000");
  chequeo("en un mes pasado no hay ritmo", f.insights(e, "2026-10", "2026-11-05").some((i) => i.id === "ritmo"), false);
  chequeo("antes del día 10 no hay ritmo", f.insights(e, "2026-10", "2026-10-03").some((i) => i.id === "ritmo"), false);
}

console.log("\n=== lo que te quedó: ahorrado y disponible ===");
{
  const e = {
    ...vacio,
    ingresos: [{ ...base, id: "s", nombre: "Sueldo", moneda: "ARS", orden: 0, archivado_at: "" }],
    ingresoCobros: [{ ...base, id: "c", ingreso_id: "s", fecha: "2026-10-01", periodo: "2026-10", monto: 1000000, tipo_cambio: 1 }],
    misGastos: [{ ...base, id: "g", fecha: "2026-10-02", periodo: "2026-10", descripcion: "x", monto: 400000, categoria_id: "" }],
    ahorros: [
      { ...base, id: "a1", fecha: "2026-10-05", periodo: "2026-10", monto: 100000, moneda: "ARS", tipo_cambio: 1 },
      // 100 dólares a 1.500: son 150.000 pesos apartados.
      { ...base, id: "a2", fecha: "2026-10-06", periodo: "2026-10", monto: 100, moneda: "USD", tipo_cambio: 1500 },
      // Borrado y de otro mes: no cuentan.
      { ...base, id: "a3", fecha: "2026-10-07", periodo: "2026-10", monto: 999, moneda: "ARS", tipo_cambio: 1, deleted_at: "x" },
      { ...base, id: "a4", fecha: "2026-09-07", periodo: "2026-09", monto: 50000, moneda: "ARS", tipo_cambio: 1 },
    ],
  };
  const r = f.resumenDelMes(e, "2026-10");
  chequeo("te quedó 1.000.000 − 400.000", r.quedo, 600000);
  chequeo("ahorrado 100.000 + 100 USD × 1.500", r.ahorrado, 250000);
  chequeo("disponible = quedó − ahorrado", r.disponible, 350000);
  chequeo("sin tabla de ahorros, nada ahorrado", f.resumenDelMes({ ...e, ahorros: undefined }, "2026-10").ahorrado, 0);
}

console.log(fallas ? `\n${fallas} FALLAS` : "\nTODO OK: las cuentas del mes dan lo que tienen que dar.");
process.exit(fallas ? 1 : 0);
