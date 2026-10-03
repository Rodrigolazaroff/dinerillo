"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  IconoAjustes, IconoDivision, IconoGastos, IconoIngresos, IconoInicio,
} from "@/components/iconos";
import { Emoji } from "@/components/Emoji";
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
        <Link href="/" className="flex items-center gap-1.5" aria-label="Dinerillo, inicio">
          <Emoji nombre="moneda" tamano="md" />
          <span className="titulo text-xl font-extrabold text-acento">dinerillo</span>
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
      <nav className="no-print mb-6 hidden w-fit gap-1 rounded-full bg-celeste-claro p-1 sm:flex" aria-label="Navegación principal">
        {LINKS.map(({ href, label, Icono }) => (
          <Link
            key={href}
            href={href}
            aria-current={esActivo(href, pathname) ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 ease-[var(--ease-quart)] ${
              esActivo(href, pathname)
                ? "bg-papel text-acento shadow-[0_1px_3px_oklch(0.24_0.06_264/0.12)]"
                : "text-suave hover:text-tinta"
            }`}
          >
            <Icono className="h-[18px] w-[18px]" />
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
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  activo ? "bg-acento text-white" : "bg-papel text-suave ring-1 ring-borde hover:text-tinta"
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
                  className={`flex min-h-[60px] flex-col items-center justify-center gap-1 transition-[transform,color] duration-150 ease-[var(--ease-quart)] active:scale-[0.92] ${
                    activo ? "text-acento" : "text-tenue"
                  }`}
                >
                  {/* La pestaña activa lleva una píldora celeste atrás del ícono. */}
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-[background-color] duration-200 ease-[var(--ease-quart)] ${
                      activo ? "bg-celeste-claro" : ""
                    }`}
                  >
                    <Icono />
                  </span>
                  <span className={`text-[11px] leading-none ${activo ? "font-bold" : "font-medium"}`}>
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
