import type { ContratoCalculado } from "./calc";
import { diasEntre, redondear, sumarMeses, ultimoDiaDelMes } from "./format";
import type { Categoria, Config, DivCierre, DivGasto, Ingreso, IngresoCobro, MiGasto } from "./types";

// Las cuentas del mes, puras como las de calc.ts: mismas entradas, misma
// salida. El cliente las corre con lo que ya tiene en memoria, así cambiar de
// mes no espera a la red.
//
// Tres reglas que atraviesan todo:
//
// - Todo se compara en pesos. Un cobro en dólares vale monto × tipo de cambio
//   del día en que entró, y ese número no se mueve más.
// - Tu gasto de lo compartido es tu parte, la pagues vos o tu pareja. Lo que
//   adelantaste por el otro no es gasto, es plata que te deben.
// - La transferencia del ajuste no es ingreso ni gasto: es esa misma plata que
//   vuelve. Contarla sumaría dos veces.

export const ID_ALQUILERES = "alquileres";
export const SIN_CATEGORIA = "";

/** Los valores por defecto viven en `ajustes`; esto es solo si nunca se tocaron. */
export const AJUSTES_FABRICA = {
  ahorro_pct: 15,
  div_mi_pct: 50,
  pareja_nombre: "",
} as const;

export interface Preferencias {
  ahorroPct: number;
  divMiPct: number;
  pareja: string;
}

export function preferencias(config: Config): Preferencias {
  const n = (k: string, def: number) => {
    const v = Number(config[k]);
    return config[k] !== undefined && config[k] !== "" && Number.isFinite(v) ? v : def;
  };
  return {
    ahorroPct: n("ahorro_pct", AJUSTES_FABRICA.ahorro_pct),
    divMiPct: n("div_mi_pct", AJUSTES_FABRICA.div_mi_pct),
    pareja: (config.pareja_nombre ?? "").trim(),
  };
}

export interface Entradas {
  ingresos: Ingreso[];
  ingresoCobros: IngresoCobro[];
  categorias: Categoria[];
  misGastos: MiGasto[];
  divGastos: DivGasto[];
  divCierres: DivCierre[];
  calculados: ContratoCalculado[];
  config: Config;
}

const vivos = <T extends { deleted_at: string }>(xs: T[]) => xs.filter((x) => !x.deleted_at);

/** Un cobro en pesos. */
export const enPesos = (c: Pick<IngresoCobro, "monto" | "tipo_cambio">) =>
  c.monto * (c.tipo_cambio || 1);

/** Tu parte de un gasto compartido. */
export const miParte = (g: Pick<DivGasto, "monto" | "mi_pct">) => (g.monto * g.mi_pct) / 100;

// ── alquileres como ingreso ─────────────────────────────────────────

/**
 * Lo que dejaron los alquileres en un mes: lo cobrado menos la parte que era
 * reintegro de boletas. El reintegro no es ingreso, es plata tuya que vuelve
 * por el agua y el impuesto que ya pagaste.
 */
export function alquileresDelMes(calculados: ContratoCalculado[], periodo: string) {
  let ingreso = 0;
  let porCobrar = 0;
  for (const cc of calculados) {
    for (const q of cc.cuotas) {
      if (q.periodo !== periodo) continue;
      ingreso += Math.max(0, q.cobrado - q.reintegro);
      porCobrar += Math.max(0, q.esperado - q.cobrado);
    }
  }
  return { ingreso: redondear(ingreso), porCobrar: redondear(porCobrar) };
}

// ── el mes ──────────────────────────────────────────────────────────

export interface LineaIngreso {
  id: string;                // id de la fuente, o ID_ALQUILERES
  nombre: string;
  moneda: string;
  original: number;          // en la moneda de la fuente
  pesos: number;
  cobros: number;
}

export interface LineaCategoria {
  id: string;                // SIN_CATEGORIA = sin categoría
  nombre: string;
  color: number;
  propios: number;
  compartidos: number;
  total: number;
}

