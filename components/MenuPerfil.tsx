"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconoAjustes } from "@/components/iconos";
import { useInstalable } from "@/components/PWA";
import type { DataResponse } from "@/lib/useData";
import { nombreVisible } from "@/lib/useData";

// Tu cuenta, arriba a la derecha: la foto (o la inicial), y al tocarla quién
// sos, los ajustes y salir. Es un menú que cuelga del avatar, no un panel:
// se abre y se cierra sin perder la pantalla de atrás.

export async function salir() {
  await fetch("/auth/salir", { method: "POST" });
  // Recarga completa: que no quede nada de la sesión anterior en memoria.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a propósito, ver arriba
  window.location.href = "/login";
}

export function Avatar({ data, tamano = "sm" }: { data: DataResponse; tamano?: "sm" | "lg" }) {
  const [fallo, setFallo] = useState(false);
  const nombre = nombreVisible(data);
  const clase = tamano === "lg" ? "h-11 w-11 text-lg" : "h-8 w-8 text-sm";
  if (data.sesion.avatar && !fallo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- la foto viene de Google, no hay nada que optimizar
      <img
        src={data.sesion.avatar}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFallo(true)}
        className={`${clase} shrink-0 rounded-full object-cover ring-2 ring-papel`}
      />
    );
  }
  return (
    <span
      className={`${clase} titulo flex shrink-0 items-center justify-center rounded-full bg-acento font-bold text-white`}
      aria-hidden
    >
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}

export function MenuPerfil({ data }: { data: DataResponse }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const { sePuedeInstalar, esIOS, instalar } = useInstalable();
  const router = useRouter();

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  const item =
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors hover:bg-celeste-claro";

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-label="Tu cuenta"
        aria-expanded={abierto}
        aria-haspopup="menu"
        className="flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-150 ease-[var(--ease-quart)] active:scale-[0.92] sm:h-10 sm:w-10"
      >
        <Avatar data={data} />
      </button>

      {abierto && (
        <div
          role="menu"
          className="aparece absolute right-0 top-full z-40 mt-1.5 w-72 rounded-2xl bg-papel p-2 shadow-[0_16px_40px_-12px_oklch(0.24_0.06_264/0.35)] ring-1 ring-borde"
        >
          <div className="flex items-center gap-3 px-3 pb-3 pt-2">
            <Avatar data={data} tamano="lg" />
            <div className="min-w-0">
              <p className="titulo truncate text-base font-bold">{nombreVisible(data)}</p>
              <p className="truncate text-xs text-tenue">{data.sesion.email}</p>
            </div>
          </div>
          <div className="flex flex-col border-t border-linea pt-1.5">
            <Link href="/ajustes" role="menuitem" className={item} onClick={() => setAbierto(false)}>
              <IconoAjustes className="h-5 w-5 text-suave" />
              Ajustes
            </Link>
            <Link href="/ayuda" role="menuitem" className={item} onClick={() => setAbierto(false)}>
              <svg viewBox="0 0 20 20" className="h-5 w-5 text-suave" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="10" cy="10" r="7" />
                <path d="M8 8a2 2 0 113 1.7c-.6.4-1 .8-1 1.5M10 13.75v.01" />
              </svg>
              Cómo funciona
            </Link>
            {data.admin && (
              <Link href="/admin" role="menuitem" className={item} onClick={() => setAbierto(false)}>
                <svg viewBox="0 0 20 20" className="h-5 w-5 text-suave" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 16V9M10 16V4M16 16v-5" />
                </svg>
                Administración
              </Link>
            )}
            {(sePuedeInstalar || esIOS) && (
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  setAbierto(false);
                  if (sePuedeInstalar) void instalar();
                  else router.push("/ajustes#instalar");
                }}
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5 text-suave" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10 3v9m0 0l3.5-3.5M10 12L6.5 8.5" />
                  <path d="M4 14v1.5A1.5 1.5 0 005.5 17h9a1.5 1.5 0 001.5-1.5V14" />
                </svg>
                Instalar la app
              </button>
            )}
            <button type="button" role="menuitem" className={`${item} text-peligro hover:bg-peligro-claro`} onClick={salir}>
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 4H5.5A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8M12.5 13.5L16 10l-3.5-3.5M16 10H8" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
