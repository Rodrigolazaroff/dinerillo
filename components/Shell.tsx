"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import {
  IconoDivision, IconoFlecha, IconoGastos, IconoIngresos, IconoInicio,
} from "@/components/iconos";
import { Emoji } from "@/components/Emoji";
import { MenuPerfil } from "@/components/MenuPerfil";
import { BotonOjo } from "@/components/Privado";
import { Toasts, avisar } from "@/components/Toast";
import { Cargando } from "@/components/ui";
import { fijosParaCargarSolos } from "@/lib/finanzas";
import { enviar, tieneDatos, useData, usaDivision } from "@/lib/useData";

// Esta app se usa desde el celular casi siempre, así que manda el layout mobile:
// barra de pestañas abajo, donde llega el pulgar. En pantalla grande esa barra
// desaparece y la navegación vuelve arriba, que es lo natural con mouse.
//
// Cuatro pestañas como mucho: lo que se mira todos los días. División se va si
// no dividís gastos con nadie. Tu cuenta y los ajustes viven en el avatar, y
// Alquileres adentro de Ingresos, que es lo que es.

const LINKS = [
  { href: "/", label: "Inicio", Icono: IconoInicio },
  { href: "/ingresos", label: "Ingresos", Icono: IconoIngresos },
  { href: "/gastos", label: "Gastos", Icono: IconoGastos },
  { href: "/division", label: "División", Icono: IconoDivision },
];

const SUB_ALQUILERES = [
  { href: "/alquileres", label: "Cobros" },
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
  const router = useRouter();
  const { data, recargar } = useData();
  const enAlquileres = pathname.startsWith("/alquileres");
  const marcado = useRef(false);

  // Cuenta nueva: primero la Bienvenida. Quien ya venía usando la app no
  // tiene nada que contestar: se marca en silencio y sigue como siempre.
  const falta = Boolean(data && !data.config?.onboarding);
  const nuevo = falta && data !== undefined && !tieneDatos(data);
  useEffect(() => {
    if (!data || !falta) return;
    if (nuevo) {
      router.replace("/bienvenida");
      return;
    }
    if (marcado.current) return;
    marcado.current = true;
    void enviar("/api/config", "POST", { onboarding: "previo" }).then(() => recargar());
  }, [data, falta, nuevo, router, recargar]);

  // Los gastos fijos de monto fijo se cargan solos el día que tocan: al abrir
  // la app, lo que ya venció este mes y no está, se carga. La base no deja
  // duplicar un fijo en el mes, así que dos dispositivos a la vez no suman dos.
  const intentados = useRef(new Set<string>());
  useEffect(() => {
    if (!data || falta) return;
    const e = {
      ingresos: [], ingresoCobros: [], categorias: [], divCierres: [], calculados: [], config: {},
      misGastos: data.misGastos ?? [], divGastos: data.divGastos ?? [], gastosFijos: data.gastosFijos ?? [],
    };
    const periodo = data.hoy.slice(0, 7);
    const pendientes = fijosParaCargarSolos(e, data.hoy).filter((f) => !intentados.current.has(`${f.fijo.id}:${periodo}`));
    if (!pendientes.length) return;
    pendientes.forEach((f) => intentados.current.add(`${f.fijo.id}:${periodo}`));
    void Promise.all(
      pendientes.map(({ fijo, dia }) =>
        enviar(fijo.compartido ? "/api/division" : "/api/mis-gastos", "POST", {
          fecha: `${periodo}-${String(dia).padStart(2, "0")}`,
          periodo,
          descripcion: fijo.descripcion,
          monto: fijo.monto,
          categoria_id: fijo.categoria_id,
          nota: "",
          fijo_id: fijo.id,
          ...(fijo.compartido ? { pago: fijo.pago, mi_pct: fijo.mi_pct } : {}),
        })
      )
    ).then((rs) => {
      const ok = rs.filter((r) => r.ok).length;
      if (!ok) return;
      avisar(ok === 1 ? `Se cargó solo: ${pendientes[0].fijo.descripcion}` : `Se cargaron solos ${ok} gastos fijos`);
      void recargar();
    });
  }, [data, falta, recargar]);

  const links = LINKS.filter((l) => l.href !== "/division" || !data || usaDivision(data));

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

        <div className="flex shrink-0 items-center gap-1">
          <BotonOjo />
          {data ? (
            <MenuPerfil data={data} />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center sm:h-10 sm:w-10" aria-hidden>
              <span className="h-8 w-8 rounded-full bg-celeste-claro" />
            </span>
          )}
        </div>
      </header>

      {/* Navegación de escritorio */}
      <nav className="no-print mb-6 hidden w-fit gap-1 rounded-full bg-celeste-claro p-1 sm:flex" aria-label="Navegación principal">
        {links.map(({ href, label, Icono }) => (
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

      {/* Alquileres tiene su título y sus tres secciones, a lo ancho y sin scroll. */}
      {enAlquileres && (
        <div className="no-print mt-3 flex flex-col gap-3 sm:mt-0 sm:mb-5">
          <div>
            <Link
              href="/ingresos"
              className="-ml-1.5 inline-flex min-h-9 items-center gap-0.5 pr-2 text-xs font-semibold text-tenue transition-colors hover:text-tinta"
            >
              <IconoFlecha direccion="izquierda" />
              Ingresos
            </Link>
            <h1 className="titulo flex items-center gap-2 text-2xl font-bold">
              <Emoji nombre="llave" tamano="md" />
              Alquileres
            </h1>
          </div>
          <nav
            aria-label="Secciones de alquileres"
            className="grid grid-cols-3 gap-1 rounded-full bg-celeste-claro p-1 sm:w-fit sm:min-w-96"
          >
            {SUB_ALQUILERES.map(({ href, label }) => {
              const activo = href === "/alquileres" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={activo ? "page" : undefined}
                  className={`flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 ease-[var(--ease-quart)] active:scale-[0.97] sm:min-h-9 ${
                    activo
                      ? "bg-papel text-acento shadow-[0_1px_3px_oklch(0.24_0.06_264/0.12)]"
                      : "text-suave hover:text-tinta"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* El pb deja aire para que la barra de abajo no tape la última fila. */}
      <main className="flex-1 pt-4 pb-28 sm:pt-0 sm:pb-16">{nuevo ? <Cargando /> : children}</main>

      {/* Barra de pestañas: sólo celular */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-papel/95 backdrop-blur-sm sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegación principal"
      >
        <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
          {links.map(({ href, label, Icono }) => {
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
