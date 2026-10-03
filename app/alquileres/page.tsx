"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Emoji } from "@/components/Emoji";
import { FormCobro } from "@/components/FormCobro";
import { IconoAlerta, IconoCheck, IconoMas, IconoTacho } from "@/components/iconos";
import { Monto } from "@/components/Privado";
import { Shell } from "@/components/Shell";
import { Aviso, Boton, Card, Cargando, clasesBoton, Estado, Fila, Vacio } from "@/components/ui";
import { proximoAumento, type Aumento, type Cuota } from "@/lib/calc";
import { fechaCorta, fechaDia, pct, periodoCorto, periodoLargo } from "@/lib/format";
import type { Contrato, Propiedad } from "@/lib/types";
import { enviar, useData } from "@/lib/useData";

// La pestaña que se abre dos veces por mes: cuánto falta cobrar, quién debe y
// cargar la transferencia. Lo del año y el historial quedan abajo, de contexto.

interface Pendiente {
  cuota: Cuota;
  contrato: Contrato;
  propiedad: Propiedad | null;
}

const nombreDe = (p: Pendiente) => p.propiedad?.nombre ?? "Sin propiedad";

/** "10 de octubre", y con el año si no es este: una deuda vieja no se confunde. */
function vencimiento(q: Cuota, anio: string): string {
  const dia = fechaDia(q.vence);
  return q.vence.startsWith(anio) ? dia : `${dia} de ${q.vence.slice(0, 4)}`;
}

/** 15 -> "15%", 15.5 -> "15,5%" */
const comoPct = (n: number) => pct(n / 100, Number.isInteger(n) ? 0 : 1);

