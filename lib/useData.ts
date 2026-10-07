"use client";

import useSWR, { mutate } from "swr";
import type { ContratoCalculado, Resumen } from "./calc";
import type {
  Ahorro, Alquiler, GastoFijo, Categoria, Cobro, CondicionesDefault, Config, Contrato, DivCierre, DivGasto, Gasto,
  Ingreso, IngresoCobro, MiGasto, Propiedad, Rol,
} from "./types";

export interface DataResponse {
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
  ahorros: Ahorro[];
  gastosFijos: GastoFijo[];
  /** Si la cuenta es de un administrador: ve el panel de /admin. */
  admin?: boolean;
  condiciones: CondicionesDefault;
  calculados: ContratoCalculado[];
  resumen: Resumen;
  sesion: { usuario: string; email: string; avatar: string; proveedor: string; rol: Rol };
  hoy: string;
}

async function fetcher(url: string): Promise<DataResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      // Recarga completa a proposito: si la sesion vencio conviene tirar todo el
      // estado del cliente, no navegar por dentro conservandolo.
      window.location.href = "/login";
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "No pude leer los datos");
  }
  return res.json();
}

export function useData() {
  const { data, error, isLoading, mutate } = useSWR<DataResponse>("/api/data", fetcher, {
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  return {
    data,
    error: error as Error | undefined,
    cargando: isLoading,
    recargar: mutate,
    puedeEditar: data?.sesion.rol === "editor",
  };
}

/** Cómo saludar: el nombre que eligió en Bienvenida, o el de la cuenta. */
export function nombreVisible(d: DataResponse): string {
  return (d.config?.nombre ?? "").trim() || d.sesion.usuario;
}

/** Si ya usó la app antes de que existiera la Bienvenida. */
export function tieneDatos(d: DataResponse): boolean {
  return (
    [d.ingresos, d.misGastos, d.divGastos, d.contratos, d.categorias].some((xs) => (xs ?? []).length > 0) ||
    Boolean(d.config?.ahorro_pct || d.config?.pareja_nombre)
  );
}

/** Alquileres se muestra si dijo que tiene o si ya cargó algún contrato. */
export function usaAlquileres(d: DataResponse): boolean {
  return d.config?.alquileres === "si" || (d.contratos ?? []).some((c) => !c.deleted_at);
}

/** División se muestra salvo que haya dicho que no y no tenga nada cargado. */
export function usaDivision(d: DataResponse): boolean {
  return d.config?.divide !== "no" || (d.divGastos ?? []).some((g) => !g.deleted_at);
}

/** La tarjeta de "¿Primera vez?" en Inicio: solo a cuentas nuevas, hasta que la miren o la cierren. */
export function mostrarAyudaInicial(d: DataResponse): boolean {
  return d.config?.onboarding === "1" && !d.config?.ayuda_vista;
}

/** Ya la vio: no se ofrece más. Se ve al instante y se guarda atrás. */
export function marcarAyudaVista() {
  void actualizarLocal((d) => ({ ...d, config: { ...d.config, ayuda_vista: "1" } }));
  return enviar("/api/config", "POST", { ayuda_vista: "1" });
}

export type Resultado ={ ok: true; id?: string } | { ok: false; error: string };

/**
 * Pone un cambio en pantalla ya, sin esperar a la red: el número del mes y la
 * lista se actualizan en el momento y atrás se vuelve a leer todo, por las
 * dudas. La gente no quiere esperar a que un "Cargar" piense.
 */
export function actualizarLocal(cambio: (d: DataResponse) => DataResponse) {
  return mutate<DataResponse>("/api/data", (d) => (d ? cambio(d) : d), { revalidate: true });
}

/** Una fila nueva o editada, en su lista; o marcada como borrada. */
export function conFila<T extends { id: string }>(lista: T[], fila: T): T[] {
  return lista.some((x) => x.id === fila.id) ? lista.map((x) => (x.id === fila.id ? fila : x)) : [...lista, fila];
}
export function sinFila<T extends { id: string; deleted_at: string }>(lista: T[], id: string): T[] {
  const ahora = new Date().toISOString();
  return lista.map((x) => (x.id === id ? { ...x, deleted_at: ahora } : x));
}

/** Escritura: manda, devuelve el error listo para mostrar y nada mas. */
export async function enviar(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<Resultado> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error ?? "Algo salió mal" };
    return { ok: true, id: typeof data?.id === "string" ? data.id : undefined };
  } catch {
    return { ok: false, error: "No hay conexión. Probá de nuevo." };
  }
}
