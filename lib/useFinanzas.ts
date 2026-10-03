"use client";

import { useMemo } from "react";
import {
  avisos, insights, preferencias, resumenDelMes, serie, type Entradas,
} from "./finanzas";
import { useData } from "./useData";
import { useMes } from "./useMes";

/**
 * Las cuentas del mes elegido, armadas en el cliente con lo que ya vino de
 * /api/data. Cambiar de mes es instantáneo: no hay otro pedido a la red.
 */
export function useFinanzas() {
  const { data, error, cargando, recargar } = useData();
  const [mes, setMes] = useMes();

  const entradas = useMemo<Entradas | null>(
    () =>
      data
        ? {
            ingresos: data.ingresos ?? [],
            ingresoCobros: data.ingresoCobros ?? [],
            categorias: data.categorias ?? [],
            misGastos: data.misGastos ?? [],
            divGastos: data.divGastos ?? [],
            divCierres: data.divCierres ?? [],
            ahorros: data.ahorros ?? [],
            calculados: data.calculados ?? [],
            config: data.config ?? {},
          }
        : null,
    [data]
  );

  const resumen = useMemo(() => (entradas ? resumenDelMes(entradas, mes) : null), [entradas, mes]);
  const anterior = useMemo(() => {
    if (!entradas) return null;
    const [y, m] = mes.split("-").map(Number);
    const p = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    return resumenDelMes(entradas, p);
  }, [entradas, mes]);
  const hoy = data?.hoy ?? "";

  return {
    data,
    error,
    cargando,
    recargar,
    mes,
    setMes,
    entradas,
    resumen,
    anterior,
    prefs: preferencias(data?.config ?? {}),
    avisos: useMemo(() => (entradas && hoy ? avisos(entradas, mes, hoy) : []), [entradas, mes, hoy]),
    insights: useMemo(() => (entradas && hoy ? insights(entradas, mes, hoy) : []), [entradas, mes, hoy]),
    serie: useMemo(() => (entradas ? serie(entradas, mes, 12) : []), [entradas, mes]),
  };
}
