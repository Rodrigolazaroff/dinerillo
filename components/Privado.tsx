"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconoOjo } from "@/components/iconos";
import { plata, plataCorta } from "@/lib/format";

// El ojito: esconde los montos para abrir la app en el colectivo o en una
// reunión. Vale para toda la app y se recuerda en este dispositivo.

const CLAVE = "dinerillo:privado";
const oyentes = new Set<() => void>();

function leer(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

function suscribir(fn: () => void) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

export function usePrivado(): [boolean, () => void] {
  const oculto = useSyncExternalStore(suscribir, leer, () => false);
  const alternar = () => {
    try {
      localStorage.setItem(CLAVE, oculto ? "0" : "1");
    } catch {
      // Sin almacenamiento (modo privado del navegador): igual no rompe.
    }
    oyentes.forEach((f) => f());
  };
  return [oculto, alternar];
}

/** Un monto que respeta el ojito. */
export function Monto({
  valor,
  corto = false,
  animado = false,
}: {
  valor: number;
  corto?: boolean;
  /** Cuenta desde el valor anterior: para el número grande de cada pantalla. */
  animado?: boolean;
}) {
  const [oculto] = usePrivado();
  const mostrado = useContador(valor, animado && !oculto);
  if (oculto) return <span aria-label="Monto oculto">$ ••••</span>;
  return <>{corto ? plataCorta(mostrado) : plata(mostrado)}</>;
}

const DURACION_MS = 380;

/**
 * El número sube (o baja) hasta su valor en vez de saltar: se entiende que
 * cambió y cuánto. Con "reducir movimiento" en el celular, salta directo.
 */
function useContador(objetivo: number, activo: boolean): number {
  const [mostrado, setMostrado] = useState(objetivo);
  const desde = useRef(objetivo);

  useEffect(() => {
    if (!activo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      desde.current = objetivo;
      const id = requestAnimationFrame(() => setMostrado(objetivo));
      return () => cancelAnimationFrame(id);
    }
    const inicio = performance.now();
    const origen = desde.current;
    let id = 0;
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / DURACION_MS);
      const curva = 1 - Math.pow(1 - t, 4); // ease-out-quart
      const v = origen + (objetivo - origen) * curva;
      setMostrado(v);
      if (t < 1) id = requestAnimationFrame(paso);
      else desde.current = objetivo;
    };
    id = requestAnimationFrame(paso);
    return () => {
      cancelAnimationFrame(id);
      desde.current = objetivo;
    };
  }, [objetivo, activo]);

  return activo ? mostrado : objetivo;
}

export function BotonOjo({ className = "" }: { className?: string }) {
  const [oculto, alternar] = usePrivado();
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={oculto}
      aria-label={oculto ? "Mostrar montos" : "Ocultar montos"}
      className={`flex h-11 w-11 items-center justify-center rounded-lg text-suave transition-colors hover:bg-fondo hover:text-tinta sm:h-9 sm:w-9 ${className}`}
    >
      <IconoOjo abierto={!oculto} />
    </button>
  );
}
