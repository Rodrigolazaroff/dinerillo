import { z } from "zod";

// El formulario manda strings; aca se validan y se convierten a numero una sola
// vez. Si algo no cierra, el error sale en castellano y listo para mostrar.

/**
 * Convierte lo que venga del formulario a número con criterio argentino.
 *
 * `z.coerce.number()` no sirve acá: `Number("600.000")` da **600**, así que un
 * alquiler de seiscientos mil se guardaría como seiscientos pesos. Con coma
 * manda el formato es-AR (punto = miles, coma = decimal), y sin coma un patrón
 * de grupos de tres dígitos también es separador de miles.
 */
export function aNumero(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim().replace(/\s/g, "");
  if (!s) return NaN;
  const limpio = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : /^-?\d{1,3}(\.\d{3})+$/.test(s)
      ? s.replace(/\./g, "")
      : s;
  const n = Number(limpio.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

const numero = (nombre: string, min = 0, max = 1e12) =>
  z.preprocess(
    aNumero,
    z
      .number({ error: `${nombre}: poné un número` })
      .min(min, `${nombre}: no puede ser menor a ${min}`)
      .max(max, `${nombre}: número demasiado grande`)
  );

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha tiene que ser una fecha válida");

const periodo = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "El período va en formato mes/año");

export const TIPOS_PROPIEDAD = ["casa", "local", "departamento", "cochera", "otro"] as const;

/** Boletas que se reparten entre los inquilinos. Los gastos que nadie reintegra no se cargan. */
export const TIPOS_GASTO = ["agua", "inmobiliario", "expensas", "luz", "gas", "abl", "otro"] as const;

/** Los que por defecto se reparten entre los inquilinos. */
export const GASTOS_QUE_SE_REPARTEN = ["agua", "inmobiliario", "expensas", "abl"] as const;

export const propiedadSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre a la propiedad").max(60),
  direccion: z.string().trim().max(160).default(""),
  tipo: z.enum(TIPOS_PROPIEDAD).default("casa"),
  nota: z.string().trim().max(500).default(""),
  orden: numero("Orden", 0, 999).default(0),
});

export const AJUSTES = ["porcentaje", "ninguno"] as const;

export const contratoSchema = z.object({
  propiedad_id: z.string().trim().min(1, "Elegí la propiedad"),
  inquilino: z.string().trim().min(1, "Falta el nombre del inquilino").max(80),
  telefono: z.string().trim().max(40).default(""),
  email: z.string().trim().max(120).default(""),
  fecha_inicio: fecha,
  meses: numero("Duración", 1, 600),
  ajuste_tipo: z.enum(AJUSTES).default("porcentaje"),
  alquiler_inicial: numero("Alquiler inicial", 0),
  aumento_pct: numero("% de aumento", 0, 1000),
  aumento_meses: numero("Frecuencia del aumento", 1, 120),
  comision_pct: numero("% de comisión", 0, 100),
  mora_pct_diario: numero("% de mora", 0, 100).default(0),
  dia_vencimiento: numero("Día de vencimiento", 1, 31),
  prorrateo_pct: numero("% de servicios", 0, 100).default(0),
  deposito: numero("Depósito", 0).default(0),
  nota: z.string().trim().max(1000).default(""),
});

/** Un alquiler fijado a mano para un período: le gana a la proyección. */
export const alquilerSchema = z.object({
  contrato_id: z.string().trim().min(1, "Elegí el contrato"),
  periodo,
  monto: numero("Importe", 0),
  nota: z.string().trim().max(500).default(""),
});

export const cobroSchema = z.object({
  contrato_id: z.string().trim().min(1, "Elegí el contrato"),
  periodo,
  fecha_cobro: fecha,
  importe: numero("Importe", 0),
  nota: z.string().trim().max(500).default(""),
});

export const gastoSchema = z.object({
  tipo: z.enum(TIPOS_GASTO),
  periodo,
  fecha: z.union([fecha, z.literal("")]).default(""),
  propiedad_id: z.string().trim().default(""),
  monto: numero("Importe", 0),
  nota: z.string().trim().max(500).default(""),
});

export const configSchema = z.record(z.string(), z.string());

export type PropiedadInput = z.infer<typeof propiedadSchema>;
export type ContratoInput = z.infer<typeof contratoSchema>;
export type AlquilerInput = z.infer<typeof alquilerSchema>;
export type CobroInput = z.infer<typeof cobroSchema>;
export type GastoInput = z.infer<typeof gastoSchema>;

/**
 * Con qué valores viene precargado el formulario de contrato nuevo.
 *
 * No es una regla del sistema: es el punto de partida del formulario. Cada
 * contrato guarda sus propias condiciones, y cambiar esto no toca ninguno de
 * los ya cargados.
 */
export const CONDICIONES_FABRICA = {
  aumento_pct: 15,
  aumento_meses: 3,
  meses: 12,
  comision_pct: 7,
  mora_pct_diario: 2,
  dia_vencimiento: 10,
  prorrateo_pct: 50,
} as const;

/** Primer mensaje de error, que es el unico que se muestra. */
export function primerError(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Revisá los datos";
}
