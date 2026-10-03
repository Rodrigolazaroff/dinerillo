"use client";

import Link from "next/link";
import { useState } from "react";
import { Asistente, Atajo } from "@/components/Asistente";
import { colorCategoria } from "@/components/Categorias";
import { Emoji } from "@/components/Emoji";
import { FormMovimiento } from "@/components/FormMovimiento";
import { IngresosVsGastos } from "@/components/Graficos";
import { IconoFlecha } from "@/components/iconos";
import { Monto, usePrivado } from "@/components/Privado";
import { SelectorMes } from "@/components/SelectorMes";
import { Shell } from "@/components/Shell";
import { Aviso, BarraParte, Card, Cargando } from "@/components/ui";
import type { Aviso as AvisoMes } from "@/lib/finanzas";
import { periodoLargo, plata } from "@/lib/format";
import { nombreVisible, usaDivision } from "@/lib/useData";
import { useFinanzas } from "@/lib/useFinanzas";

// La pantalla de todos los días. Arriba el número que importa (cuánto te
// quedó), después cargar algo, lo que pide hacer algo y al final el contexto.
// La onda está en el color, los emojis y el movimiento; los números se leen
// solos y no se festeja cada cosa.

/** El emoji de cada aviso, por el tipo que dice su id. */
function emojiAviso(a: AvisoMes): string {
  if (a.id.startsWith("mora")) return "alerta";
  if (a.id.startsWith("cobrar")) return "llave";
  if (a.id.startsWith("aumento")) return "grafico";
  if (a.id.startsWith("division")) return "corazones";
  return "calendario";
}

const EMOJI_INSIGHT: Record<string, string> = {
  ritmo: "cohete",
  top: "trofeo",
  crecio: "grafico",
  fuente: "bolsa-plata",
};

