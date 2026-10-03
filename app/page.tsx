"use client";

import Link from "next/link";
import { useState } from "react";
import { Asistente } from "@/components/Asistente";
import { colorCategoria, PuntoCategoria } from "@/components/Categorias";
import { FormMovimiento } from "@/components/FormMovimiento";
import { IngresosVsGastos } from "@/components/Graficos";
import { IconoDivision, IconoFlecha, IconoGastos, IconoIngresos } from "@/components/iconos";
import { Monto, usePrivado } from "@/components/Privado";
import { SelectorMes } from "@/components/SelectorMes";
import { Shell } from "@/components/Shell";
import { Aviso, BarraParte, Card, Cargando } from "@/components/ui";
import type { TonoAviso } from "@/lib/finanzas";
import { periodoLargo, plata } from "@/lib/format";
import { useFinanzas } from "@/lib/useFinanzas";

// La pantalla de todos los días. Arriba el número que importa (cuánto te
// quedó), después lo que pide hacer algo y al final el contexto. Nada de
// felicitaciones ni confeti: los números se leen solos.

const TONO_AVISO: Record<TonoAviso, string> = {
  peligro: "bg-peligro",
  espera: "bg-espera",
  acento: "bg-acento",
  ok: "bg-ok",
};

export default function Inicio() {
  const f = useFinanzas();
  const [oculto] = usePrivado();
  const [cargar, setCargar] = useState<"propio" | "compartido" | null>(null);

  if (f.error) {
    return (
      <Shell>
        <Aviso tipo="error">{f.error.message}</Aviso>
      </Shell>
    );
  }
  if (!f.data || !f.resumen) {
    return (
      <Shell>
        <Cargando />
      </Shell>
    );
  }

  const r = f.resumen;
  const tasa = r.tasaAhorro;
  const llega = tasa !== null && tasa * 100 >= r.ahorroPct;
  const nombre = f.data.sesion.usuario;

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold tracking-tight">Hola, {nombre}</h1>
          <SelectorMes />
        </div>

        {/* El número del mes */}
        <section className="rounded-2xl bg-acento px-5 pb-5 pt-5 text-white">
          <p className="text-xs font-medium text-white/75">Te quedó en {periodoLargo(f.mes)}</p>
          <p className="tabular mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
            <Monto valor={r.quedo} />
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <Link href="/ingresos" className="rounded-xl bg-white/10 px-3 py-2.5 hover:bg-white/15">
              <p className="text-white/70">Entró</p>
              <p className="tabular mt-0.5 text-base font-semibold">
                <Monto valor={r.ingresos.total} />
              </p>
            </Link>
            <Link href="/gastos" className="rounded-xl bg-white/10 px-3 py-2.5 hover:bg-white/15">
              <p className="text-white/70">Salió</p>
              <p className="tabular mt-0.5 text-base font-semibold">
                <Monto valor={r.gastos.total} />
              </p>
            </Link>
          </div>

          {r.ingresos.total > 0 && (
            <div className="mt-4">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20" role="presentation">
                <div
                  className={`h-full rounded-full ${llega ? "bg-white" : "bg-white/60"}`}
                  // Lleno = llegaste al ahorro sugerido.
                  style={{ width: `${Math.max(0, Math.min(100, ((tasa ?? 0) * 100 * 100) / Math.max(r.ahorroPct, 1)))}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-white/80">
                {oculto
                  ? `Ahorro sugerido ${r.ahorroPct}%`
                  : tasa !== null && tasa > 0
                    ? `Ahorraste ${Math.round(tasa * 100)}% · sugerido ${r.ahorroPct}%, ${plata(r.ahorroSugerido)}`
                    : `Este mes salió más de lo que entró · sugerido ${r.ahorroPct}%`}
              </p>
            </div>
          )}
        </section>

        {/* Atajos de carga */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Gasto", Icono: IconoGastos, onClick: () => setCargar("propio") },
            { label: "Compartido", Icono: IconoDivision, onClick: () => setCargar("compartido") },
            { label: "Ingreso", Icono: IconoIngresos, href: "/ingresos" },
          ].map(({ label, Icono, onClick, href }) => {
            const clase =
              "flex flex-col items-center gap-1.5 rounded-xl border border-borde bg-papel px-2 py-3 text-xs font-medium transition-transform active:scale-[0.97] hover:bg-fondo";
            const contenido = (
              <>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-acento-claro text-acento">
                  <Icono className="h-5 w-5" />
                </span>
                + {label}
              </>
            );
            return href ? (
              <Link key={label} href={href} className={clase}>
                {contenido}
              </Link>
            ) : (
              <button key={label} type="button" onClick={onClick} className={clase}>
                {contenido}
              </button>
            );
          })}
        </div>

        {/* Dictar o subir una factura: abre el formulario que corresponda */}
        <Asistente modo="libre" className="[&>*]:flex-1" />

        {/* Lo que pide hacer algo */}
        {f.avisos.length > 0 && (
          <Card titulo="Pendientes">
            <ul className="divide-y divide-linea">
              {f.avisos.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-fondo sm:px-5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${TONO_AVISO[a.tono]}`} aria-hidden />
                    <span className="min-w-0 flex-1">{oculto ? a.texto.replace(/\$ [\d.]+/g, "$ ••••") : a.texto}</span>
                    <IconoFlecha className="text-tenue" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Para entender el mes */}
        {f.insights.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {f.insights.map((i) => (
              <div key={i.id} className="rounded-xl border border-borde bg-papel px-3.5 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-tenue">{i.titulo}</p>
                <p className="tabular mt-1 truncate text-base font-semibold tracking-tight">
                  {oculto && i.valor.startsWith("$") ? "$ ••••" : i.valor}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-suave">
                  {oculto ? i.detalle.replace(/\$ [\d.]+/g, "$ ••••") : i.detalle}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card titulo="De dónde vino">
            {r.ingresos.lineas.filter((l) => l.pesos > 0).length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-tenue sm:px-5">
                Nada cargado este mes.{" "}
                <Link href="/ingresos" className="font-medium text-acento">Cargar un ingreso</Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                {r.ingresos.lineas.filter((l) => l.pesos > 0).map((l) => (
                  <li key={l.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{l.nombre}</span>
                      <span className="tabular font-semibold"><Monto valor={l.pesos} /></span>
                    </div>
                    <BarraParte parte={l.pesos} total={r.ingresos.total} color="var(--color-serie-3)" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card titulo="En qué se fue">
            {r.gastos.categorias.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-tenue sm:px-5">
                Sin gastos este mes.{" "}
                <button type="button" onClick={() => setCargar("propio")} className="font-medium text-acento">
                  Cargar uno
                </button>
              </p>
            ) : (
              <ul className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                {r.gastos.categorias.slice(0, 5).map((c) => (
                  <li key={c.id || "sin"} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <PuntoCategoria color={c.color} />
                      <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                      <span className="tabular font-semibold"><Monto valor={c.total} /></span>
                    </div>
                    <BarraParte parte={c.total} total={r.gastos.total} color={colorCategoria(c.color)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {!oculto && <IngresosVsGastos serie={f.serie} actual={f.mes} />}
      </div>

      {cargar && (
        <FormMovimiento
          modo={cargar}
          abierto
          cerrar={() => setCargar(null)}
          mes={f.mes}
          categorias={f.data.categorias}
          pareja={f.prefs.pareja}
          miPctDefault={f.prefs.divMiPct}
          recargar={f.recargar}
        />
      )}
    </Shell>
  );
}
