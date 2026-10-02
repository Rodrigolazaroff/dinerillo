"use client";

import useSWR from "swr";
import type { ContratoCalculado, Resumen } from "./calc";
import type {
  Alquiler, Cobro, CondicionesDefault, Config, Contrato, Gasto, Propiedad, Rol,
} from "./types";

export interface DataResponse {
  propiedades: Propiedad[];
  contratos: Contrato[];
  alquileres: Alquiler[];
  cobros: Cobro[];
  gastos: Gasto[];
  config: Config;
  condiciones: CondicionesDefault;
  calculados: ContratoCalculado[];
  resumen: Resumen;
  sesion: { usuario: string; rol: Rol };
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
