import {
  diasEntre, hoyISO, redondear, sumarMeses, vencimientoDe,
} from "./format";
import type { Alquiler, Cobro, Config, Contrato, Gasto, Propiedad, TipoGasto } from "./types";

// Todo el calculo de la app vive aca y es puro: mismas entradas, misma salida.
// El server lo usa para responder y el cliente para adelantar los cambios en
// pantalla sin esperar a que la planilla conteste.

/** Diferencia que se considera "pagado igual". Nadie transfiere los centavos. */
const TOLERANCIA = 1;

export type EstadoCuota = "cobrado" | "parcial" | "vencido" | "pendiente" | "futuro";

export interface ParteGasto {
  tipo: TipoGasto;
  total: number;
  parte: number;
}

export interface Cuota {
  n: number;
  periodo: string;          // YYYY-MM
  vence: string;            // YYYY-MM-DD
  bruto: number;            // alquiler del mes, ya con los aumentos aplicados
  fijado: boolean;          // true = importe cargado a mano, no proyectado
  comision: number;         // lo que retiene la inmobiliaria
  neto: number;             // bruto - comision
  partes: ParteGasto[];     // agua, impuesto, lo que se reparta
  reintegro: number;        // suma de partes: lo que te devuelve el inquilino
  subtotal: number;         // neto + reintegro
  diasMora: number;
  recargo: number;
  moraEstimada: boolean;    // true = la mora corre a hoy, todavia no cobraste
  esperado: number;         // subtotal + recargo
  cobrado: number;
  fechaCobro: string;       // la ultima imputada al periodo
  diferencia: number;       // cobrado - esperado
  estado: EstadoCuota;
  cobros: Cobro[];
}

/** Un contrato que arranca el mes que viene no esta "terminado": no empezo. */
export type EstadoContrato = "por_empezar" | "vigente" | "terminado";

export interface ContratoCalculado {
  contrato: Contrato;
  propiedad: Propiedad | null;
  cuotas: Cuota[];
  inicio: string;           // primer periodo del contrato
  fin: string;              // ultimo periodo del contrato
  estado: EstadoContrato;
  vigente: boolean;
  proxima: Cuota | null;
  totales: {
    bruto: number; comision: number; neto: number; reintegro: number;
    recargo: number; esperado: number; cobrado: number; deuda: number;
  };
}

export interface FilaPeriodo {
  periodo: string;
  bruto: number; comision: number; neto: number; reintegro: number;
  recargo: number; esperado: number; cobrado: number; diferencia: number;
}

export interface Resumen {
  periodoActual: string;
  mes: { esperado: number; cobrado: number; falta: number; cuotas: number; cobradas: number };
  deudaVencida: number;
  anio: {
    bruto: number; comision: number; neto: number; cobrado: number;
  };
  historico: { esperado: number; cobrado: number; comision: number };
  porPeriodo: FilaPeriodo[];
  proximos: { cuota: Cuota; contrato: Contrato; propiedad: Propiedad | null }[];
  escalera: Record<string, number | string>[];
  seriesEscalera: string[];
  contratosVigentes: number;
  propiedadesConContrato: number;
}

/**
 * El alquiler proyectado para la cuota `i` (0-based).
 *
 * Es un escalon, no interes compuesto mes a mes: con 15% cada 3 meses, las
 * cuotas 1 a 3 valen lo mismo, la 4 salta a inicial x 1,15 y la 7 a x 1,15².
 *
 * Es solo una proyeccion. Cualquier mes puede llevar un importe cargado a mano
 * que le gana a esto (tabla `alquileres`), asi que un contrato atado a un
 * indice o con montos negociados mes a mes no queda afuera.
 */
export function alquilerDeCuota(c: Contrato, i: number): number {
  if (c.ajuste_tipo === "ninguno") return redondear(c.alquiler_inicial);
  const cada = Math.max(1, Math.round(c.aumento_meses) || 1);
  const escalones = Math.floor(i / cada);
  return redondear(c.alquiler_inicial * (1 + c.aumento_pct / 100) ** escalones);
}

function gastosDelPeriodo(
  gastos: Gasto[],
  periodo: string,
  propiedadId: string,
  prorrateoPct: number
): ParteGasto[] {
  const porTipo = new Map<TipoGasto, { total: number; parte: number }>();
  for (const g of gastos) {
    if (g.deleted_at) continue;
    if (g.periodo !== periodo) continue;
    // Una boleta sin propiedad cubre todo (un medidor de agua para las dos
    // unidades, que es tu caso). Con propiedad, solo afecta a esa.
    if (g.propiedad_id && g.propiedad_id !== propiedadId) continue;
    const acc = porTipo.get(g.tipo) ?? { total: 0, parte: 0 };
    acc.total = redondear(acc.total + g.monto);
    acc.parte = redondear(acc.parte + g.monto * (prorrateoPct / 100));
    porTipo.set(g.tipo, acc);
  }
  return [...porTipo.entries()].map(([tipo, v]) => ({ tipo, total: v.total, parte: v.parte }));
}

