import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sin conexión · Rentifay",
};

/*
 * Esta pantalla la sirve el service worker cuando una navegación no llega a la
 * red. Es un server component sin datos a propósito: tiene que poder mostrarse
 * estando offline, así que no puede depender de useData ni de la planilla.
 */
export default function Offline() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center bg-fondo px-6"
      style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="w-full max-w-sm rounded-xl border border-borde bg-papel px-6 py-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-acento-claro text-acento">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M3 4l18 16" />
            <path d="M5.5 11.5a9 9 0 0 1 4-2.3" />
            <path d="M8.7 15a5 5 0 0 1 2.1-1.2" />
            <path d="M12 19h.01" />
            <path d="M18.5 11.5a9 9 0 0 0-3.3-2.1" />
          </svg>
        </div>

        <h1 className="mt-4 text-base font-semibold tracking-tight text-tinta">Sin conexión</h1>

        <p className="mt-2 text-sm leading-relaxed text-suave">
          Los datos de Rentifay viven en una planilla de Google, así que sin red no hay nada
          para mostrar. Fijate el wifi o los datos del celular y probá de nuevo.
        </p>

        {/* Link duro y no next/link: acá lo que hace falta es un recargado real. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-acento px-4 text-sm font-medium text-white transition-transform duration-150 ease-[var(--ease-salida)] active:scale-[0.97]"
        >
          Probar de nuevo
        </a>
      </div>
    </main>
  );
}
