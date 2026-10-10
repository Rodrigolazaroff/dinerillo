"use client";

import Link from "next/link";
import { useState } from "react";
import { Asistente, Atajo } from "@/components/Asistente";
import { colorCategoria } from "@/components/Categorias";
import { Emoji } from "@/components/Emoji";
import { FormMovimiento } from "@/components/FormMovimiento";
import { IngresosVsGastos } from "@/components/Graficos";
import { PanelAhorro } from "@/components/PanelAhorro";
import { Recorrido, olvidarRecorridoPedido, recorridoPedido, type PasoRecorrido } from "@/components/Recorrido";
import { IconoFlecha, IconoMas } from "@/components/iconos";
import { Monto, usePrivado } from "@/components/Privado";
import { SelectorMes } from "@/components/SelectorMes";
import { Shell } from "@/components/Shell";
import { Aviso, BarraParte, Card, Cargando } from "@/components/ui";
import type { Aviso as AvisoMes } from "@/lib/finanzas";
import { periodoLargo, plata } from "@/lib/format";
import { marcarRecorrido, mostrarRecorrido, nombreVisible, usaDivision } from "@/lib/useData";
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
  const [ahorrando, setAhorrando] = useState(false);
  // El recorrido sale solo la primera vez; desde Preguntas frecuentes se pide otra vez.
  const [pedido, setPedido] = useState(recorridoPedido);
  const [recorridoVisto, setRecorridoVisto] = useState(false);

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
  // La meta se cumple con lo que apartaste, no con lo que sobró.
  const meta = r.ahorroSugerido;
  const llega = meta > 0 && r.ahorrado >= meta - 1;
  const avance = meta > 0 ? Math.max(0, Math.min(100, (r.ahorrado / meta) * 100)) : 0;
  const ahorrosDelMes = (f.data.ahorros ?? []).filter((a) => !a.deleted_at && a.periodo === f.mes);
  const ultimoDolar =
    [...(f.data.ahorros ?? [])].reverse().find((a) => !a.deleted_at && a.moneda === "USD")?.tipo_cambio ?? null;
  const nombre = nombreVisible(f.data);
  const divide = usaDivision(f.data);
  const ingresos = r.ingresos.lineas.filter((l) => l.pesos > 0);

  const enRecorrido = !recorridoVisto && (pedido || mostrarRecorrido(f.data));
  const pareja = f.prefs.pareja.trim();
  const pasos: PasoRecorrido[] = [
    {
      donde: "mes",
      emoji: "bolsa-plata",
      titulo: "Tu mes, de un vistazo",
      texto: "Te quedó es lo que entró menos lo que salió. Se arma solo a medida que cargás.",
    },
    {
      donde: "ahorro",
      emoji: "brote",
      titulo: "Ahorrar es apartar",
      texto: "Con Ahorrar marcás lo que guardás a propósito. La meta se llena con eso, no con lo que sobra.",
    },
    {
      donde: "cargar",
      emoji: "tarjeta",
      titulo: "Cargá en segundos",
      texto: "Tocá Gasto, dictalo («ayer el súper 85 lucas») o subí la foto de la factura. Siempre lo revisás antes de guardar.",
    },
    {
      donde: "pestanas",
      emoji: "grafico",
      titulo: "Cada cosa en su lugar",
      texto: divide
        ? `En Ingresos anotás lo que cobrás, en Gastos ves en qué se te va y en División lo que compartís${pareja ? ` con ${pareja}` : ""}.`
        : "En Ingresos anotás lo que cobrás y en Gastos ves en qué se te va.",
    },
    {
      donde: "cuenta",
      emoji: "ojo",
      titulo: "El ojito y tu cuenta",
      texto: "El ojito tapa los montos, para mostrar la app sin mostrar tu plata. En tu foto están los ajustes y las preguntas frecuentes.",
    },
  ];

  function terminarRecorrido(como: "hecho" | "omitido") {
    setRecorridoVisto(true);
    setPedido(false);
    olvidarRecorridoPedido();
    // Quien lo pidió de nuevo ya lo tenía guardado: no hace falta escribir otra vez.
    if (!f.data?.config?.recorrido) void marcarRecorrido(como);
  }

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <h1 className="titulo text-2xl font-bold">Hola, {nombre}</h1>
          <SelectorMes className="-mx-2" />
        </div>

        {/* El número del mes */}
        <section data-recorrido="mes" className="relative overflow-hidden rounded-2xl bg-acento px-5 pb-5 pt-5 text-white">
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

          {/* Lo que te quedó, partido: lo que apartaste y lo que tenés a mano. */}
          {(r.ingresos.total > 0 || r.ahorrado > 0) && (
            <div className="mt-5 border-t border-white/15 pt-4">
              <div data-recorrido="ahorro" className="flex items-end justify-between gap-3 rounded-xl">
                <div className="grid flex-1 grid-cols-2 gap-3">
                  <button type="button" onClick={() => setAhorrando(true)} className="text-left">
                    <p className="text-xs font-medium text-white/80">Ahorrado</p>
                    <p className="numero mt-1 text-lg font-bold">
                      <Monto valor={r.ahorrado} />
                    </p>
                  </button>
                  <div>
                    <p className="text-xs font-medium text-white/80">Disponible</p>
                    <p className="numero mt-1 text-lg font-bold">
                      <Monto valor={r.disponible} />
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAhorrando(true)}
                  className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-lima px-4 text-sm font-bold text-tinta transition-transform duration-100 active:scale-[0.95]"
                >
                  <IconoMas />
                  Ahorrar
                </button>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20" role="presentation">
                <div
                  // Lleno = apartaste lo que te propusiste. En lima cuando llegás.
                  className={`h-full rounded-full transition-[width] duration-300 ease-[var(--ease-quart)] ${
                    llega ? "bg-lima" : "bg-celeste"
                  }`}
                  style={{ width: `${avance}%` }}
                />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-white/90">
                {llega && <Emoji nombre="chispas" tamano="xs" />}
                {llega
                  ? `¡Meta cumplida! ${r.ahorroPct}% de lo que entró`
                  : oculto
                    ? `Meta ${r.ahorroPct}%`
                    : `Meta ${r.ahorroPct}% · ${plata(meta)}`}
              </p>
            </div>
          )}
        </section>

        {/* Cargar algo: a un toque */}
        <div data-recorrido="cargar" className="rounded-2xl">
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
        </div>

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

      {ahorrando && (
        <PanelAhorro
          cerrar={() => setAhorrando(false)}
          mes={f.mes}
          falta={meta - r.ahorrado}
          ahorros={ahorrosDelMes}
          ultimoTipoCambio={ultimoDolar}
          recargar={f.recargar}
        />
      )}

      {enRecorrido && <Recorrido pasos={pasos} terminar={terminarRecorrido} />}

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
