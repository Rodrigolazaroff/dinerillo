"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Asistente } from "@/components/Asistente";
import { colorCategoria, emojiCategoria } from "@/components/Categorias";
import { BurbujaEmoji, Emoji } from "@/components/Emoji";
import { FormFijo } from "@/components/FormFijo";
import { FormMovimiento } from "@/components/FormMovimiento";
import { IconoDivision, IconoFlecha, IconoMas } from "@/components/iconos";
import { Monto } from "@/components/Privado";
import { SelectorMes } from "@/components/SelectorMes";
import { Shell } from "@/components/Shell";
import { Aviso, BarraParte, Boton, BotonFlotante, Card, Cargando, Vacio } from "@/components/ui";
import { fechaDia, periodoLargo, plata } from "@/lib/format";
import { fijosDelMes, sugerirFijos, type FijoDelMes, type SugerenciaFijo } from "@/lib/finanzas";
import type { GastoFijo, MiGasto } from "@/lib/types";
import { usaDivision } from "@/lib/useData";
import { useFinanzas } from "@/lib/useFinanzas";
import { leerParametro, usarParametro } from "@/lib/useMes";

// Tus gastos del mes. Los compartidos no se cargan acá: viven en División y
// aparecen como una sola línea con tu parte. Si corregís uno allá, acá se
// actualiza solo, porque no hay copia.


