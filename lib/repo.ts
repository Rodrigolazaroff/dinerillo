import type {
  Alquiler, Categoria, Cobro, CondicionesDefault, Config, Contrato, DivCierre, DivGasto, Gasto,
  Ingreso, IngresoCobro, MiGasto, Propiedad,
} from "./types";
import { CONDICIONES_FABRICA } from "./schemas";
import { supabaseServer } from "./supabase/server";

// Las tablas viven en Supabase con tipos de verdad (numeric, date). Aca se
// pasan a la forma que espera el resto de la app, que es la misma que tenia
// con la Sheet: asi lib/calc.ts y las pantallas no se enteran del cambio.

/** Que tabla de la base corresponde a cada recurso de la API. */
export const TABLAS = {
  propiedades: "alq_propiedades",
  contratos: "alq_contratos",
  alquileres: "alq_fijados",
  cobros: "alq_cobros",
  boletas: "alq_boletas",
  ingresos: "ingresos",
  ingresoCobros: "ingreso_cobros",
  categorias: "categorias",
  misGastos: "gastos",
  divGastos: "div_gastos",
  divCierres: "div_cierres",
} as const;

export type Tabla = (typeof TABLAS)[keyof typeof TABLAS];

type Fila = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const txt = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

function base(f: Fila) {
  return { id: txt(f.id), created_at: txt(f.created_at), deleted_at: txt(f.deleted_at) };
}

const unProp = (f: Fila): Propiedad => ({
  ...base(f),
  nombre: txt(f.nombre),
  direccion: txt(f.direccion),
  tipo: txt(f.tipo) as Propiedad["tipo"],
  nota: txt(f.nota),
  orden: num(f.orden),
});

const unContrato = (f: Fila): Contrato => ({
  ...base(f),
  propiedad_id: txt(f.propiedad_id),
  inquilino: txt(f.inquilino),
  telefono: txt(f.telefono),
  email: txt(f.email),
  fecha_inicio: txt(f.fecha_inicio),
  meses: num(f.meses),
  ajuste_tipo: txt(f.ajuste_tipo) as Contrato["ajuste_tipo"],
  alquiler_inicial: num(f.alquiler_inicial),
  aumento_pct: num(f.aumento_pct),
  aumento_meses: num(f.aumento_meses),
  comision_pct: num(f.comision_pct),
  mora_pct_diario: num(f.mora_pct_diario),
  dia_vencimiento: num(f.dia_vencimiento),
  prorrateo_pct: num(f.prorrateo_pct),
  deposito: num(f.deposito),
  nota: txt(f.nota),
});

const unAlquiler = (f: Fila): Alquiler => ({
  ...base(f),
  contrato_id: txt(f.contrato_id),
  periodo: txt(f.periodo),
  monto: num(f.monto),
  nota: txt(f.nota),
});

const unCobro = (f: Fila): Cobro => ({
  ...base(f),
  contrato_id: txt(f.contrato_id),
  periodo: txt(f.periodo),
  fecha_cobro: txt(f.fecha_cobro),
  importe: num(f.importe),
  nota: txt(f.nota),
});

/** Toda boleta de la tabla se reparte: los gastos que nadie reintegra no se cargan. */
const unGasto = (f: Fila): Gasto => ({
  ...base(f),
  tipo: txt(f.tipo) as Gasto["tipo"],
  periodo: txt(f.periodo),
  fecha: txt(f.fecha),
  propiedad_id: txt(f.propiedad_id),
  monto: num(f.monto),
  nota: txt(f.nota),
});

const unIngreso = (f: Fila): Ingreso => ({
  ...base(f),
  nombre: txt(f.nombre),
  moneda: txt(f.moneda) || "ARS",
  nota: txt(f.nota),
  orden: num(f.orden),
  archivado_at: txt(f.archivado_at),
});

const unIngresoCobro = (f: Fila): IngresoCobro => ({
  ...base(f),
  ingreso_id: txt(f.ingreso_id),
  fecha: txt(f.fecha),
  periodo: txt(f.periodo),
  monto: num(f.monto),
  tipo_cambio: num(f.tipo_cambio) || 1,
  nota: txt(f.nota),
});

