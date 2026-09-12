export type Rol = "editor" | "lectura";

export type TipoPropiedad = "casa" | "local" | "departamento" | "cochera" | "otro";

/**
 * Como se mueve el alquiler a lo largo del contrato.
 *
 * `porcentaje` es una proyeccion: sirve para ver el año entero de una. Pero
 * cualquier mes se puede fijar a mano (ver `Alquiler`), asi que un contrato
 * atado al ICL, uno con montos negociados uno por uno o uno que no aumenta
 * entran todos sin tocar codigo.
 */
export type AjusteTipo = "porcentaje" | "ninguno";

/** Los dos que se reparten entre inquilinos + una categoria libre. */
export type TipoGasto =
  | "agua"
  | "inmobiliario"
  | "expensas"
  | "luz"
  | "gas"
  | "abl"
  | "mantenimiento"
  | "reparacion"
  | "seguro"
  | "otro";

export interface Propiedad {
  id: string;
  nombre: string;
  direccion: string;
  tipo: TipoPropiedad;
  nota: string;
  orden: number;
  created_at: string;
  deleted_at: string;
}

/**
 * Las condiciones viven en el contrato, no en la app.
 *
 * Hoy tus contratos aumentan 15% cada 3 meses y la inmobiliaria se lleva 7%,
 * pero eso es lo que pactaste esta vez. El contrato que firmes el año que viene
 * guarda sus propios numeros y los meses ya calculados no se mueven.
 */
export interface Contrato {
  id: string;
  propiedad_id: string;
  inquilino: string;
  telefono: string;
  email: string;
  fecha_inicio: string;      // YYYY-MM-DD
  meses: number;             // duracion total
  ajuste_tipo: AjusteTipo;
  alquiler_inicial: number;
  aumento_pct: number;       // 15 = 15%
  aumento_meses: number;     // cada cuantos meses se aplica
  comision_pct: number;      // 7 = 7% que retiene la inmobiliaria
  mora_pct_diario: number;   // 2 = 2% del bruto por dia de atraso
  dia_vencimiento: number;   // 10 = vence el 10 de cada mes
  prorrateo_pct: number;     // 50 = paga la mitad del agua y del impuesto
  deposito: number;
  nota: string;
  created_at: string;
  deleted_at: string;
}

/**
 * Un alquiler fijado a mano para un periodo puntual.
 *
 * Le gana siempre a lo proyectado. Es la valvula de escape del sistema: si el
 * aumento no salio como estaba pactado, si lo ajustaste por indice o si
 * arreglaron otro numero, se carga el importe real y la proyeccion se acomoda
 * de ahi en adelante sin romper el historial.
 */
export interface Alquiler {
  id: string;
  contrato_id: string;
  periodo: string;           // YYYY-MM
  monto: number;
  nota: string;
  created_at: string;
  deleted_at: string;
}

export interface Cobro {
  id: string;
  contrato_id: string;
  periodo: string;           // YYYY-MM al que se imputa
  fecha_cobro: string;       // YYYY-MM-DD en que entro la plata
  importe: number;
  nota: string;
  created_at: string;
  deleted_at: string;
}

/**
 * Una boleta o un gasto.
 *
 * `reparte` marca la diferencia: el agua y el impuesto los pagas vos y te los
 * reintegran los inquilinos (reparte = true, se carga el total una sola vez y
 * cada contrato se lleva su prorrateo). Un arreglo de plomeria lo pagas vos y
 * nadie te lo devuelve (reparte = false): no entra en lo que cobras, sale de tu
 * rentabilidad.
 */
export interface Gasto {
  id: string;
  tipo: TipoGasto;
  periodo: string;           // YYYY-MM
  fecha: string;             // YYYY-MM-DD en que lo pagaste
  propiedad_id: string;      // vacio = la boleta cubre todas las propiedades
  monto: number;
  reparte: boolean;
  nota: string;
  created_at: string;
  deleted_at: string;
}

export type Config = Record<string, string>;

export interface CondicionesDefault {
  aumento_pct: number;
  aumento_meses: number;
  meses: number;
  comision_pct: number;
  mora_pct_diario: number;
  dia_vencimiento: number;
  prorrateo_pct: number;
}