export interface Division {
  total: number;
  pagueYo: number;
  pagoPareja: number;
  miParte: number;
  suParte: number;
  /** Positivo: tu pareja te debe. Negativo: le debés vos. */
  saldo: number;
  cierre: DivCierre | null;
  cantidad: number;
}

export interface ResumenMes {
  periodo: string;
  ingresos: { total: number; lineas: LineaIngreso[]; alquileresPorCobrar: number };
  gastos: { total: number; propios: number; compartidos: number; categorias: LineaCategoria[] };
  quedo: number;
  /** Lo que te quedó sobre lo que entró, 0..1. null si no entró nada. */
  tasaAhorro: number | null;
  ahorroSugerido: number;
  ahorroPct: number;
  division: Division;
}

export function divisionDelMes(divGastos: DivGasto[], divCierres: DivCierre[], periodo: string): Division {
  const delMes = vivos(divGastos).filter((g) => g.periodo === periodo);
  let pagueYo = 0, pagoPareja = 0, mia = 0, total = 0;
  for (const g of delMes) {
    total += g.monto;
    if (g.pago === "yo") pagueYo += g.monto;
    else pagoPareja += g.monto;
    mia += miParte(g);
  }
  const cierre = vivos(divCierres).find((c) => c.periodo === periodo) ?? null;
  return {
    total: redondear(total),
    pagueYo: redondear(pagueYo),
    pagoPareja: redondear(pagoPareja),
    miParte: redondear(mia),
    suParte: redondear(total - mia),
    saldo: redondear(pagueYo - mia),
    cierre,
    cantidad: delMes.length,
  };
}

export function resumenDelMes(e: Entradas, periodo: string): ResumenMes {
  const prefs = preferencias(e.config);

  // Ingresos: cada fuente en pesos, y alquileres como una más.
  const fuentes = new Map(e.ingresos.map((i) => [i.id, i]));
  const porFuente = new Map<string, LineaIngreso>();
  for (const c of vivos(e.ingresoCobros)) {
    if (c.periodo !== periodo) continue;
    const f = fuentes.get(c.ingreso_id);
    if (!f || f.deleted_at) continue;
    const l = porFuente.get(f.id) ?? {
      id: f.id, nombre: f.nombre, moneda: f.moneda, original: 0, pesos: 0, cobros: 0,
    };
    l.original += c.monto;
    l.pesos += enPesos(c);
    l.cobros += 1;
    porFuente.set(f.id, l);
  }
  const alq = alquileresDelMes(e.calculados, periodo);
  const tieneAlquileres = e.calculados.length > 0;
  const lineas = [...porFuente.values()].map((l) => ({
    ...l, original: redondear(l.original), pesos: redondear(l.pesos),
  }));
  if (tieneAlquileres) {
    lineas.push({
      id: ID_ALQUILERES, nombre: "Alquileres", moneda: "ARS",
      original: alq.ingreso, pesos: alq.ingreso, cobros: 0,
    });
  }
  lineas.sort((a, b) => b.pesos - a.pesos);
  const totalIngresos = redondear(lineas.reduce((a, l) => a + l.pesos, 0));

  // Gastos: los tuyos más tu parte de lo compartido, por categoría.
  const cats = new Map(e.categorias.map((c) => [c.id, c]));
  const porCat = new Map<string, LineaCategoria>();
  const linea = (id: string) => {
    const c = id ? cats.get(id) : undefined;
    const clave = c && !c.deleted_at ? id : SIN_CATEGORIA;
    const existente = porCat.get(clave);
    if (existente) return existente;
    const nueva: LineaCategoria = {
      id: clave,
      nombre: clave ? c!.nombre : "Sin categoría",
      color: clave ? c!.color : 0,
      propios: 0, compartidos: 0, total: 0,
    };
    porCat.set(clave, nueva);
    return nueva;
  };
  let propios = 0;
  for (const g of vivos(e.misGastos)) {
    if (g.periodo !== periodo) continue;
    propios += g.monto;
    linea(g.categoria_id).propios += g.monto;
  }
  let compartidos = 0;
  for (const g of vivos(e.divGastos)) {
    if (g.periodo !== periodo) continue;
    const p = miParte(g);
    compartidos += p;
    linea(g.categoria_id).compartidos += p;
  }
  const categorias = [...porCat.values()]
    .map((l) => ({
      ...l,
      propios: redondear(l.propios),
      compartidos: redondear(l.compartidos),
      total: redondear(l.propios + l.compartidos),
    }))
    .filter((l) => l.total > 0)
    .sort((a, b) => b.total - a.total);
  const totalGastos = redondear(propios + compartidos);

  const quedo = redondear(totalIngresos - totalGastos);
  return {
    periodo,
    ingresos: { total: totalIngresos, lineas, alquileresPorCobrar: alq.porCobrar },
    gastos: {
      total: totalGastos,
      propios: redondear(propios),
      compartidos: redondear(compartidos),
      categorias,
    },
    quedo,
    tasaAhorro: totalIngresos > 0 ? quedo / totalIngresos : null,
    ahorroSugerido: redondear((totalIngresos * prefs.ahorroPct) / 100),
    ahorroPct: prefs.ahorroPct,
    division: divisionDelMes(e.divGastos, e.divCierres, periodo),
  };
}

