"use client";

import useSWR from "swr";
import type { ContratoCalculado, Resumen } from "./calc";
import type {
  Alquiler, Categoria, Cobro, CondicionesDefault, Config, Contrato, DivCierre, DivGasto, Gasto,
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

export type Resultado = { ok: true } | { ok: false; error: string };

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
    return { ok: true };
  } catch {
    return { ok: false, error: "No hay conexión. Probá de nuevo." };
  }
}
