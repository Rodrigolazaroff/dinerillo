"use client";

import { IconoFlecha } from "@/components/iconos";
import { periodoActual, periodoLargo, sumarMeses } from "@/lib/format";
import { useMes } from "@/lib/useMes";

/** ‹ octubre 2026 › — con atajo para volver al mes en curso. */
export function SelectorMes({ className = "" }: { className?: string }) {
  const [mes, setMes] = useMes();
  const hoy = periodoActual();
  const boton =
    "flex h-11 w-11 items-center justify-center rounded-lg text-suave transition-colors hover:bg-papel hover:text-tinta sm:h-9 sm:w-9";
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button type="button" className={boton} onClick={() => setMes(sumarMeses(mes, -1))} aria-label="Mes anterior">
        <IconoFlecha direccion="izquierda" />
      </button>
      <span className="min-w-[8.5rem] text-center text-sm font-semibold capitalize tracking-tight">
        {periodoLargo(mes)}
      </span>
      <button type="button" className={boton} onClick={() => setMes(sumarMeses(mes, 1))} aria-label="Mes siguiente">
        <IconoFlecha />
      </button>
      {mes !== hoy && (
        <button
          type="button"
          onClick={() => setMes(hoy)}
          className="ml-1 rounded-md px-2 py-1 text-xs font-medium text-acento hover:bg-acento-claro"
        >
          Hoy
        </button>
      )}
    </div>
  );
}