export default function Gastos() {
  const { data, error, recargar, resumen, anterior, mes, prefs, entradas } = useFinanzas();
  const [nuevo, setNuevo] = useState(() => usarParametro("nuevo"));
  const [editando, setEditando] = useState<MiGasto | null>(null);
  // Un fijo para cargar este mes (desde el aviso "Confirmá la luz").
  const [pedido] = useState(() => leerParametro("fijo"));
  const [cargandoFijo, setCargandoFijo] = useState<FijoDelMes | null>(null);
  const [usado, setUsado] = useState(false);
  const [fijoAbierto, setFijoAbierto] = useState<{ fijo?: GastoFijo; sugerencia?: SugerenciaFijo } | null>(null);

  const fijos = useMemo(() => (entradas ? fijosDelMes(entradas, mes) : []), [entradas, mes]);
  const sugeridos = useMemo(
    () => (entradas && data ? sugerirFijos(entradas, data.hoy) : []),
    [entradas, data]
  );
  const desdeAviso = !usado && pedido ? fijos.find((f) => f.fijo.id === pedido) : undefined;
  const fijoEnCurso = cargandoFijo ?? (desdeAviso && !desdeAviso.cargado ? desdeAviso : null);

  const propios = useMemo(
    () =>
      (data?.misGastos ?? [])
        .filter((g) => !g.deleted_at && g.periodo === mes)
        .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at)),
    [data, mes]
  );

  if (error) {
    return (
      <Shell>
        <Aviso tipo="error">{error.message}</Aviso>
      </Shell>
    );
  }
  if (!data || !resumen) {
    return (
      <Shell>
        <Cargando />
      </Shell>
    );
  }

  const cats = new Map(data.categorias.map((c) => [c.id, c]));
  const g = resumen.gastos;
  const delta = anterior ? g.total - anterior.gastos.total : 0;
  const porDia = new Map<string, MiGasto[]>();
  for (const x of propios) porDia.set(x.fecha, [...(porDia.get(x.fecha) ?? []), x]);

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="titulo text-2xl font-bold">Gastos</h1>
          <SelectorMes />
        </div>

        <section className="relative overflow-hidden rounded-2xl bg-celeste-claro px-5 py-5">
          <Emoji nombre="plata-vuela" tamano="xxl" className="pop pointer-events-none absolute -right-1 -top-1 h-20 w-20 rotate-12" />
          <p className="text-sm font-medium text-suave">Gastaste</p>
          <p className="numero mt-2 text-[2.6rem] font-extrabold text-tinta">
            <Monto valor={g.total} animado />
          </p>
          {g.compartidos > 0 && (
            <p className="mt-2 text-xs text-suave">
              Tuyos <span className="tabular font-medium text-tinta"><Monto valor={g.propios} /></span>
              {" · "}
              compartidos <span className="tabular font-medium text-tinta"><Monto valor={g.compartidos} /></span>
            </p>
          )}
          {anterior && anterior.gastos.total > 0 && (
            <p className={`mt-1.5 text-xs font-semibold ${delta > 0 ? "text-espera" : "text-ok"}`}>
              {delta > 0 ? "▲" : "▼"} <Monto valor={Math.abs(delta)} /> vs. {periodoLargo(anterior.periodo)}
            </p>
          )}
          <Asistente modo="gasto" className="mt-4 [&>*]:flex-1 sm:[&>*]:flex-none" />
          {/* En el celular está el "+" flotante; acá solo en pantalla grande. */}
          <div className="mt-4 hidden sm:block">
            <Boton onClick={() => setNuevo(true)}>
              <IconoMas />
              Nuevo gasto
            </Boton>
          </div>
        </section>

        {g.categorias.length > 0 && (
          <Card titulo="Por categoría">
            <ul className="flex flex-col gap-3 px-4 py-4 sm:px-5">
              {g.categorias.map((c) => (
                <li key={c.id || "sin"} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Emoji nombre={c.emoji} tamano="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.nombre}</span>
                    <span className="tabular font-semibold">
                      <Monto valor={c.total} />
                    </span>
                  </div>
                  <BarraParte parte={c.total} total={g.total} color={colorCategoria(c.color)} />
                  {c.compartidos > 0 && c.propios > 0 && (
                    <p className="text-[11px] text-tenue">
                      <Monto valor={c.propios} /> tuyos · <Monto valor={c.compartidos} /> compartidos
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card
            titulo="Fijos del mes"
            accion={
              <Boton variante="secundario" tamano="sm" onClick={() => setFijoAbierto({})}>
                <IconoMas />
                Nuevo
              </Boton>
            }
          >
            <ul className="divide-y divide-linea">
              {fijos.map((f) => (
                <li key={f.fijo.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <button type="button" onClick={() => setFijoAbierto({ fijo: f.fijo })} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium">{f.fijo.descripcion}</p>
                    <p className="text-[11px] text-tenue">
                      día {f.dia} · {f.fijo.automatico ? "se carga solo" : `≈ ${plata(f.estimado)}`}
                      {f.fijo.compartido && " · compartido"}
                    </p>
                  </button>
                  {f.cargado ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-ok">
                      <Emoji nombre="check" tamano="xs" /> Cargado
                    </span>
                  ) : (
                    <Boton tamano="sm" onClick={() => setCargandoFijo(f)}>
                      Cargar
                    </Boton>
                  )}
                </li>
              ))}
              {fijos.length === 0 && sugeridos.length === 0 && (
                <li>
                  <button
                    type="button"
                    onClick={() => setFijoAbierto({})}
                    className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm sm:px-5"
                  >
                    <Emoji nombre="calendario" tamano="md" />
                    <span className="flex-1 text-suave">Alquiler, Netflix, la luz: cargalos una vez.</span>
                  </button>
                </li>
              )}
              {sugeridos.map((s) => (
                <li key={s.descripcion} className="flex items-center gap-3 bg-celeste-claro/60 px-4 py-2.5 sm:px-5">
                  <Emoji nombre="pensando" tamano="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">¿{s.descripcion.trim()} es fijo?</p>
                    <p className="text-[11px] text-tenue">
                      Se repite cada mes · {s.automatico ? plata(s.monto) : `≈ ${plata(s.monto)}, varía`}
                    </p>
                  </div>
                  <Boton variante="secundario" tamano="sm" onClick={() => setFijoAbierto({ sugerencia: s })}>
                    Sí
                  </Boton>
                </li>
              ))}
            </ul>
          </Card>

        <Card titulo="Movimientos">
          {resumen.division.cantidad > 0 && (
            <Link
              href="/division"
              className="flex items-center gap-3 border-b border-linea px-4 py-3 hover:bg-fondo sm:px-5"
            >
              <BurbujaEmoji nombre="corazones" tono="azul" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Compartidos con {prefs.pareja || "tu pareja"}</p>
                <p className="text-[11px] text-tenue">
                  {resumen.division.cantidad} {resumen.division.cantidad === 1 ? "gasto" : "gastos"} · tu parte
                </p>
              </div>
              <span className="tabular text-sm font-semibold">
                <Monto valor={g.compartidos} />
              </span>
              <IconoFlecha className="text-tenue" />
            </Link>
          )}

          {propios.length === 0 ? (
            <Vacio
              emoji="brote"
              titulo="Cero gastos. ¿Mes austero?"
              accion={
                <Boton onClick={() => setNuevo(true)}>
                  <IconoMas />
                  Cargar un gasto
                </Boton>
              }
            />
          ) : (
            <div>
              {[...porDia.entries()].map(([dia, xs]) => (
                <div key={dia}>
                  <p className="bg-fondo/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-tenue sm:px-5">
                    {fechaDia(dia)}
                  </p>
                  <ul className="divide-y divide-linea">
                    {xs.map((x) => {
                      const c = x.categoria_id ? cats.get(x.categoria_id) : undefined;
                      return (
                        <li key={x.id}>
                          <button
                            type="button"
                            onClick={() => setEditando(x)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-fondo sm:px-5"
                          >
                            <BurbujaEmoji nombre={emojiCategoria(c)} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{x.descripcion}</p>
                              <p className="truncate text-[11px] text-tenue">
                                {c && !c.deleted_at ? c.nombre : "Sin categoría"}
                                {x.nota && ` · ${x.nota}`}
                              </p>
                            </div>
                            <span className="tabular text-sm font-semibold">
                              <Monto valor={x.monto} />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <BotonFlotante onClick={() => setNuevo(true)} label="Nuevo gasto" />

      {fijoEnCurso && (
        <FormMovimiento
          key={`fijo-${fijoEnCurso.fijo.id}`}
          modo={fijoEnCurso.fijo.compartido ? "compartido" : "propio"}
          puedeCompartir={false}
          abierto
          cerrar={() => {
            setCargandoFijo(null);
            setUsado(true);
          }}
          inicial={{
            monto: fijoEnCurso.estimado,
            descripcion: fijoEnCurso.fijo.descripcion,
            categoria_id: fijoEnCurso.fijo.categoria_id,
            fecha: `${mes}-${String(fijoEnCurso.dia).padStart(2, "0")}`,
            pago: fijoEnCurso.fijo.pago,
            mi_pct: fijoEnCurso.fijo.mi_pct,
            fijo_id: fijoEnCurso.fijo.id,
          }}
          mes={mes}
          categorias={data.categorias}
          pareja={prefs.pareja}
          miPctDefault={prefs.divMiPct}
          recargar={recargar}
        />
      )}

      {fijoAbierto && (
        <FormFijo
          key={fijoAbierto.fijo?.id ?? fijoAbierto.sugerencia?.descripcion ?? "nuevo"}
          cerrar={() => setFijoAbierto(null)}
          fijo={fijoAbierto.fijo}
          sugerencia={fijoAbierto.sugerencia}
          categorias={data.categorias}
          puedeCompartir={usaDivision(data)}
          pareja={prefs.pareja}
          miPctDefault={prefs.divMiPct}
          recargar={recargar}
        />
      )}

      {(nuevo || editando) && (
        <FormMovimiento
          key={editando?.id ?? "nuevo"}
          modo="propio"
          puedeCompartir={usaDivision(data)}
          abierto
          cerrar={() => {
            setNuevo(false);
            setEditando(null);
          }}
          gasto={editando ?? undefined}
          mes={mes}
          categorias={data.categorias}
          pareja={prefs.pareja}
          miPctDefault={prefs.divMiPct}
          recargar={recargar}
        />
      )}
    </Shell>
  );
}