const unCategoria = (f: Fila): Categoria => ({
  ...base(f),
  nombre: txt(f.nombre),
  color: num(f.color) || 1,
  orden: num(f.orden),
});

const unMiGasto = (f: Fila): MiGasto => ({
  ...base(f),
  fecha: txt(f.fecha),
  periodo: txt(f.periodo),
  descripcion: txt(f.descripcion),
  monto: num(f.monto),
  categoria_id: txt(f.categoria_id),
  nota: txt(f.nota),
});

const unDivGasto = (f: Fila): DivGasto => ({
  ...unMiGasto(f),
  pago: txt(f.pago) === "pareja" ? "pareja" : "yo",
  mi_pct: num(f.mi_pct),
});

const unDivCierre = (f: Fila): DivCierre => ({
  ...base(f),
  periodo: txt(f.periodo),
  monto: num(f.monto),
  fecha: txt(f.fecha),
  nota: txt(f.nota),
});

export interface Datos {
  propiedades: Propiedad[];
  contratos: Contrato[];
  alquileres: Alquiler[];
  cobros: Cobro[];
  gastos: Gasto[];
  config: Config;
  ingresos: Ingreso[];
  ingresoCobros: IngresoCobro[];
  categorias: Categoria[];
  misGastos: MiGasto[];
  divGastos: DivGasto[];
  divCierres: DivCierre[];
}

export async function leerTodo(): Promise<Datos> {
  const supabase = await supabaseServer();
  const leer = async (tabla: string) => {
    const { data, error } = await supabase.from(tabla).select("*");
    if (error) throw new Error(`No pude leer ${tabla}: ${error.message}`);
    return (data ?? []) as Fila[];
  };

  const [
    props, contratos, fijados, cobros, boletas, ajustes,
    ingresos, ingresoCobros, categorias, misGastos, divGastos, divCierres,
  ] = await Promise.all([
    leer(TABLAS.propiedades), leer(TABLAS.contratos), leer(TABLAS.alquileres),
    leer(TABLAS.cobros), leer(TABLAS.boletas), leer("ajustes"),
    leer(TABLAS.ingresos), leer(TABLAS.ingresoCobros), leer(TABLAS.categorias),
    leer(TABLAS.misGastos), leer(TABLAS.divGastos), leer(TABLAS.divCierres),
  ]);
  const porOrden = <T extends { orden: number; nombre: string }>(a: T, b: T) =>
    a.orden - b.orden || a.nombre.localeCompare(b.nombre);

  const config: Config = {};
  for (const f of ajustes) config[txt(f.clave)] = txt(f.valor);

  return {
    propiedades: props.map(unProp)
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)),
    contratos: contratos.map(unContrato),
    alquileres: fijados.map(unAlquiler),
    cobros: cobros.map(unCobro),
    gastos: boletas.map(unGasto),
    config,
    ingresos: ingresos.map(unIngreso).sort(porOrden),
    ingresoCobros: ingresoCobros.map(unIngresoCobro),
    categorias: categorias.map(unCategoria).sort(porOrden),
    misGastos: misGastos.map(unMiGasto),
    divGastos: divGastos.map(unDivGasto),
    divCierres: divCierres.map(unDivCierre),
  };
}

export { CONDICIONES_FABRICA };

export function condicionesDefault(config: Config): CondicionesDefault {
  const leer = (k: keyof CondicionesDefault) => {
    const v = config[`def_${k}`];
    return v === undefined || v === "" ? CONDICIONES_FABRICA[k] : num(v);
  };
  return {
    aumento_pct: leer("aumento_pct"),
    aumento_meses: leer("aumento_meses") || 1,
    meses: leer("meses") || 12,
    comision_pct: leer("comision_pct"),
    mora_pct_diario: leer("mora_pct_diario"),
    dia_vencimiento: leer("dia_vencimiento") || 10,
    prorrateo_pct: leer("prorrateo_pct"),
  };
}
