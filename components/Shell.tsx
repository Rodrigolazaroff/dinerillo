"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  IconoAjustes, IconoCobros, IconoContratos, IconoGastos, IconoResumen,
} from "@/components/iconos";
import { periodoLargo } from "@/lib/format";
import { useData } from "@/lib/useData";

// Esta app se usa desde el celular casi siempre, así que manda el layout mobile:
// barra de pestañas abajo, donde llega el pulgar. En pantalla grande esa barra
// desaparece y la navegación vuelve arriba, que es lo natural con mouse.

const LINKS = [
  { href: "/", label: "Resumen", corto: "Resumen", Icono: IconoResumen },
  { href: "/cobros", label: "Cobros", corto: "Cobros", Icono: IconoCobros },
  { href: "/gastos", label: "Gastos", corto: "Gastos", Icono: IconoGastos },
  { href: "/contratos", label: "Contratos", corto: "Contratos", Icono: IconoContratos },
  { href: "/ajustes", label: "Ajustes", corto: "Ajustes", Icono: IconoAjustes },
];

const esActivo = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data } = useData();

  async function salir() {
    await fetch("/auth/salir", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6">
      <header
        className="no-print sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-borde bg-fondo/90 px-4 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-5 sm:backdrop-blur-none"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="flex min-w-0 items-baseline gap-2.5">
          <Link href="/" className="text-base font-semibold tracking-tight sm:text-lg">
            Dinerillo
          </Link>
          {data?.resumen && (
            <span className="truncate text-[11px] text-suave sm:text-xs">
              {periodoLargo(data.resumen.periodoActual)}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs text-suave">
          {data?.sesion?.rol === "lectura" && (
            <span className="rounded bg-borde px-1.5 py-0.5 text-[10px] font-semibold text-suave">
              solo lectura
            </span>
          )}
          <button
            onClick={salir}
            className="-mr-2 flex h-11 items-center px-2 underline-offset-2 hover:underline"
          >
            salir
          </button>
        </div>
      </header>

      {/* Navegación de escritorio */}
      <nav className="no-print mb-6 hidden gap-1 sm:flex">
        {LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              esActivo(href, pathname)
                ? "bg-acento text-white"
                : "text-suave hover:bg-acento-claro hover:text-acento"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* El pb deja aire para que la barra de abajo no tape la última fila. */}
      <main className="flex-1 pt-4 pb-28 sm:pt-0 sm:pb-16">{children}</main>

      {/* Barra de pestañas: sólo celular */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-papel/95 backdrop-blur-sm sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegación principal"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {LINKS.map(({ href, corto, label, Icono }) => {
            const activo = esActivo(href, pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={activo ? "page" : undefined}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-1 transition-[transform,color] duration-150 ease-[var(--ease-salida)] active:scale-[0.92] ${
                    activo ? "text-acento" : "text-tenue"
                  }`}
                >
                  <Icono className={activo ? "scale-105" : ""} />
                  <span className={`text-[10px] leading-none ${activo ? "font-semibold" : ""}`}>
                    {corto}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
