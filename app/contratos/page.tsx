"use client";

import { useMemo, useState } from "react";
import { FormContrato, aNumero } from "@/components/FormContrato";
import { FormPropiedad, LABEL_TIPO } from "@/components/FormPropiedad";
import { Shell } from "@/components/Shell";
import { IconoLapiz, IconoMas, IconoTacho } from "@/components/iconos";
import {
  Aviso, Boton, Campo, Cargando, Card, Estado, InputPlata, Kpi, Panel, Textarea, Vacio,
} from "@/components/ui";
import type { ContratoCalculado, EstadoContrato, Cuota } from "@/lib/calc";
import {
  fechaCorta, pct, periodoCorto, periodoLargo, plata, plataCorta,
} from "@/lib/format";
import type { Contrato, Propiedad } from "@/lib/types";
import { enviar, useData } from "@/lib/useData";

/** Los % del contrato vienen como enteros (15 = 15%), `pct` espera una razón. */
function pctCorto(v: number): string {
  return pct(v / 100, Number.isInteger(v) ? 0 : 1);
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/**
 * Las condiciones del contrato en un renglón.
 *
 * Se saltean los pedazos que no aplican: si no cobrás mora no se menciona la
 * mora, y un contrato sin aumentos lo dice en lugar de mostrar un 0%.
 */
function lineaCondiciones(c: Contrato, inicio: string): string {
  const partes = [`${plata(c.alquiler_inicial)} inicial`];

  if (c.ajuste_tipo === "porcentaje" && c.aumento_pct > 0) {
    partes.push(
      `+${pctCorto(c.aumento_pct)} cada ${c.aumento_meses} ${plural(c.aumento_meses, "mes", "meses")}`
    );
  } else {
    partes.push("sin aumentos");
  }

  if (c.comision_pct > 0) partes.push(`comisión ${pctCorto(c.comision_pct)}`);
  partes.push(`${c.meses} ${plural(c.meses, "mes", "meses")} desde ${periodoCorto(inicio)}`);
  partes.push(`vence el ${c.dia_vencimiento}`);
  if (c.mora_pct_diario > 0) partes.push(`mora ${pctCorto(c.mora_pct_diario)}/día`);
  if (c.prorrateo_pct > 0) partes.push(`paga ${pctCorto(c.prorrateo_pct)} de servicios`);

  return partes.join(" · ");
}

const ORDEN_ESTADO: Record<EstadoContrato, number> = { vigente: 0, por_empezar: 1, terminado: 2 };

function Chip({ estado }: { estado: EstadoContrato }) {
  const { texto, clase } = {
    vigente: { texto: "vigente", clase: "bg-ok-claro text-ok ring-ok/20" },
    por_empezar: { texto: "arranca pronto", clase: "bg-acento-claro text-acento ring-acento/20" },
    terminado: { texto: "terminado", clase: "bg-fondo text-tenue ring-borde" },
  }[estado];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${clase}`}
    >
      {texto}
    </span>
  );
}

/** Borrar en dos toques: el botón se arma primero y recién después ejecuta. */
function BotonBorrar({
  armado,
  ocupado,
  armar,
  cancelar,
  ejecutar,
  etiqueta,
}: {
  armado: boolean;
  ocupado: boolean;
  armar: () => void;
  cancelar: () => void;
  ejecutar: () => void;
  etiqueta: string;
}) {
  if (!armado) {
    return (
      <Boton variante="fantasma" tamano="icono" onClick={armar} aria-label={etiqueta}>
        <IconoTacho />
      </Boton>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Boton variante="peligro" tamano="sm" className="min-h-11 sm:min-h-9" onClick={ejecutar} disabled={ocupado}>
        {ocupado ? "Borrando…" : "¿Seguro?"}
      </Boton>
      <Boton variante="fantasma" tamano="sm" className="min-h-11 sm:min-h-9" onClick={cancelar} disabled={ocupado}>
        No
      </Boton>
    </span>
  );
}

export default function ContratosPage() {
  const { data, error, cargando, recargar, puedeEditar } = useData();

  const [formContrato, setFormContrato] = useState<{ abierto: boolean; contrato?: Contrato }>({
    abierto: false,
  });
  const [formPropiedad, setFormPropiedad] = useState<{ abierto: boolean; propiedad?: Propiedad }>({
    abierto: false,
  });
  const [desplegados, setDesplegados] = useState<Record<string, boolean>>({});
  const [armado, setArmado] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [errorAccion, setErrorAccion] = useState("");

  const [fijar, setFijar] = useState<{
    contratoId: string;
    periodo: string;
    proyectado: number;
  } | null>(null);
  const [montoFijar, setMontoFijar] = useState("");
  const [notaFijar, setNotaFijar] = useState("");
  const [errorFijar, setErrorFijar] = useState("");
  const [guardandoFijar, setGuardandoFijar] = useState(false);

  const propiedades = useMemo(
    () =>
      (data?.propiedades ?? [])
        .filter((p) => !p.deleted_at)
        .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)),
    [data?.propiedades]
  );

  const alquileres = useMemo(
    () => (data?.alquileres ?? []).filter((a) => !a.deleted_at),
    [data?.alquileres]
  );

  // Los vigentes arriba: es lo que se mira todos los meses.
  const contratos = useMemo(
    () =>
      [...(data?.calculados ?? [])].sort(
        (a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado]
      ),
    [data?.calculados]
  );

  const periodoHoy = data?.hoy?.slice(0, 7) ?? "";

  const alquilerFijado = (contratoId: string, periodo: string) =>
    alquileres.find((a) => a.contrato_id === contratoId && a.periodo === periodo);

  const contratosVivosDe = (propiedadId: string) =>
    (data?.contratos ?? []).filter((c) => !c.deleted_at && c.propiedad_id === propiedadId).length;

  function abrirContrato(contrato?: Contrato) {
    setErrorAccion("");
    setArmado("");
    setFormContrato({ abierto: true, contrato });
  }

  function abrirPropiedad(propiedad?: Propiedad) {
    setErrorAccion("");
    setArmado("");
    setFormPropiedad({ abierto: true, propiedad });
  }

  function abrirFijar(cc: ContratoCalculado, cuota: Cuota) {
    setFijar({ contratoId: cc.contrato.id, periodo: cuota.periodo, proyectado: cuota.bruto });
    setMontoFijar(String(Math.round(cuota.bruto)));
    setNotaFijar("");
    setErrorFijar("");
    setGuardandoFijar(false);
  }

  async function borrar(url: string, id: string) {
    setOcupado(id);
    setErrorAccion("");
    const r = await enviar(url, "DELETE", { id });
    setOcupado("");
    if (!r.ok) {
      setErrorAccion(r.error);
      return;
    }
    setArmado("");
    recargar();
  }

  async function guardarFijado() {
    if (!fijar) return;
    const monto = aNumero(montoFijar);
    if (monto <= 0) {
      setErrorFijar("Poné el importe que se cobra este mes.");
      return;
    }
    setErrorFijar("");
    setGuardandoFijar(true);
    const r = await enviar("/api/alquileres", "POST", {
      contrato_id: fijar.contratoId,
      periodo: fijar.periodo,
      monto,
      nota: notaFijar.trim(),
    });
    setGuardandoFijar(false);
    if (!r.ok) {
      setErrorFijar(r.error);
      return;
    }
    setFijar(null);
    recargar();
  }

  if (error) {
    return (
      <Shell>
        <Aviso tipo="error">{error.message}</Aviso>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <Card>{cargando ? <Cargando /> : <Aviso tipo="info">Sin datos todavía.</Aviso>}</Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Contratos</h1>
            <p className="text-xs text-suave">
              Las condiciones las guarda cada contrato. Acá las cambiás sin tocar los demás.
            </p>
          </div>
          {puedeEditar && (
            <div className="flex flex-wrap gap-2">
              <Boton className="min-h-11 sm:min-h-9" onClick={() => abrirContrato()} disabled={propiedades.length === 0}>
                <IconoMas />
                Contrato nuevo
              </Boton>
              <Boton variante="secundario" className="min-h-11 sm:min-h-9" onClick={() => abrirPropiedad()}>
                <IconoMas />
                Propiedad nueva
              </Boton>
            </div>
          )}
        </header>

        {errorAccion && <Aviso tipo="error">{errorAccion}</Aviso>}

        {propiedades.length === 0 ? (
          <Card>
            <Vacio
              titulo="Primero cargá una propiedad"
              accion={
                puedeEditar ? (
                  <Boton className="min-h-11 sm:min-h-9" onClick={() => abrirPropiedad()}>
                    <IconoMas />
                    Propiedad nueva
                  </Boton>
                ) : undefined
              }
            >
              La casa, el local, la cochera. Después le colgás el contrato con sus condiciones:
              el alquiler, cada cuánto aumenta y cuánto se lleva la inmobiliaria.
            </Vacio>
          </Card>
        ) : contratos.length === 0 ? (
          <Card>
            <Vacio
              titulo="Ninguna propiedad tiene contrato"
              accion={
                puedeEditar ? (
                  <Boton className="min-h-11 sm:min-h-9" onClick={() => abrirContrato()}>
                    <IconoMas />
                    Contrato nuevo
                  </Boton>
                ) : undefined
              }
            >
              Cargá el contrato con lo que pactaste esta vez y vas a ver la escalera de los
              próximos meses antes de guardarlo.
            </Vacio>
          </Card>
        ) : (
          contratos.map((cc) => {
            const c = cc.contrato;
            const abierta = !!desplegados[c.id];
            const delMes = cc.cuotas.find((q) => q.periodo === periodoHoy) ?? null;

            return (
              <Card
                key={c.id}
                titulo={
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate">{cc.propiedad?.nombre ?? "Sin propiedad"}</span>
                    <span className="text-tenue">·</span>
                    <span className="truncate font-normal text-suave">{c.inquilino}</span>
                    <Chip estado={cc.estado} />
                  </span>
                }
                nota={lineaCondiciones(c, c.fecha_inicio.slice(0, 7))}
                accion={
                  puedeEditar && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Boton
                        variante="fantasma"
                        tamano="icono"
                        onClick={() => abrirContrato(c)}
                        aria-label="Editar contrato"
                      >
                        <IconoLapiz />
                      </Boton>
                      <BotonBorrar
                        armado={armado === `c:${c.id}`}
                        ocupado={ocupado === c.id}
                        armar={() => {
                          setErrorAccion("");
                          setArmado(`c:${c.id}`);
                        }}
                        cancelar={() => setArmado("")}
                        ejecutar={() => borrar("/api/contratos", c.id)}
                        etiqueta="Borrar contrato"
                      />
                    </div>
                  )
                }
              >
                <div className="grid grid-cols-2 gap-2 px-4 py-3 sm:px-5 lg:grid-cols-4">
                  <Kpi
                    etiqueta={periodoHoy ? periodoCorto(periodoHoy) : "Este mes"}
                    valor={delMes ? plata(delMes.bruto) : "—"}
                    detalle={delMes ? `vence el ${fechaCorta(delMes.vence)}` : "fuera del contrato"}
                  />
                  <Kpi
                    etiqueta="Te queda"
                    valor={delMes ? plata(delMes.neto) : "—"}
                    detalle={
                      c.comision_pct > 0
                        ? `después de ${pctCorto(c.comision_pct)} de comisión`
                        : "sin comisión"
                    }
                  />
                  <Kpi
                    etiqueta="Cobrado"
                    valor={plataCorta(cc.totales.cobrado)}
                    detalle={`de ${plataCorta(cc.totales.esperado)} del contrato`}
                    tono="ok"
                  />
                  {cc.totales.deuda > 0 ? (
                    <Kpi
                      etiqueta="Deuda"
                      valor={plata(cc.totales.deuda)}
                      detalle="cuotas vencidas o a medias"
                      tono="peligro"
                    />
                  ) : (
                    <Kpi
                      etiqueta="Termina"
                      valor={periodoCorto(cc.fin)}
                      detalle={cc.proxima ? `próxima: ${periodoCorto(cc.proxima.periodo)}` : "sin cuotas pendientes"}
                    />
                  )}
                </div>

                {c.nota && (
                  <p className="px-4 pb-3 text-xs leading-relaxed text-suave sm:px-5">{c.nota}</p>
                )}

                <div className="px-4 pb-3 sm:px-5">
                  <Boton
                    variante="secundario"
                    tamano="sm"
                    className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                    aria-expanded={abierta}
                    onClick={() => setDesplegados((d) => ({ ...d, [c.id]: !d[c.id] }))}
                  >
                    {abierta
                      ? "Ocultar los meses"
                      : `Ver los ${cc.cuotas.length} ${plural(cc.cuotas.length, "mes", "meses")}`}
                  </Boton>
                </div>

                {abierta && (
                  <div className="aparece scroll-x border-t border-borde">
                    <table className="w-full min-w-[58rem] text-xs">
                      <thead>
                        <tr className="border-b border-linea text-left text-[11px] text-tenue">
                          <th className="px-3 py-2 font-medium">#</th>
                          <th className="px-2 py-2 font-medium">Período</th>
                          <th className="px-2 py-2 text-right font-medium">Bruto</th>
                          <th className="px-2 py-2 text-right font-medium">Comisión</th>
                          <th className="px-2 py-2 text-right font-medium">Neto</th>
                          <th className="px-2 py-2 text-right font-medium">Reintegro</th>
                          <th className="px-2 py-2 text-right font-medium">Esperado</th>
                          <th className="px-2 py-2 text-right font-medium">Cobrado</th>
                          <th className="px-2 py-2 font-medium">Estado</th>
                          {puedeEditar && <th className="px-3 py-2 font-medium" />}
                        </tr>
                      </thead>
                      <tbody>
                        {cc.cuotas.map((q) => {
                          const fijado = alquilerFijado(c.id, q.periodo);
                          return (
                            <tr key={q.periodo} className="fila-hover border-b border-linea last:border-0">
                              <td className="tabular px-3 py-2 text-tenue">{q.n}</td>
                              <td className="whitespace-nowrap px-2 py-2">
                                {periodoCorto(q.periodo)}
                                {q.fijado && (
                                  <span
                                    title="importe cargado a mano"
                                    className="ml-1 inline-flex align-middle text-espera"
                                  >
                                    <IconoLapiz className="h-3 w-3" />
                                    <span className="sr-only">importe cargado a mano</span>
                                  </span>
                                )}
                              </td>
                              <td className="tabular px-2 py-2 text-right font-medium">{plata(q.bruto)}</td>
                              <td className="tabular px-2 py-2 text-right text-tenue">
                                {q.comision > 0 ? `−${plata(q.comision)}` : "—"}
                              </td>
                              <td className="tabular px-2 py-2 text-right">{plata(q.neto)}</td>
                              <td
                                className="tabular px-2 py-2 text-right"
                                title={
                                  q.partes.length
                                    ? q.partes
                                        .map((p) => `${p.tipo}: ${plata(p.parte)} de ${plata(p.total)}`)
                                        .join(" · ")
                                    : undefined
                                }
                              >
                                {q.reintegro > 0 ? plata(q.reintegro) : "—"}
                              </td>
                              <td className="tabular px-2 py-2 text-right font-medium">
                                {plata(q.esperado)}
                                {q.recargo > 0 && (
                                  <span
                                    className="ml-1 text-[10px] text-peligro"
                                    title={`${q.diasMora} ${plural(q.diasMora, "día", "días")} de mora${
                                      q.moraEstimada ? ", corriendo a hoy" : ""
                                    }`}
                                  >
                                    +mora
                                  </span>
                                )}
                              </td>
                              <td className="tabular px-2 py-2 text-right">
                                {q.cobrado > 0 ? plata(q.cobrado) : "—"}
                              </td>
                              <td className="px-2 py-2">
                                <Estado estado={q.estado} />
                              </td>
                              {puedeEditar && (
                                <td className="px-3 py-2 text-right">
                                  {fijado ? (
                                    <Boton
                                      variante="fantasma"
                                      tamano="sm"
                                      className="min-h-11 whitespace-nowrap sm:min-h-8"
                                      disabled={ocupado === fijado.id}
                                      onClick={() => borrar("/api/alquileres", fijado.id)}
                                    >
                                      {ocupado === fijado.id ? "…" : "quitar"}
                                    </Boton>
                                  ) : (
                                    <Boton
                                      variante="fantasma"
                                      tamano="sm"
                                      className="min-h-11 whitespace-nowrap sm:min-h-8"
                                      onClick={() => abrirFijar(cc, q)}
                                    >
                                      fijar importe
                                    </Boton>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-borde bg-fondo font-semibold">
                          <td className="px-3 py-2" colSpan={2}>
                            Todo el contrato
                          </td>
                          <td className="tabular px-2 py-2 text-right">{plata(cc.totales.bruto)}</td>
                          <td className="tabular px-2 py-2 text-right text-tenue">
                            −{plata(cc.totales.comision)}
                          </td>
                          <td className="tabular px-2 py-2 text-right">{plata(cc.totales.neto)}</td>
                          <td className="tabular px-2 py-2 text-right">{plata(cc.totales.reintegro)}</td>
                          <td className="tabular px-2 py-2 text-right">{plata(cc.totales.esperado)}</td>
                          <td className="tabular px-2 py-2 text-right">{plata(cc.totales.cobrado)}</td>
                          <td className="px-2 py-2" />
                          {puedeEditar && <td className="px-3 py-2" />}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Card>
            );
          })
        )}

        <Card
          titulo="Propiedades"
          nota="La unidad que alquilás. El contrato va colgado de acá."
          accion={
            puedeEditar && (
              <Boton variante="secundario" tamano="sm" className="min-h-11 sm:min-h-9" onClick={() => abrirPropiedad()}>
                <IconoMas />
                Propiedad nueva
              </Boton>
            )
          }
        >
          {propiedades.length === 0 ? (
            <Vacio titulo="Todavía no cargaste ninguna">
              Una propiedad por unidad que alquiles, aunque compartan el medidor de agua.
            </Vacio>
          ) : (
            <ul>
              {propiedades.map((p) => {
                const vivos = contratosVivosDe(p.id);
                const porBorrar = armado === `p:${p.id}`;
                return (
                  <li key={p.id} className="border-b border-linea last:border-0">
                    <div className="fila-hover flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <span className="truncate">{p.nombre}</span>
                          <span className="shrink-0 rounded bg-fondo px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-tenue">
                            {LABEL_TIPO[p.tipo]}
                          </span>
                        </p>
                        <p className="truncate text-xs text-suave">
                          {p.direccion || "sin dirección"}
                          {vivos > 0 && ` · ${vivos} ${plural(vivos, "contrato", "contratos")}`}
                        </p>
                      </div>
                      {puedeEditar && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Boton
                            variante="fantasma"
                            tamano="icono"
                            onClick={() => abrirPropiedad(p)}
                            aria-label="Editar propiedad"
                          >
                            <IconoLapiz />
                          </Boton>
                          <BotonBorrar
                            armado={porBorrar}
                            ocupado={ocupado === p.id}
                            armar={() => {
                              setErrorAccion("");
                              setArmado(`p:${p.id}`);
                            }}
                            cancelar={() => setArmado("")}
                            ejecutar={() => borrar("/api/propiedades", p.id)}
                            etiqueta="Borrar propiedad"
                          />
                        </div>
                      )}
                    </div>
                    {porBorrar && vivos > 0 && (
                      <div className="px-4 pb-3 sm:px-5">
                        <Aviso tipo="info">
                          Tiene {vivos} {plural(vivos, "contrato cargado", "contratos cargados")}. Si
                          la borrás, {plural(vivos, "ese contrato queda", "esos contratos quedan")} sin
                          propiedad: los vas a seguir viendo y cobrando, pero sin nombre de unidad.
                        </Aviso>
                      </div>
                    )}
                    {p.nota && !porBorrar && (
                      <p className="px-4 pb-3 text-xs leading-relaxed text-suave sm:px-5">{p.nota}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <FormContrato
        abierto={formContrato.abierto}
        cerrar={() => setFormContrato({ abierto: false })}
        contrato={formContrato.contrato}
        propiedades={propiedades}
        condiciones={data.condiciones}
        alDeGuardar={() => {
          setFormContrato({ abierto: false });
          recargar();
        }}
      />

      <FormPropiedad
        abierto={formPropiedad.abierto}
        cerrar={() => setFormPropiedad({ abierto: false })}
        propiedad={formPropiedad.propiedad}
        alDeGuardar={() => {
          setFormPropiedad({ abierto: false });
          recargar();
        }}
      />

      <Panel
        abierto={!!fijar}
        cerrar={() => setFijar(null)}
        titulo={fijar ? `Importe de ${periodoLargo(fijar.periodo)}` : "Fijar importe"}
        pie={
          <div className="flex items-center justify-end gap-2">
            <Boton variante="secundario" className="min-h-11 sm:min-h-9" onClick={() => setFijar(null)} disabled={guardandoFijar}>
              Cancelar
            </Boton>
            <Boton className="min-h-11 sm:min-h-9" onClick={guardarFijado} disabled={guardandoFijar}>
              {guardandoFijar ? "Guardando…" : "Fijar importe"}
            </Boton>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Campo
            label="Importe real del mes"
            hint="Si el aumento no salió como estaba pactado, cargá acá el importe real de este mes. Le gana a la proyección."
          >
            <InputPlata
              value={montoFijar}
              onChange={(e) => setMontoFijar(e.target.value)}
              placeholder="0"
            />
          </Campo>

          {fijar && (
            <p className="text-[11px] text-tenue">
              Proyectado para {periodoCorto(fijar.periodo)}:{" "}
              <span className="tabular">{plata(fijar.proyectado)}</span>. Los meses siguientes se
              siguen proyectando desde el alquiler inicial del contrato.
            </p>
          )}

          <Campo label="Nota">
            <Textarea
              value={notaFijar}
              onChange={(e) => setNotaFijar(e.target.value)}
              placeholder="Arreglamos este monto por WhatsApp."
            />
          </Campo>

          <Aviso tipo="error">{errorFijar}</Aviso>
        </div>
      </Panel>
    </Shell>
  );
}
