// Verificacion del motor de calculo.
//
//   npm test
//
// Los numeros esperados NO estan inventados: salen de la planilla que se venia
// usando a mano (hojas CASA, LOCAL, AGUA e IMP_INMOBILIARIO), con sus
// condiciones reales de entonces: 10% cada 3 meses, comision 7%, mora 2%
// diario, vencimiento el 10 y el agua y el impuesto repartidos 50/50. Si estos
// casos siguen dando, lib/calc.ts reemplaza esas formulas sin perder un peso.
//
// Los ultimos dos bloques prueban lo contrario: que ninguna de esas condiciones
// este fija en el codigo.
const { calcularContrato } = require("../.test-build/calc.js");

let fallas = 0;
const casi = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;
function chequeo(nombre, obtenido, esperado) {
  const ok = casi(obtenido, esperado);
  if (!ok) fallas++;
  const fmt = (n) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  console.log(`${ok ? "  ok  " : " FALLA"} ${nombre.padEnd(46)} ${fmt(obtenido).padStart(14)}  esperado ${fmt(esperado)}`);
}

const base = {
  id: "c1", propiedad_id: "p1", inquilino: "Inquilino", telefono: "", email: "",
  ajuste_tipo: "porcentaje", comision_pct: 7, mora_pct_diario: 2,
  dia_vencimiento: 10, prorrateo_pct: 50, deposito: 0, nota: "",
  created_at: "", deleted_at: "",
};
const prop = { id: "p1", nombre: "Casa", direccion: "", tipo: "casa", nota: "", orden: 0, created_at: "", deleted_at: "" };

// Las boletas tal como estan en la planilla: total, se reparten 50/50.
const g = (tipo, periodo, monto) => ({
  id: `${tipo}-${periodo}`, tipo, periodo, fecha: "", propiedad_id: "",
  monto, reparte: true, nota: "", created_at: "", deleted_at: "",
});
const gastos = [
  g("agua", "2026-04", 17872.66), g("agua", "2026-05", 17872.66),
  g("agua", "2026-06", 18247.70), g("agua", "2026-07", 21121.21),
  g("agua", "2026-08", 20163.38), g("agua", "2026-09", 21628.15),
  ...["01","02","03","04","05","06","07","08","09","10","11","12"].map((m) =>
    g("inmobiliario", `2026-${m}`, 6329.38)),
];

console.log("\n=== CASA · inicio may-26 · $600.000 · +10% cada 3 meses ===");
const casa = { ...base, fecha_inicio: "2026-05-01", meses: 12, alquiler_inicial: 600000, aumento_pct: 10, aumento_meses: 3 };
const rCasa = calcularContrato(casa, prop, [], gastos, [], "2026-09-20");
const q = (n) => rCasa.cuotas[n - 1];

chequeo("cuota 1 · alquiler bruto", q(1).bruto, 600000);
chequeo("cuota 1 · comision 7%", q(1).comision, 42000);
chequeo("cuota 1 · neto", q(1).neto, 558000);
chequeo("cuota 1 · 50% del agua", q(1).partes.find((p) => p.tipo === "agua").parte, 8936.33);
chequeo("cuota 1 · 50% del impuesto", q(1).partes.find((p) => p.tipo === "inmobiliario").parte, 3164.69);
chequeo("cuota 1 · reintegro del inquilino", q(1).reintegro, 12101.02);
chequeo("cuota 1 · subtotal esperado", q(1).subtotal, 570101.02);
chequeo("cuota 2 · subtotal (agua de junio)", q(2).subtotal, 570288.54);
chequeo("cuota 3 · subtotal (agua de julio)", q(3).subtotal, 571725.30);
chequeo("cuota 4 · primer aumento (ago-26)", q(4).bruto, 660000);
chequeo("cuota 4 · subtotal", q(4).subtotal, 627046.38);
chequeo("cuota 5 · subtotal", q(5).subtotal, 627778.77);
chequeo("cuota 6 · sin agua cargada", q(6).subtotal, 616964.69);
chequeo("cuota 7 · segundo aumento (nov-26)", q(7).bruto, 726000);
chequeo("cuota 10 · tercer aumento (feb-27)", q(10).bruto, 798600);
chequeo("total del contrato · bruto", rCasa.totales.bruto, 8353800);
chequeo("total del contrato · comisiones", rCasa.totales.comision, 584766);
chequeo("total del contrato · neto", rCasa.totales.neto, 7769034);