// ── el año ──────────────────────────────────────────────────────────

export interface MesSerie {
  periodo: string;
  ingresos: number;
  gastos: number;
  quedo: number;
}

/** Los últimos `meses` meses hasta `hasta` inclusive, del más viejo al más nuevo. */
export function serie(e: Entradas, hasta: string, meses = 12): MesSerie[] {
  return Array.from({ length: meses }, (_, i) => {
    const r = resumenDelMes(e, sumarMeses(hasta, i - meses + 1));
    return { periodo: r.periodo, ingresos: r.ingresos.total, gastos: r.gastos.total, quedo: r.quedo };
  });
}

// ── lo que vale la pena decirte ─────────────────────────────────────

export type TonoAviso = "peligro" | "espera" | "acento" | "ok";

export interface Aviso {
  id: string;
  tono: TonoAviso;
  texto: string;
  href: string;
}

/**
 * Solo lo que pide hacer algo: cobrar, reclamar, transferir. Lo demás va en
 * los números, no en una alerta.
 */
export function avisos(e: Entradas, periodo: string, hoy: string): Aviso[] {
  const out: Aviso[] = [];
  const prefs = preferencias(e.config);

  for (const cc of e.calculados) {
    const nombre = cc.propiedad?.nombre || cc.contrato.inquilino;
    for (const q of cc.cuotas) {
      if (q.periodo > periodo) continue;
      if (q.estado === "vencido") {
        out.push({
          id: `mora-${cc.contrato.id}-${q.periodo}`,
          tono: "peligro",
          texto: `${nombre}: ${q.diasMora} ${q.diasMora === 1 ? "día" : "días"} de atraso con ${q.periodo === periodo ? "este mes" : "un mes anterior"}`,
          href: "/alquileres/cobros",
        });
      } else if (q.periodo === periodo && (q.estado === "pendiente" || q.estado === "parcial")) {
        const faltan = diasEntre(hoy, q.vence);
        out.push({
          id: `cobrar-${cc.contrato.id}-${q.periodo}`,
          tono: q.estado === "parcial" ? "espera" : "acento",
          texto:
            q.estado === "parcial"
              ? `${nombre} pagó una parte: falta cobrar el resto`
              : `Falta cobrar el alquiler de ${nombre}${faltan >= 0 ? `, vence ${faltan === 0 ? "hoy" : `en ${faltan} ${faltan === 1 ? "día" : "días"}`}` : ""}`,
          href: "/alquileres/cobros",
        });
      }
    }
    // El próximo escalón, si cae en los dos meses que vienen.
    if (cc.vigente) {
      const siguientes = cc.cuotas.filter((q) => q.periodo > periodo && q.periodo <= sumarMeses(periodo, 2));
      const actual = cc.cuotas.find((q) => q.periodo === periodo);
      const salto = siguientes.find((q) => actual && !q.fijado && q.bruto > actual.bruto + 1);
      if (salto) {
        out.push({
          id: `aumento-${cc.contrato.id}-${salto.periodo}`,
          tono: "ok",
          texto: `En ${mesLargo(salto.periodo)} aumenta el alquiler de ${nombre}`,
          href: "/alquileres/contratos",
        });
      }
    }
  }

  // El ajuste con la pareja, de este mes o de uno anterior que quedó abierto.
  for (const p of [sumarMeses(periodo, -1), periodo]) {
    const d = divisionDelMes(e.divGastos, e.divCierres, p);
    if (d.cierre || Math.abs(d.saldo) < 1) continue;
    const quien = prefs.pareja || "Tu pareja";
    out.push({
      id: `division-${p}`,
      tono: p < periodo ? "espera" : "acento",
      texto:
        d.saldo > 0
          ? `${quien} te debe ${plataTexto(d.saldo)}${p < periodo ? ` de ${mesLargo(p)}` : " este mes"}`
          : `Le debés ${plataTexto(-d.saldo)} a ${prefs.pareja || "tu pareja"}${p < periodo ? ` de ${mesLargo(p)}` : " este mes"}`,
      href: `/division?mes=${p}`,
    });
  }

  const orden: Record<TonoAviso, number> = { peligro: 0, espera: 1, acento: 2, ok: 3 };
  return out.sort((a, b) => orden[a.tono] - orden[b.tono]);
}

