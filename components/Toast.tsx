"use client";

import { useEffect, useSyncExternalStore } from "react";

// Un aviso abajo, con "Deshacer" cuando corresponde. Reemplaza al cartel de
// "¿seguro?": borrar es un toque, y arrepentirse también.

interface Toast {
  id: number;
  texto: string;
  deshacer?: () => void;
}

let actual: Toast | null = null;
let siguiente = 1;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((f) => f());

export function avisar(texto: string, deshacer?: () => void) {
  actual = { id: siguiente++, texto, deshacer };
  emitir();
}

function cerrar(id: number) {
  if (actual?.id === id) {
    actual = null;
    emitir();
  }
}

export function Toasts() {
  const t = useSyncExternalStore(
    (fn) => {
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },
    () => actual,
    () => null
  );

  useEffect(() => {
    if (!t) return;
    // Con "Deshacer" se queda más: hay que darle tiempo al pulgar.
    const timer = setTimeout(() => cerrar(t.id), t.deshacer ? 6000 : 3000);
    return () => clearTimeout(timer);
  }, [t]);

  if (!t) return null;
  return (
    <div
      className="no-print pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
      role="status"
      aria-live="polite"
    >
      <div
        key={t.id}
        className="aparece pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-xl bg-tinta px-4 py-3 text-sm text-white shadow-lg"
      >
        <span>{t.texto}</span>
        {t.deshacer && (
          <button
            type="button"
            className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-acento-claro underline-offset-2 hover:underline"
            onClick={() => {
              t.deshacer?.();
              cerrar(t.id);
            }}
          >
            Deshacer
          </button>
        )}
      </div>
    </div>
  );
}
