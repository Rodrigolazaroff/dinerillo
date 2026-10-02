"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  IconoAjustes, IconoDivision, IconoGastos, IconoIngresos, IconoInicio,
} from "@/components/iconos";
import { BotonOjo } from "@/components/Privado";
import { Toasts } from "@/components/Toast";

// Esta app se usa desde el celular casi siempre, así que manda el layout mobile:
// barra de pestañas abajo, donde llega el pulgar. En pantalla grande esa barra
// desaparece y la navegación vuelve arriba, que es lo natural con mouse.
//
// Cuatro pestañas y no más: lo que se mira todos los días. Ajustes vive arriba,
// y Alquileres adentro de Ingresos, que es lo que es.

const LINKS = [
  { href: "/", label: "Inicio", Icono: IconoInicio },
  { href: "/ingresos", label: "Ingresos", Icono: IconoIngresos },
  { href: "/gastos", label: "Gastos", Icono: IconoGastos },
  { href: "/division", label: "División", Icono: IconoDivision },
];

const SUB_ALQUILERES = [
  { href: "/alquileres", label: "Resumen" },
  { href: "/alquileres/cobros", label: "Cobros" },
  { href: "/alquileres/boletas", label: "Boletas" },
  { href: "/alquileres/contratos", label: "Contratos" },
];

function esActivo(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  // Alquileres es un ingreso más: la pestaña que se prende es Ingresos.
  if (href === "/ingresos" && pathname.startsWith("/alquileres")) return true;
  return pathname.startsWith(href);
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const enAlquileres = pathname.startsWith("/alquileres");

  async function salir() {
    await fetch("/auth/salir", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6">
      <header
        className="no-print sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-borde bg-fondo/90 px-4 py-2 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-5 sm:backdrop-blur-none"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <Link href="/" className="text-base font-semibold tracking-tight sm:text-lg">
          Dinerillo
        </Link>

        <div className="flex shrink-0 items-center gap-0.5 text-xs text-suave">
          <BotonOjo />
          <Link
            href="/ajustes"
            aria-label="Ajustes"
            aria-current={pathname.startsWith("/ajustes") ? "page" : undefined}
            className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-fondo hover:text-tinta sm:h-9 sm:w-9 ${
              pathname.startsWith("/ajustes") ? "text-acento" : ""
            }`}
          >
            <IconoAjustes className="h-5 w-5" />
          </Link>
          <button
            onClick={salir}
            className="hidden h-9 items-center px-2 underline-offset-2 hover:underline sm:flex"
          >
            salir
          </button>
        </div>
      </header>

      {/* Navegación de escritorio */}
      <nav className="no-print mb-6 hidden gap-1 sm:flex" aria-label="Navegación principal">
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

      {enAlquileres && (
        <nav
          className="no-print scroll-x -mx-4 mt-3 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:mt-0 sm:mb-4 sm:px-0"
          aria-label="Alquileres"
        >
          <Link
            href="/ingresos"
            className="flex shrink-0 items-center rounded-lg px-2.5 py-1.5 text-xs text-tenue hover:text-tinta"
          >
            ‹ Ingresos
          </Link>
          {SUB_ALQUILERES.map(({ href, label }) => {
            const activo = href === "/alquileres" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={activo ? "page" : undefined}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activo ? "bg-acento-claro text-acento" : "text-suave hover:text-tinta"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* El pb deja aire para que la barra de abajo no tape la última fila. */}
      <main className="flex-1 pt-4 pb-28 sm:pt-0 sm:pb-16">{children}</main>

      {/* Barra de pestañas: sólo celular */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-papel/95 backdrop-blur-sm sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegación principal"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {LINKS.map(({ href, label, Icono }) => {
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
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Toasts />
    </div>
  );
}