export interface Insight {
  id: string;
  titulo: string;
  valor: string;
  detalle: string;
}

/** Comparaciones contra el mes anterior y el ritmo del mes en curso. */
export function insights(e: Entradas, periodo: string, hoy: string): Insight[] {
  const out: Insight[] = [];
  const r = resumenDelMes(e, periodo);
  const ant = resumenDelMes(e, sumarMeses(periodo, -1));

  // Ritmo: solo tiene sentido en el mes que está corriendo.
  if (hoy.startsWith(periodo) && r.gastos.total > 0) {
    const dia = Number(hoy.slice(8, 10));
    const dias = ultimoDiaDelMes(periodo);
    const porDia = r.gastos.total / dia;
    out.push({
      id: "ritmo",
      titulo: "A este ritmo",
      valor: plataTexto(porDia * dias),
      detalle: `de gastos a fin de mes · ${plataTexto(porDia)} por día`,
    });
  }

  const top = r.gastos.categorias[0];
  if (top && r.gastos.total > 0) {
    out.push({
      id: "top",
      titulo: "Donde más gastaste",
      valor: top.nombre,
      detalle: `${plataTexto(top.total)} · ${Math.round((top.total / r.gastos.total) * 100)}% del mes`,
    });
  }

  // La categoría que más creció contra el mes anterior, en pesos.
  const antPor = new Map(ant.gastos.categorias.map((c) => [c.id, c.total]));
  const crecio = r.gastos.categorias
    .map((c) => ({ c, delta: c.total - (antPor.get(c.id) ?? 0) }))
    .filter((x) => x.delta > 0 && antPor.has(x.c.id))
    .sort((a, b) => b.delta - a.delta)[0];
  if (crecio) {
    out.push({
      id: "crecio",
      titulo: "Lo que más subió",
      valor: crecio.c.nombre,
      detalle: `+${plataTexto(crecio.delta)} contra ${mesLargo(ant.periodo)}`,
    });
  }

  const fuerte = r.ingresos.lineas.filter((l) => l.pesos > 0);
  if (fuerte.length > 1) {
    const principal = fuerte[0];
    out.push({
      id: "fuente",
      titulo: "Tu ingreso principal",
      valor: principal.nombre,
      detalle: `${Math.round((principal.pesos / r.ingresos.total) * 100)}% de lo que entró`,
    });
  }

  return out;
}

// Texto plano para los avisos: el componente de la pantalla no está acá.
const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const plataTexto = (n: number) => `$ ${nf.format(Math.round(n))}`;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesLargo = (p: string) => MESES[Number(p.slice(5, 7)) - 1] ?? p;