export function calcularContrato(
  contrato: Contrato,
  propiedad: Propiedad | null,
  cobros: Cobro[],
  gastos: Gasto[],
  alquileres: Alquiler[] = [],
  hoy = hoyISO()
): ContratoCalculado {
  const pActual = hoy.slice(0, 7);
  const inicio = (contrato.fecha_inicio || `${pActual}-01`).slice(0, 7);
  const meses = Math.max(1, Math.round(contrato.meses) || 1);

  const mios = cobros.filter((c) => !c.deleted_at && c.contrato_id === contrato.id);

  // Importes fijados a mano: le ganan a la proyeccion, periodo por periodo.
  const fijados = new Map<string, number>();
  for (const a of alquileres) {
    if (a.deleted_at || a.contrato_id !== contrato.id) continue;
    fijados.set(a.periodo, a.monto);
  }

  const cuotas: Cuota[] = [];
  for (let i = 0; i < meses; i++) {
    const periodo = sumarMeses(inicio, i);
    const vence = vencimientoDe(periodo, contrato.dia_vencimiento);

    const aMano = fijados.get(periodo);
    const fijado = aMano !== undefined;
    const bruto = fijado ? redondear(aMano) : alquilerDeCuota(contrato, i);
    const comision = redondear(bruto * (contrato.comision_pct / 100));
    const neto = redondear(bruto - comision);

    const partes = gastosDelPeriodo(gastos, periodo, contrato.propiedad_id, contrato.prorrateo_pct);
    const reintegro = redondear(partes.reduce((a, p) => a + p.parte, 0));
    const subtotal = redondear(neto + reintegro);

    const delPeriodo = mios
      .filter((c) => c.periodo === periodo)
      .sort((a, b) => String(a.fecha_cobro).localeCompare(String(b.fecha_cobro)));
    const cobrado = redondear(delPeriodo.reduce((a, c) => a + (Number(c.importe) || 0), 0));
    const fechaCobro = delPeriodo.length ? delPeriodo[delPeriodo.length - 1].fecha_cobro : "";

    // Si ya cobraste, la mora la fija el dia en que entro la plata. Si todavia
    // no cobraste y el vencimiento paso, corre hasta hoy.
    let diasMora = 0;
    let moraEstimada = false;
    if (fechaCobro) {
      diasMora = Math.max(0, diasEntre(vence, fechaCobro));
    } else if (hoy > vence) {
      diasMora = Math.max(0, diasEntre(vence, hoy));
      moraEstimada = true;
    }
    const recargo = redondear(bruto * (contrato.mora_pct_diario / 100) * diasMora);
    const esperado = redondear(subtotal + recargo);

    let estado: EstadoCuota;
    if (cobrado > 0 && cobrado >= esperado - TOLERANCIA) estado = "cobrado";
    else if (cobrado > 0) estado = "parcial";
    else if (periodo > pActual) estado = "futuro";
    else if (hoy > vence) estado = "vencido";
    else estado = "pendiente";

    cuotas.push({
      n: i + 1, periodo, vence, bruto, fijado, comision, neto, partes, reintegro, subtotal,
      diasMora, recargo, moraEstimada, esperado, cobrado, fechaCobro,
      diferencia: redondear(cobrado - esperado), estado, cobros: delPeriodo,
    });
  }

  const acum = (f: (c: Cuota) => number) => redondear(cuotas.reduce((a, c) => a + f(c), 0));
  const fin = cuotas.length ? cuotas[cuotas.length - 1].periodo : inicio;

  return {
    contrato,
    propiedad,
    cuotas,
    inicio,
    fin,
    estado: pActual < inicio ? "por_empezar" : pActual > fin ? "terminado" : "vigente",
    vigente: pActual >= inicio && pActual <= fin,
    proxima: cuotas.find((c) => c.estado !== "cobrado" && c.estado !== "futuro") ?? null,
    totales: {
      bruto: acum((c) => c.bruto),
      comision: acum((c) => c.comision),
      neto: acum((c) => c.neto),
      reintegro: acum((c) => c.reintegro),
      recargo: acum((c) => c.recargo),
      esperado: acum((c) => c.esperado),
      cobrado: acum((c) => c.cobrado),
      deuda: redondear(
        cuotas
          .filter((c) => c.estado === "vencido" || c.estado === "parcial")
          .reduce((a, c) => a + (c.esperado - c.cobrado), 0)
      ),
    },
  };
}