console.log("\n=== LOCAL · inicio abr-26 · $580.000 · mora 2% diario ===");
const local = { ...base, id: "c2", fecha_inicio: "2026-04-01", meses: 12, alquiler_inicial: 580000, aumento_pct: 10, aumento_meses: 3 };
// Cobro del 16 de junio: vencia el 10, seis dias de atraso.
const cobros = [{ id: "x1", contrato_id: "c2", periodo: "2026-06", fecha_cobro: "2026-06-16", importe: 616478, nota: "", created_at: "", deleted_at: "" }];
const rLocal = calcularContrato(local, prop, cobros, gastos, [], "2026-09-20");
const jun = rLocal.cuotas.find((c) => c.periodo === "2026-06");

chequeo("jun-26 · subtotal sin mora", jun.subtotal, 551688.54);
chequeo("jun-26 · dias de mora", jun.diasMora, 6);
chequeo("jun-26 · recargo (2% x 6 dias)", jun.recargo, 69600);
chequeo("jun-26 · total esperado con mora", jun.esperado, 621288.54);
chequeo("jun-26 · diferencia contra lo transferido", jun.diferencia, -4810.54);
chequeo("jul-26 · primer aumento", rLocal.cuotas.find((c) => c.periodo === "2026-07").bruto, 638000);
chequeo("oct-26 · segundo aumento", rLocal.cuotas.find((c) => c.periodo === "2026-10").bruto, 701800);

console.log("\n=== las condiciones no estan fijas en la app ===");
const otro = { ...base, id: "c3", fecha_inicio: "2026-01-01", meses: 24, alquiler_inicial: 1000000,
  aumento_pct: 8, aumento_meses: 6, comision_pct: 0, mora_pct_diario: 0, dia_vencimiento: 5, prorrateo_pct: 100 };
const rOtro = calcularContrato(otro, prop, [], gastos, [], "2026-09-20");
chequeo("24 meses cargados", rOtro.cuotas.length, 24);
chequeo("+8% cada 6 meses · cuota 7", rOtro.cuotas[6].bruto, 1080000);
chequeo("+8% cada 6 meses · cuota 13", rOtro.cuotas[12].bruto, 1166400);
chequeo("comision 0 · neto = bruto", rOtro.cuotas[0].neto, 1000000);
chequeo("prorrateo 100% · se lleva toda el agua", rOtro.cuotas[0].partes.find((p) => p.tipo === "inmobiliario").parte, 6329.38);
chequeo("vence el 5", Number(rOtro.cuotas[0].vence.slice(-2)), 5);
chequeo("mora 0 · sin recargo aunque este vencida", rOtro.cuotas[0].recargo, 0);

const sinAumento = { ...otro, id: "c4", ajuste_tipo: "ninguno" };
const rSin = calcularContrato(sinAumento, prop, [], gastos, [], "2026-09-20");
chequeo("sin aumentos · cuota 24 = cuota 1", rSin.cuotas[23].bruto, 1000000);

console.log("\n=== importe fijado a mano le gana a la proyeccion ===");
const fijados = [{ id: "a1", contrato_id: "c1", periodo: "2026-08", monto: 640000, nota: "lo que arreglamos", created_at: "", deleted_at: "" }];
const rFijo = calcularContrato(casa, prop, [], gastos, fijados, "2026-09-20");
const ago = rFijo.cuotas.find((c) => c.periodo === "2026-08");
chequeo("ago-26 · importe cargado a mano", ago.bruto, 640000);
chequeo("ago-26 · marcado como fijado", ago.fijado ? 1 : 0, 1);
chequeo("ago-26 · comision sobre el importe real", ago.comision, 44800);
chequeo("sep-26 · la proyeccion sigue su curso", rFijo.cuotas.find((c) => c.periodo === "2026-09").bruto, 660000);

console.log(fallas === 0 ? "\nTODO OK: los 38 casos dan igual que la planilla.\n" : `\n${fallas} CASOS FALLARON\n`);
process.exit(fallas ? 1 : 0);
