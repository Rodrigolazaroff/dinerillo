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

/**
 * Las claves de `ajustes` que la app conoce. Cualquiera se puede crear una
 * cuenta: sin lista blanca, el endpoint guardaría lo que le manden.
 */
export const CLAVES_AJUSTES = [
  "nombre", "onboarding", "recorrido", "ahorro_pct", "divide", "pareja_nombre", "div_mi_pct", "alquileres",
  "def_aumento_pct", "def_aumento_meses", "def_meses", "def_comision_pct",
  "def_mora_pct_diario", "def_dia_vencimiento", "def_prorrateo_pct",
] as const;

export const configSchema = z.partialRecord(
  z.enum(CLAVES_AJUSTES, { error: "Ese ajuste no existe" }),
  z.string().trim().max(120, "Muy largo")
);

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

// ═══════════════════════════════════════════════════════════════════
// Ingresos, gastos y división
// ═══════════════════════════════════════════════════════════════════

/** Las monedas que ofrece el formulario. La base acepta cualquier código ISO. */
export const MONEDAS = ["ARS", "USD", "EUR", "BRL", "BGN"] as const;

const moneda = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "La moneda va como código de tres letras, por ejemplo USD");

const emoji = z.string().trim().regex(/^[a-z0-9-]{0,30}$/, "Emoji inválido").default("");

export const ingresoSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre al ingreso").max(60),
  emoji,
  moneda: moneda.default("ARS"),
  nota: z.string().trim().max(500).default(""),
  orden: numero("Orden", 0, 999).default(0),
  // Archivar es esconder sin borrar: el historial sigue contando.
  archivado_at: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
});

export const ingresoCobroSchema = z.object({
  ingreso_id: z.string().trim().min(1, "Elegí el ingreso"),
  fecha: fecha,
  periodo,
  monto: numero("Importe", 0.01),
  tipo_cambio: numero("Tipo de cambio", 0.0001).default(1),
  nota: z.string().trim().max(500).default(""),
});

export const gastoFijoSchema = z.object({
  descripcion: z.string().trim().min(1, "Contá qué es").max(80),
  monto: numero("Importe", 0.01),
  categoria_id: z.string().trim().default(""),
  dia: numero("Día", 1, 31).default(1),
  compartido: z.boolean().default(false),
  pago: z.enum(["yo", "pareja"]).default("yo"),
  mi_pct: numero("Tu parte", 0, 100).default(50),
  automatico: z.boolean().default(true),
});

export const ahorroSchema = z.object({
  fecha: fecha,
  periodo,
  monto: numero("Importe", 0.01),
  moneda: moneda.default("ARS"),
  tipo_cambio: numero("Tipo de cambio", 0.0001).default(1),
  nota: z.string().trim().max(200).default(""),
});

export const categoriaSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre a la categoría").max(40),
  color: numero("Color", 1, 8).default(1),
  emoji,
  orden: numero("Orden", 0, 999).default(0),
});

export const miGastoSchema = z.object({
  fecha: fecha,
  periodo,
  descripcion: z.string().trim().min(1, "Contá en qué fue el gasto").max(80),
  monto: numero("Importe", 0.01),
  categoria_id: z.string().trim().default(""),
  nota: z.string().trim().max(500).default(""),
  fijo_id: z.string().trim().max(40).default(""),
});

export const divGastoSchema = miGastoSchema.extend({
  pago: z.enum(["yo", "pareja"]).default("yo"),
  mi_pct: numero("Tu parte", 0, 100).default(50),
});

export const divCierreSchema = z.object({
  periodo,
  monto: numero("Importe", 0),
  fecha: fecha,
  nota: z.string().trim().max(500).default(""),
});

export type IngresoInput = z.infer<typeof ingresoSchema>;
export type IngresoCobroInput = z.infer<typeof ingresoCobroSchema>;
export type CategoriaInput = z.infer<typeof categoriaSchema>;
export type MiGastoInput = z.infer<typeof miGastoSchema>;
export type DivGastoInput = z.infer<typeof divGastoSchema>;