export function calcular(
  propiedades: Propiedad[],
  contratos: Contrato[],
  cobros: Cobro[],
  gastos: Gasto[],
  alquileres: Alquiler[] = [],
  config: Config = {},
  hoy = hoyISO()
): { contratos: ContratoCalculado[]; resumen: Resumen } {
  void config;
  const vivas = propiedades.filter((p) => !p.deleted_at);
  const porId = new Map(vivas.map((p) => [p.id, p]));
  const calculados = contratos
    .filter((c) => !c.deleted_at)
    .map((c) => calcularContrato(c, porId.get(c.propiedad_id) ?? null, cobros, gastos, alquileres, hoy))
    .sort((a, b) => String(a.contrato.fecha_inicio).localeCompare(String(b.contrato.fecha_inicio)));

  const pActual = hoy.slice(0, 7);
  const anio = hoy.slice(0, 4);

  // Consolidado mes a mes: es la hoja RESUMEN de la planilla, pero sola.
  const mapa = new Map<string, FilaPeriodo>();
  for (const cc of calculados) {
    for (const q of cc.cuotas) {
      const f = mapa.get(q.periodo) ?? {
        periodo: q.periodo, bruto: 0, comision: 0, neto: 0, reintegro: 0,
        recargo: 0, esperado: 0, cobrado: 0, diferencia: 0,
      };
      f.bruto = redondear(f.bruto + q.bruto);
      f.comision = redondear(f.comision + q.comision);
      f.neto = redondear(f.neto + q.neto);
      f.reintegro = redondear(f.reintegro + q.reintegro);
      f.recargo = redondear(f.recargo + q.recargo);
      f.esperado = redondear(f.esperado + q.esperado);
      f.cobrado = redondear(f.cobrado + q.cobrado);
      f.diferencia = redondear(f.cobrado - f.esperado);
      mapa.set(q.periodo, f);
    }
  }
  const porPeriodo = [...mapa.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));

  const todas = calculados.flatMap((c) => c.cuotas);
  const delMes = todas.filter((q) => q.periodo === pActual);
  const delAnio = todas.filter((q) => q.periodo.startsWith(anio));

  const netoAnio = redondear(delAnio.reduce((a, q) => a + q.neto, 0));
  const cobradoAnio = redondear(delAnio.reduce((a, q) => a + q.cobrado, 0));

  // La escalera de aumentos: una serie por contrato, para el grafico.
  const nombreSerie = (cc: ContratoCalculado) =>
    cc.propiedad?.nombre || cc.contrato.inquilino || "Contrato";
  const seriesEscalera = [...new Set(calculados.map(nombreSerie))];
  const periodos = [...new Set(calculados.flatMap((c) => c.cuotas.map((q) => q.periodo)))].sort();
  const escalera = periodos.map((periodo) => {
    const fila: Record<string, number | string> = { periodo };
    for (const cc of calculados) {
      const q = cc.cuotas.find((x) => x.periodo === periodo);
      if (q) fila[nombreSerie(cc)] = q.bruto;
    }
    return fila;
  });

  const proximos = calculados
    .flatMap((cc) =>
      cc.cuotas
        .filter((q) => q.estado === "vencido" || q.estado === "pendiente" || q.estado === "parcial")
        .map((cuota) => ({ cuota, contrato: cc.contrato, propiedad: cc.propiedad }))
    )
    .sort((a, b) => a.cuota.vence.localeCompare(b.cuota.vence))
    .slice(0, 6);

  return {
    contratos: calculados,
    resumen: {
      periodoActual: pActual,
      mes: {
        esperado: redondear(delMes.reduce((a, q) => a + q.esperado, 0)),
        cobrado: redondear(delMes.reduce((a, q) => a + q.cobrado, 0)),
        falta: redondear(delMes.reduce((a, q) => a + Math.max(0, q.esperado - q.cobrado), 0)),
        cuotas: delMes.length,
        cobradas: delMes.filter((q) => q.estado === "cobrado").length,
      },
      deudaVencida: redondear(calculados.reduce((a, c) => a + c.totales.deuda, 0)),
      anio: {
        bruto: redondear(delAnio.reduce((a, q) => a + q.bruto, 0)),
        comision: redondear(delAnio.reduce((a, q) => a + q.comision, 0)),
        neto: netoAnio,
        cobrado: cobradoAnio,
      },
      historico: {
        esperado: redondear(todas.reduce((a, q) => a + q.esperado, 0)),
        cobrado: redondear(todas.reduce((a, q) => a + q.cobrado, 0)),
        comision: redondear(todas.reduce((a, q) => a + q.comision, 0)),
      },
      porPeriodo,
      proximos,
      escalera,
      seriesEscalera,
      contratosVigentes: calculados.filter((c) => c.vigente).length,
      propiedadesConContrato: new Set(
        calculados.filter((c) => c.vigente).map((c) => c.contrato.propiedad_id)
      ).size,
    },
  };
}
