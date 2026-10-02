"use client";

import { useSyncExternalStore } from "react";
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
export function Monto({ valor, corto = false }: { valor: number; corto?: boolean }) {
  const [oculto] = usePrivado();
  if (oculto) return <span aria-label="Monto oculto">$ ••••</span>;
  return <>{corto ? plataCorta(valor) : plata(valor)}</>;
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
