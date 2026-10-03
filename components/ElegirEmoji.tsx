"use client";

import { Emoji } from "@/components/Emoji";
import { Panel } from "@/components/ui";
import { ELEGIBLES } from "@/lib/emoji";

// La grilla para elegir el emoji de una categoría o de un ingreso. Toca uno y
// listo: se guarda al elegir, sin botón de confirmar.

export function ElegirEmoji({
  abierto,
  cerrar,
  actual,
  titulo,
  alElegir,
}: {
  abierto: boolean;
  cerrar: () => void;
  actual: string;
  titulo: string;
  alElegir: (nombre: string) => void;
}) {
  return (
    <Panel abierto={abierto} cerrar={cerrar} titulo={titulo}>
      <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-8" role="listbox" aria-label="Emojis">
        {ELEGIBLES.map((e) => {
          const elegido = e.nombre === actual;
          return (
            <li key={e.nombre}>
              <button
                type="button"
                role="option"
                aria-selected={elegido}
                aria-label={e.etiqueta}
                title={e.etiqueta}
                onClick={() => {
                  alElegir(e.nombre);
                  cerrar();
                }}
                className={`flex aspect-square w-full items-center justify-center rounded-xl transition-[transform,background-color] duration-150 ease-[var(--ease-quart)] active:scale-90 ${
                  elegido ? "bg-celeste ring-2 ring-acento" : "bg-fondo hover:bg-celeste-claro"
                }`}
              >
                <Emoji nombre={e.nombre} tamano="lg" />
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