/** Los montos de un texto, tapados cuando el ojito está cerrado. */
const tapar = (texto: string, oculto: boolean) => (oculto ? texto.replace(/\$ [\d.]+/g, "$ ••••") : texto);

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
  const avance = Math.max(0, Math.min(100, ((tasa ?? 0) * 100 * 100) / Math.max(r.ahorroPct, 1)));
  const nombre = nombreVisible(f.data);
  const divide = usaDivision(f.data);
  const ingresos = r.ingresos.lineas.filter((l) => l.pesos > 0);

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <h1 className="titulo text-2xl font-bold">Hola, {nombre}</h1>
          <SelectorMes className="-mx-2" />
        </div>

        {/* El número del mes */}
        <section className="relative overflow-hidden rounded-2xl bg-acento px-5 pb-5 pt-5 text-white">
          {/* El emoji acompaña cómo viene el mes; queda de fondo, no compite con el número. */}
          <Emoji
            nombre={r.quedo >= 0 ? "bolsa-plata" : "plata-vuela"}
            tamano="xxl"
            className="pop pointer-events-none absolute -right-2 -top-1 h-24 w-24 rotate-12 opacity-95"
          />
          <p className="text-sm font-medium text-white/80">Te quedó</p>
          <p className="numero mt-2 text-[2.75rem] font-extrabold sm:text-6xl">
            <Monto valor={r.quedo} animado />
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <Link
              href="/ingresos"
              className="rounded-xl bg-white/12 px-3.5 py-3 transition-colors hover:bg-white/18"
            >
              <p className="flex items-center gap-1.5 text-xs font-medium text-white/80">
                <Emoji nombre="grafico" tamano="xs" /> Entró
              </p>
              <p className="numero mt-1 text-lg font-bold">
                <Monto valor={r.ingresos.total} />
              </p>
            </Link>
            <Link
              href="/gastos"
              className="rounded-xl bg-white/12 px-3.5 py-3 transition-colors hover:bg-white/18"
            >
              <p className="flex items-center gap-1.5 text-xs font-medium text-white/80">
                <Emoji nombre="plata-vuela" tamano="xs" /> Salió
              </p>
              <p className="numero mt-1 text-lg font-bold">
                <Monto valor={r.gastos.total} />
              </p>
            </Link>
          </div>

          {r.ingresos.total > 0 && (
            <div className="mt-5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/20" role="presentation">
                <div
                  // Lleno = llegaste al ahorro que te propusiste. En lima cuando llegás.
                  className={`h-full rounded-full transition-[width] duration-700 ease-[var(--ease-quart)] ${
                    llega ? "bg-lima" : "bg-celeste"
                  }`}
                  style={{ width: `${avance}%` }}
                />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-white/90">
                {llega && <Emoji nombre="chispas" tamano="xs" />}
                {oculto
                  ? `Meta de ahorro ${r.ahorroPct}%`
                  : llega
                    ? `¡Llegaste! Guardás ${Math.round((tasa ?? 0) * 100)}% · meta ${r.ahorroPct}%`
                    : tasa !== null && tasa > 0
                      ? `Guardás ${Math.round(tasa * 100)}% · meta ${r.ahorroPct}% (${plata(r.ahorroSugerido)})`
                      : `Sin ahorro · meta ${r.ahorroPct}%`}
              </p>
            </div>
          )}
        </section>

        {/* Cargar algo: a un toque */}
        <Asistente
          modo="libre"
          variante="atajos"
          antes={
            <>
              <Atajo emoji="tarjeta" onClick={() => setCargar("propio")}>
                Gasto
              </Atajo>
              {divide && (
                <Atajo emoji="corazones" onClick={() => setCargar("compartido")}>
                  Compartido
                </Atajo>
              )}
            </>
          }
        />

        {/* Lo que pide hacer algo */}
        {f.avisos.length > 0 && (
          <Card titulo="Para hacer">
            <ul className="lista-entra divide-y divide-linea">
              {f.avisos.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-celeste-claro sm:px-5"
                  >
                    <Emoji nombre={emojiAviso(a)} tamano="md" />
                    <span className="min-w-0 flex-1">{tapar(a.texto, oculto)}</span>
                    <IconoFlecha className="text-tenue" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Para entender el mes */}
        {f.insights.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {f.insights.map((i) => (
              <div key={i.id} className="rounded-2xl bg-celeste-claro px-4 py-3.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-suave">
                  <Emoji nombre={EMOJI_INSIGHT[i.id] ?? "chispas"} tamano="sm" />
                  {i.titulo}
                </p>
                <p className="numero mt-2 truncate text-xl font-bold">
                  {oculto && i.valor.startsWith("$") ? "$ ••••" : i.valor}
                </p>
                <p className="mt-1 text-xs leading-snug text-suave">{tapar(i.detalle, oculto)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card titulo="De dónde vino">
            {ingresos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-suave sm:px-5">
                <Emoji nombre="bolsa-plata" tamano="xl" />
                Todavía nada.
                <Link href="/ingresos" className="font-semibold text-acento">
                  Cargar un ingreso
                </Link>
              </div>
            ) : (
              <ul className="lista-entra flex flex-col gap-3.5 px-4 py-4 sm:px-5">
                {ingresos.map((l) => (
                  <li key={l.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <Emoji nombre={l.emoji} tamano="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium">{l.nombre}</span>
                      <span className="tabular font-semibold">
                        <Monto valor={l.pesos} />
                      </span>
                    </div>
                    <BarraParte parte={l.pesos} total={r.ingresos.total} color="var(--color-acento)" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card titulo="En qué se fue">
            {r.gastos.categorias.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-suave sm:px-5">
                <Emoji nombre="brote" tamano="xl" />
                Cero gastos. ¿Mes austero?
                <button type="button" onClick={() => setCargar("propio")} className="font-semibold text-acento">
                  Cargar uno
                </button>
              </div>
            ) : (
              <ul className="lista-entra flex flex-col gap-3.5 px-4 py-4 sm:px-5">
                {r.gastos.categorias.slice(0, 5).map((c) => (
                  <li key={c.id || "sin"} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <Emoji nombre={c.emoji} tamano="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium">{c.nombre}</span>
                      <span className="tabular font-semibold">
                        <Monto valor={c.total} />
                      </span>
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
          puedeCompartir={divide}
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