export default function Cobros() {
  const { data, error, cargando, recargar, puedeEditar } = useData();
  const [elegida, setElegida] = useState<Pendiente | null>(null);
  const [confirmando, setConfirmando] = useState("");
  const [aviso, setAviso] = useState("");

  // Todo lo que falta cobrar, de todos los contratos, por vencimiento: lo más
  // viejo primero, que es lo que hay que reclamar.
  const pendientes = useMemo<Pendiente[]>(() => {
    if (!data) return [];
    return data.calculados
      .flatMap((cc) =>
        cc.cuotas
          .filter((q) => q.estado === "vencido" || q.estado === "pendiente" || q.estado === "parcial")
          .map((cuota) => ({ cuota, contrato: cc.contrato, propiedad: cc.propiedad }))
      )
      .sort((a, b) => a.cuota.vence.localeCompare(b.cuota.vence));
  }, [data]);

  const cobradas = useMemo<Pendiente[]>(() => {
    if (!data) return [];
    return data.calculados
      .flatMap((cc) =>
        cc.cuotas
          .filter((q) => q.cobrado > 0)
          .map((cuota) => ({ cuota, contrato: cc.contrato, propiedad: cc.propiedad }))
      )
      .sort((a, b) => b.cuota.periodo.localeCompare(a.cuota.periodo));
  }, [data]);

  // El aumento que viene primero, de todos los contratos que siguen.
  const aumento = useMemo<{ nombre: string; a: Aumento } | null>(() => {
    if (!data) return null;
    let mejor: { nombre: string; a: Aumento } | null = null;
    for (const cc of data.calculados) {
      if (cc.estado === "terminado") continue;
      const a = proximoAumento(cc, data.resumen.periodoActual);
      if (a && (!mejor || a.periodo < mejor.a.periodo)) {
        mejor = { nombre: cc.propiedad?.nombre || cc.contrato.inquilino, a };
      }
    }
    return mejor;
  }, [data]);

  async function borrarCobro(id: string) {
    setAviso("");
    const r = await enviar("/api/cobros", "DELETE", { id });
    setConfirmando("");
    if (!r.ok) {
      setAviso(r.error);
      return;
    }
    recargar();
  }

  if (error) {
    return (
      <Shell>
        <Aviso tipo="error">{error.message}</Aviso>
      </Shell>
    );
  }
  if (cargando || !data) {
    return (
      <Shell>
        <Cargando />
      </Shell>
    );
  }

  if (data.calculados.length === 0) {
    return (
      <Shell>
        <Card>
          <Vacio
            emoji="llave"
            titulo="Sin contratos todavía"
            accion={
              <Link href="/alquileres/contratos" className={`${clasesBoton()} min-h-11`}>
                <IconoMas /> Cargar el primer contrato
              </Link>
            }
          >
            Cargá una propiedad y su contrato: los meses se arman solos.
          </Vacio>
        </Card>
      </Shell>
    );
  }

  const { resumen } = data;
  const anio = resumen.periodoActual.slice(0, 4);
  const mesNombre = periodoLargo(resumen.periodoActual).split(" ")[0];
  const sinCuotas = resumen.mes.cuotas === 0;
  const todoCobrado = !sinCuotas && resumen.mes.falta <= 0;
  const avance =
    resumen.mes.esperado > 0 ? Math.min(100, Math.max(0, (resumen.mes.cobrado / resumen.mes.esperado) * 100)) : 0;
  const delAnio = resumen.anioALaFecha;

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        {/* El número que importa cuando abrís la pestaña: qué falta cobrar. */}
        <section className="relative overflow-hidden rounded-2xl bg-acento px-5 py-5 text-white">
          <Emoji
            nombre={todoCobrado ? "check" : "llave"}
            tamano="xxl"
            className="pop pointer-events-none absolute -right-1 -top-1 h-20 w-20 rotate-12"
          />
          {todoCobrado || sinCuotas ? (
            <>
              <p className="text-sm font-medium capitalize text-white/80">{mesNombre}</p>
              <p className="numero mt-2 flex items-center gap-2.5 text-[2.1rem] font-extrabold sm:text-[2.6rem]">
                {sinCuotas ? (
                  "Nada que cobrar"
                ) : (
                  <>
                    Todo cobrado
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lima text-tinta">
                      <IconoCheck className="h-5 w-5" />
                    </span>
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-white/80">Falta cobrar · {mesNombre}</p>
              <p className="numero mt-2 text-[2.6rem] font-extrabold">
                <Monto valor={resumen.mes.falta} animado />
              </p>
            </>
          )}

          {!sinCuotas && (
            <div className="mt-5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/20" role="presentation">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ease-[var(--ease-quart)] ${
                    todoCobrado ? "bg-lima" : "bg-celeste"
                  }`}
                  style={{ width: `${avance}%` }}
                />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-white/90">
                {todoCobrado && <Emoji nombre="chispas" tamano="xs" />}
                {resumen.mes.cobradas} de {resumen.mes.cuotas} cobrados
                {todoCobrado && ". Buen mes."}
              </p>
            </div>
          )}
        </section>

        {resumen.deudaVencida > 0 && (
          <p className="flex items-center gap-2.5 rounded-xl bg-peligro-claro px-4 py-3 text-sm text-peligro ring-1 ring-inset ring-peligro/20">
            <IconoAlerta className="h-5 w-5 shrink-0" />
            <span>
              <span className="tabular font-semibold">
                <Monto valor={resumen.deudaVencida} />
              </span>{" "}
              atrasados <span className="text-peligro/80">· con mora a hoy</span>
            </span>
          </p>
        )}

        <Aviso tipo="error">{aviso}</Aviso>

        {pendientes.length > 0 && (
          <Card titulo="Por cobrar">
            <ul className="lista-entra divide-y divide-linea">
              {pendientes.map((p) => {
                const q = p.cuota;
                return (
                  <li key={`${p.contrato.id}-${q.periodo}`}>
                    <button
                      type="button"
                      onClick={() => puedeEditar && setElegida(p)}
                      disabled={!puedeEditar}
                      className="fila-hover flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-default sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {nombreDe(p)}
                          <span className="font-normal text-suave"> · {p.contrato.inquilino}</span>
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-suave">
                          <span>
                            {q.estado === "vencido" ? "venció el" : "vence el"} {vencimiento(q, anio)}
                          </span>
                          {q.diasMora > 0 && (
                            <span className="inline-flex items-center gap-1 text-peligro">
                              <IconoAlerta className="h-3 w-3" />
                              {q.diasMora} {q.diasMora === 1 ? "día" : "días"} de mora
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular text-sm font-semibold">
                          <Monto valor={q.esperado - q.cobrado} />
                        </p>
                        <Estado estado={q.estado} className="mt-1" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {aumento && (
          <p className="flex items-center gap-3 rounded-2xl bg-celeste-claro px-4 py-3 text-sm">
            <Emoji nombre="grafico" tamano="md" />
            <span className="min-w-0 flex-1">
              <span className="text-suave">Próximo aumento:</span> {aumento.nombre} ·{" "}
              {periodoCorto(aumento.a.periodo)} →{" "}
              <span className="tabular font-semibold">
                <Monto valor={aumento.a.bruto} />
              </span>{" "}
              <span className="text-suave">(+{comoPct(aumento.a.pct)})</span>
            </span>
          </p>
        )}

        {(delAnio.neto > 0 || delAnio.comision > 0) && (
          <Card className="px-4 py-2 sm:px-5">
            <Fila label={`Te dejó en ${anio}`} valor={<Monto valor={delAnio.neto} />} fuerte />
            {delAnio.comision > 0 && (
              <Fila label="Se llevó la inmobiliaria" valor={<Monto valor={delAnio.comision} />} />
            )}
          </Card>
        )}

        {cobradas.length > 0 && (
          <details className="rounded-2xl border border-borde bg-papel">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-medium text-suave sm:px-5">
              Cobros anteriores ({cobradas.length})
            </summary>
            <ul className="divide-y divide-linea border-t border-borde">
              {cobradas.map((p) => {
                const q = p.cuota;
                return (
                  <li key={`${p.contrato.id}-${q.periodo}`} className="px-4 py-3 sm:px-5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {nombreDe(p)}
                          <span className="font-normal text-suave"> · {periodoCorto(q.periodo)}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-suave">
                          {q.fechaCobro ? `entró el ${fechaCorta(q.fechaCobro)}` : "sin fecha"}
                          {q.recargo > 0 && (
                            <>
                              {" · con "}
                              <Monto valor={q.recargo} /> de mora
                            </>
                          )}
                          {q.diferencia >= 1 && (
                            <>
                              {" · "}
                              <Monto valor={q.diferencia} /> de más
                            </>
                          )}
                          {q.diferencia <= -1 && (
                            <>
                              {" · faltaron "}
                              <Monto valor={-q.diferencia} />
                            </>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular text-sm font-semibold text-ok">
                          <Monto valor={q.cobrado} />
                        </p>
                        <Estado estado={q.estado} className="mt-1" />
                      </div>
                    </div>

                    {puedeEditar && q.cobros.length > 0 && (
                      <ul className="mt-2 flex flex-col border-t border-linea pt-1">
                        {q.cobros.map((c) => (
                          <li key={c.id} className="flex items-center justify-between gap-2 text-[11px] text-suave">
                            <span className="tabular min-w-0 truncate">
                              {fechaCorta(c.fecha_cobro)} · <Monto valor={c.importe} />
                              {c.nota && <span className="text-tenue"> · {c.nota}</span>}
                            </span>
                            {confirmando === c.id ? (
                              <span className="flex shrink-0 items-center gap-1">
                                <Boton
                                  variante="peligro"
                                  tamano="sm"
                                  className="min-h-11 sm:min-h-9"
                                  onClick={() => borrarCobro(c.id)}
                                >
                                  Sí, borrar
                                </Boton>
                                <Boton
                                  variante="fantasma"
                                  tamano="sm"
                                  className="min-h-11 sm:min-h-9"
                                  onClick={() => setConfirmando("")}
                                >
                                  No
                                </Boton>
                              </span>
                            ) : (
                              <Boton
                                variante="fantasma"
                                tamano="icono"
                                onClick={() => setConfirmando(c.id)}
                                aria-label="Borrar este cobro"
                              >
                                <IconoTacho />
                              </Boton>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>

      <FormCobro
        abierto={!!elegida}
        cerrar={() => setElegida(null)}
        cuota={elegida?.cuota ?? null}
        contrato={elegida?.contrato ?? null}
        propiedad={elegida?.propiedad ?? null}
        alDeGuardar={() => {
          setElegida(null);
          recargar();
        }}
      />
    </Shell>
  );
}
