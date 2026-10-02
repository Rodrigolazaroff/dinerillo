import { batchGet, filasAObjetos, TABS, type TabName } from "./sheets";
import type {
  AjusteTipo, Alquiler, Cobro, CondicionesDefault, Config, Contrato, Gasto, Propiedad,
  TipoGasto, TipoPropiedad,
} from "../../lib/types";
import { CONDICIONES_FABRICA, TIPOS_GASTO, TIPOS_PROPIEDAD } from "../../lib/schemas";

// La planilla devuelve todo como texto. Aca se convierte una sola vez a tipos
// de verdad, asi ninguna pantalla tiene que andar haciendo Number(...) suelto.

const num = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim().replace(/\s/g, "");
  if (!s) return 0;
  // Aceptamos "1.234,56" y "1234.56": si hay coma, manda como decimal.
  const limpio = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(limpio.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const txt = (v: unknown): string => String(v ?? "").trim();

const bool = (v: unknown): boolean => /^(s[ií]|true|verdadero|1|x)$/i.test(txt(v));

/** Los booleanos se guardan como "si"/"no": la planilla se lee mejor a ojo. */
export const guardarBool = (b: boolean) => (b ? "si" : "no");

/** Una fecha de Google puede venir como serial. La normalizamos a YYYY-MM-DD. */
const fechaISO = (v: unknown): string => {
  const s = txt(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Serial de Sheets: dias desde 1899-12-30.
  if (/^\d+(\.\d+)?$/.test(s)) {
    const ms = Date.UTC(1899, 11, 30) + Number(s) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, d, mm, y] = m;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${mm.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
};

const periodoISO = (v: unknown): string => {
  const s = txt(v);
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const iso = fechaISO(s);
  return /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : s;
};

function unProp(o: Record<string, string>): Propiedad {
  const tipo = txt(o.tipo).toLowerCase() as TipoPropiedad;
  return {
    id: txt(o.id),
    nombre: txt(o.nombre),
    direccion: txt(o.direccion),
    tipo: (TIPOS_PROPIEDAD as readonly string[]).includes(tipo) ? tipo : "otro",
    nota: txt(o.nota),
    orden: num(o.orden),
    created_at: txt(o.created_at),
    deleted_at: txt(o.deleted_at),
  };
}

function unContrato(o: Record<string, string>): Contrato {
  return {
    id: txt(o.id),
    propiedad_id: txt(o.propiedad_id),
    inquilino: txt(o.inquilino),
    telefono: txt(o.telefono),
    email: txt(o.email),
    fecha_inicio: fechaISO(o.fecha_inicio),
    meses: num(o.meses) || 12,
    ajuste_tipo: (txt(o.ajuste_tipo).toLowerCase() === "ninguno" ? "ninguno" : "porcentaje") as AjusteTipo,
    alquiler_inicial: num(o.alquiler_inicial),
    aumento_pct: num(o.aumento_pct),
    aumento_meses: num(o.aumento_meses) || 1,
    comision_pct: num(o.comision_pct),
    mora_pct_diario: num(o.mora_pct_diario),
    dia_vencimiento: num(o.dia_vencimiento) || 10,
    prorrateo_pct: num(o.prorrateo_pct),
    deposito: num(o.deposito),
    nota: txt(o.nota),
    created_at: txt(o.created_at),
    deleted_at: txt(o.deleted_at),
  };
}

function unAlquiler(o: Record<string, string>): Alquiler {
  return {
    id: txt(o.id),
    contrato_id: txt(o.contrato_id),
    periodo: periodoISO(o.periodo),
    monto: num(o.monto),
    nota: txt(o.nota),
    created_at: txt(o.created_at),
    deleted_at: txt(o.deleted_at),
  };
}

function unCobro(o: Record<string, string>): Cobro {
  return {
    id: txt(o.id),
    contrato_id: txt(o.contrato_id),
    periodo: periodoISO(o.periodo),
    fecha_cobro: fechaISO(o.fecha_cobro),
    importe: num(o.importe),
    nota: txt(o.nota),
    created_at: txt(o.created_at),
    deleted_at: txt(o.deleted_at),
  };
}

function unGasto(o: Record<string, string>): Gasto {
  const tipo = txt(o.tipo).toLowerCase() as TipoGasto;
  return {
    id: txt(o.id),
    tipo: (TIPOS_GASTO as readonly string[]).includes(tipo) ? tipo : "otro",
    periodo: periodoISO(o.periodo),
    fecha: fechaISO(o.fecha),
    propiedad_id: txt(o.propiedad_id),
    monto: num(o.monto),
    nota: txt(o.nota),
    created_at: txt(o.created_at),
    deleted_at: txt(o.deleted_at),
  };
}

export interface Datos {
  propiedades: Propiedad[];
  contratos: Contrato[];
  alquileres: Alquiler[];
  cobros: Cobro[];
  gastos: Gasto[];
  config: Config;
}

export async function leerTodo(): Promise<Datos> {
  const tabs: TabName[] = [
    TABS.propiedades, TABS.contratos, TABS.alquileres, TABS.cobros, TABS.gastos, TABS.config,
  ];
  const raw = await batchGet(tabs);
  const cfg: Config = {};
  for (const f of filasAObjetos(raw[TABS.config] ?? [])) {
    if (f.clave) cfg[f.clave] = txt(f.valor);
  }
  return {
    propiedades: filasAObjetos(raw[TABS.propiedades] ?? []).map(unProp)
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)),
    contratos: filasAObjetos(raw[TABS.contratos] ?? []).map(unContrato),
    alquileres: filasAObjetos(raw[TABS.alquileres] ?? []).map(unAlquiler),
    cobros: filasAObjetos(raw[TABS.cobros] ?? []).map(unCobro),
    gastos: filasAObjetos(raw[TABS.gastos] ?? []).map(unGasto),
    config: cfg,
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
