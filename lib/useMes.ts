"use client";

import { useSyncExternalStore } from "react";
import { periodoActual } from "./format";

// El mes que estás mirando, compartido entre Inicio, Ingresos, Gastos y
// División: si vas a octubre en una pantalla, las otras también están en
// octubre. Dura lo que la pestaña (sessionStorage); al volver mañana arranca
// en el mes en curso.
//
// Un link puede traer ?mes=2026-09 (los avisos lo usan): ese manda.

const CLAVE = "dinerillo:mes";
const oyentes = new Set<() => void>();
let enMemoria: string | null = null;

function leer(): string {
  if (enMemoria) return enMemoria;
  let mes = "";
  try {
    const url = new URLSearchParams(window.location.search).get("mes") ?? "";
    mes = /^\d{4}-\d{2}$/.test(url) ? url : sessionStorage.getItem(CLAVE) ?? "";
  } catch {
    // sin almacenamiento: el mes en curso
  }
  enMemoria = /^\d{4}-\d{2}$/.test(mes) ? mes : periodoActual();
  return enMemoria;
}

export function useMes(): [string, (p: string) => void] {
  const mes = useSyncExternalStore(
    (fn) => {
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },
    leer,
    periodoActual
  );
  const cambiar = (p: string) => {
    enMemoria = p;
    try {
      sessionStorage.setItem(CLAVE, p);
    } catch {
      // igual queda en memoria
    }
    oyentes.forEach((f) => f());
  };
  return [mes, cambiar];
}

/**
 * Lee un parámetro de un solo uso de la URL (?nuevo=1, ?cobro=1) y lo saca,
 * así recargar la página no vuelve a abrir el formulario.
 */
// React en desarrollo corre dos veces el inicializador de useState: la
// segunda lectura tiene que dar lo mismo aunque la URL ya esté limpia.
let ultimo: { clave: string; cuando: number } | null = null;

export function usarParametro(nombre: string, valor = "1"): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  const clave = `${url.pathname}:${nombre}`;
  if (url.searchParams.get(nombre) !== valor) {
    return ultimo?.clave === clave && Date.now() - ultimo.cuando < 1000;
  }
  url.searchParams.delete(nombre);
  window.history.replaceState(null, "", url.pathname + url.search);
  ultimo = { clave, cuando: Date.now() };
  return true;
}

/** Como `usarParametro`, pero devuelve el valor (?fijo=ID): "" si no vino. */
let ultimoValor: { clave: string; valor: string; cuando: number } | null = null;

export function leerParametro(nombre: string): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  const clave = `${url.pathname}:${nombre}`;
  const valor = url.searchParams.get(nombre) ?? "";
  if (!valor) {
    return ultimoValor?.clave === clave && Date.now() - ultimoValor.cuando < 1000 ? ultimoValor.valor : "";
  }
  url.searchParams.delete(nombre);
  window.history.replaceState(null, "", url.pathname + url.search);
  ultimoValor = { clave, valor, cuando: Date.now() };
  return valor;
}
