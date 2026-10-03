"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CondicionesNuevas } from "@/components/CondicionesNuevas";
import { FormContrato } from "@/components/FormContrato";
import { FormPropiedad, LABEL_TIPO } from "@/components/FormPropiedad";
import { EscaleraContrato } from "@/components/Graficos";
import { Monto } from "@/components/Privado";
import { Shell } from "@/components/Shell";
import { IconoLapiz, IconoMas, IconoTacho } from "@/components/iconos";
import {
  Aviso, Boton, Campo, Cargando, Card, Estado, InputPlata, Panel, Textarea, Vacio,
} from "@/components/ui";
import { proximoAumento, type ContratoCalculado, type Cuota, type EstadoContrato } from "@/lib/calc";
import { aCampo, aNumero, pct, periodoCorto, periodoLargo } from "@/lib/format";
import type { Alquiler, Contrato, Propiedad } from "@/lib/types";
import { enviar, useData } from "@/lib/useData";

/** Los % del contrato vienen como enteros (15 = 15%), `pct` espera una razón. */
function pctCorto(v: number): string {
  return pct(v / 100, Number.isInteger(v) ? 0 : 1);
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/**
 * Las condiciones del contrato, una ficha cada una. Se saltean las que no
 * aplican: si no cobrás mora, no aparece la mora.
 */
function condiciones(cc: ContratoCalculado): string[] {
  const c = cc.contrato;
  const out: string[] = [];
  if (c.ajuste_tipo === "porcentaje" && c.aumento_pct > 0) {
    out.push(`+${pctCorto(c.aumento_pct)} cada ${c.aumento_meses} ${plural(c.aumento_meses, "mes", "meses")}`);
  } else {
    out.push("sin aumentos");
  }
  if (c.comision_pct > 0) out.push(`comisión ${pctCorto(c.comision_pct)}`);
  out.push(`vence el ${c.dia_vencimiento}`);
  if (c.mora_pct_diario > 0) out.push(`mora ${pctCorto(c.mora_pct_diario)}/día`);
  if (c.prorrateo_pct > 0) out.push(`servicios ${pctCorto(c.prorrateo_pct)}`);
  if (cc.estado === "por_empezar") out.push(`arranca ${periodoCorto(cc.inicio)}`);
  out.push(`${cc.estado === "terminado" ? "terminó" : "termina"} ${periodoCorto(cc.fin)}`);
  return out;
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
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${clase}`}
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

/** "Cambiar" fija el importe de un mes a mano; "Restaurar" vuelve al calculado. */
function BotonImporte({
  fijado,
  ocupado,
  alCambiar,
  alRestaurar,
}: {
  fijado: Alquiler | undefined;
  ocupado: boolean;
  alCambiar: () => void;
  alRestaurar: () => void;
}) {
  return (
    <Boton
      variante="fantasma"
      tamano="sm"
      className="min-h-11 whitespace-nowrap sm:min-h-8"
      disabled={ocupado}
      onClick={fijado ? alRestaurar : alCambiar}
    >
      {ocupado ? "…" : fijado ? "Restaurar" : "Cambiar"}
    </Boton>
  );
}

function MarcaAMano() {
  return (
    <span title="importe cargado a mano" className="ml-1 inline-flex align-middle text-espera">
      <IconoLapiz className="h-3 w-3" />
      <span className="sr-only">importe cargado a mano</span>
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

  // El mismo orden que la lista de propiedades: de acá sale el color de cada una.
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

  const periodoHoy = data?.resumen.periodoActual ?? "";

  const alquilerFijado = (contratoId: string, periodo: string) =>
    alquileres.find((a) => a.contrato_id === contratoId && a.periodo === periodo);

  const contratosVivosDe = (propiedadId: string) =>
    (data?.contratos ?? []).filter((c) => !c.deleted_at && c.propiedad_id === propiedadId).length;

  const slotDe = (propiedadId: string) => Math.max(0, propiedades.findIndex((p) => p.id === propiedadId));

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
    setMontoFijar(aCampo(Math.round(cuota.bruto)));
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

  async function guardarFijado(e: FormEvent) {
    e.preventDefault();
    if (!fijar) return;
    const monto = aNumero(montoFijar);
    if (!Number.isFinite(monto) || monto <= 0) {
      setErrorFijar("Poné el importe.");
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

  const activos = contratos.filter((cc) => cc.estado !== "terminado");
  const terminados = contratos.filter((cc) => cc.estado === "terminado");

  const tarjeta = (cc: ContratoCalculado) => {
    const c = cc.contrato;
    const abierta = !!desplegados[c.id];
    // El mes que se muestra arriba: el de hoy, o el primero si todavía no arrancó.
    const referencia =
      cc.cuotas.find((q) => q.periodo === periodoHoy) ?? (cc.estado === "por_empezar" ? cc.cuotas[0] : null);
    const aumento = cc.estado === "terminado" ? null : proximoAumento(cc, periodoHoy);
    const fila = (q: Cuota) => {
      const fijado = alquilerFijado(c.id, q.periodo);
      return {
        fijado,
        boton: puedeEditar && (
          <BotonImporte
            fijado={fijado}
            ocupado={!!fijado && ocupado === fijado.id}
            alCambiar={() => abrirFijar(cc, q)}
            alRestaurar={() => fijado && borrar("/api/alquileres", fijado.id)}
          />
        ),
      };
    };

    return (
      <Card
        key={c.id}
        titulo={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate">{cc.propiedad?.nombre ?? "Sin propiedad"}</span>
            <span className="truncate font-normal text-suave">· {c.inquilino}</span>
            <Chip estado={cc.estado} />
          </span>
        }
        accion={
          puedeEditar && (
            <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
              <Boton variante="fantasma" tamano="icono" onClick={() => abrirContrato(c)} aria-label="Editar contrato">
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
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-5">
          {referencia && cc.estado !== "terminado" && (
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-suave">
              {cc.estado === "por_empezar" ? `Desde ${periodoCorto(referencia.periodo)}` : "Este mes"}
              <span className="numero text-2xl font-bold text-tinta">
                <Monto valor={referencia.bruto} />
              </span>
              · te quedan
              <span className="tabular font-semibold text-tinta">
                <Monto valor={referencia.neto} />
              </span>
            </p>
          )}

          <ul className="flex flex-wrap gap-1.5" aria-label="Condiciones">
            {condiciones(cc).map((t) => (
              <li key={t} className="rounded-full bg-celeste-claro px-2.5 py-1 text-[11px] font-medium text-suave">
                {t}
              </li>
            ))}
          </ul>

          {cc.estado !== "terminado" && (
            <div className="-mx-2 sm:-mx-3">
              <EscaleraContrato cuotas={cc.cuotas} hoy={periodoHoy} slot={slotDe(c.propiedad_id)} />
            </div>
          )}

          {aumento && (
            <p className="text-xs text-suave">
              Próximo aumento: {periodoCorto(aumento.periodo)} →{" "}
              <span className="tabular font-semibold text-tinta">
                <Monto valor={aumento.bruto} />
              </span>{" "}
              (+{pctCorto(aumento.pct)})
            </p>
          )}

          {c.nota && <p className="text-xs leading-relaxed text-suave">{c.nota}</p>}

          <Boton
            variante="secundario"
            tamano="sm"
            className="min-h-11 w-full sm:min-h-9 sm:w-auto sm:self-start"
            aria-expanded={abierta}
            onClick={() => setDesplegados((d) => ({ ...d, [c.id]: !d[c.id] }))}
          >
            {abierta
              ? "Ocultar los meses"
              : `Ver los ${cc.cuotas.length} ${plural(cc.cuotas.length, "mes", "meses")}`}
          </Boton>
        </div>

        {abierta && (
          <div className="aparece border-t border-borde">
            {/* En el celu, una lista: mes, alquiler, estado y cambiar. */}
            <ul className="divide-y divide-linea sm:hidden">
              {cc.cuotas.map((q) => {
                const { fijado, boton } = fila(q);
                return (
                  <li key={q.periodo} className="flex min-h-14 items-center gap-2 px-4 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {periodoCorto(q.periodo)}
                        {fijado && <MarcaAMano />}
                      </p>
                      <p className="tabular text-xs font-medium">
                        <Monto valor={q.bruto} />
                      </p>
                    </div>
                    <Estado estado={q.estado} />
                    {boton}
                  </li>
                );
              })}
            </ul>

            <div className="scroll-x hidden sm:block">
              <table className="w-full min-w-[40rem] text-xs">
                <thead>
                  <tr className="border-b border-linea text-left text-[11px] text-tenue">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">Mes</th>
                    <th className="px-2 py-2 text-right font-medium">Alquiler</th>
                    <th className="px-2 py-2 text-right font-medium">Comisión</th>
                    <th className="px-2 py-2 text-right font-medium">Te queda</th>
                    <th className="px-2 py-2 text-right font-medium">Servicios</th>
                    <th className="px-2 py-2 text-right font-medium">Total</th>
                    <th className="px-2 py-2 font-medium">Estado</th>
                    {puedeEditar && <th className="px-3 py-2 font-medium" />}
                  </tr>
                </thead>
                <tbody>
                  {cc.cuotas.map((q) => {
                    const { fijado, boton } = fila(q);
                    return (
                      <tr key={q.periodo} className="fila-hover border-b border-linea last:border-0">
                        <td className="tabular px-3 py-2 text-tenue">{q.n}</td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {periodoCorto(q.periodo)}
                          {fijado && <MarcaAMano />}
                        </td>
                        <td className="tabular px-2 py-2 text-right font-medium">
                          <Monto valor={q.bruto} />
                        </td>
                        <td className="tabular px-2 py-2 text-right text-tenue">
                          {q.comision > 0 ? (
                            <>
                              −<Monto valor={q.comision} />
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="tabular px-2 py-2 text-right">
                          <Monto valor={q.neto} />
                        </td>
                        <td className="tabular px-2 py-2 text-right">
                          {q.reintegro > 0 ? <Monto valor={q.reintegro} /> : "—"}
                        </td>
                        <td className="tabular whitespace-nowrap px-2 py-2 text-right font-medium">
                          <Monto valor={q.esperado} />
                          {q.recargo > 0 && (
                            <span
                              className="ml-1 text-[10px] text-peligro"
                              title={`${q.diasMora} ${plural(q.diasMora, "día", "días")} de mora`}
                            >
                              +mora
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <Estado estado={q.estado} />
                        </td>
                        {puedeEditar && <td className="px-3 py-1 text-right">{boton}</td>}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-borde bg-fondo font-semibold">
                    <td className="px-3 py-2" colSpan={2}>
                      Todo el contrato
                    </td>
                    <td className="tabular px-2 py-2 text-right">
                      <Monto valor={cc.totales.bruto} />
                    </td>
                    <td className="tabular px-2 py-2 text-right text-tenue">
                      −<Monto valor={cc.totales.comision} />
                    </td>
                    <td className="tabular px-2 py-2 text-right">
                      <Monto valor={cc.totales.neto} />
                    </td>
                    <td className="tabular px-2 py-2 text-right">
                      <Monto valor={cc.totales.reintegro} />
                    </td>
                    <td className="tabular px-2 py-2 text-right">
                      <Monto valor={cc.totales.esperado} />
                    </td>
                    <td className="px-2 py-2" />
                    {puedeEditar && <td className="px-3 py-2" />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        {errorAccion && <Aviso tipo="error">{errorAccion}</Aviso>}

        {propiedades.length === 0 ? (
          <Card>
            <Vacio
              emoji="casa"
              titulo="Primero, una propiedad"
              accion={
                puedeEditar ? (
                  <Boton className="min-h-11 sm:min-h-9" onClick={() => abrirPropiedad()}>
                    <IconoMas />
                    Nueva propiedad
                  </Boton>
                ) : undefined
              }
            >
              La casa, el local, la cochera.
            </Vacio>
          </Card>
        ) : (
          <>
            {contratos.length === 0 ? (
              <Card>
                <Vacio
                  emoji="llave"
                  titulo="Sin contratos todavía"
                  accion={
                    puedeEditar ? (
                      <Boton className="min-h-11 sm:min-h-9" onClick={() => abrirContrato()}>
                        <IconoMas />
                        Nuevo contrato
                      </Boton>
                    ) : undefined
                  }
                />
              </Card>
            ) : (
              <>
                {puedeEditar && (
                  <div className="flex justify-end">
                    <Boton className="min-h-11 sm:min-h-9" onClick={() => abrirContrato()}>
                      <IconoMas />
                      Nuevo contrato
                    </Boton>
                  </div>
                )}

                {activos.map(tarjeta)}

                {terminados.length > 0 && (
                  <details className="rounded-2xl border border-borde bg-papel">
                    <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-medium text-suave sm:px-5">
                      Terminados ({terminados.length})
                    </summary>
                    <div className="flex flex-col gap-3 border-t border-borde p-3">{terminados.map(tarjeta)}</div>
                  </details>
                )}
              </>
            )}

            <Card
              titulo="Propiedades"
              accion={
                puedeEditar && (
                  <Boton
                    variante="secundario"
                    tamano="sm"
                    className="min-h-11 self-start sm:min-h-9 sm:self-auto"
                    onClick={() => abrirPropiedad()}
                  >
                    <IconoMas />
                    Nueva propiedad
                  </Boton>
                )
              }
            >
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
                            Tiene {vivos} {plural(vivos, "contrato: queda", "contratos: quedan")} sin propiedad.
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
            </Card>
          </>
        )}

        {puedeEditar && <CondicionesNuevas condiciones={data.condiciones} recargar={recargar} />}
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
        titulo={fijar ? `Alquiler de ${periodoLargo(fijar.periodo)}` : "Alquiler"}
        pie={
          <div className="flex flex-col gap-2">
            {errorFijar && <Aviso tipo="error">{errorFijar}</Aviso>}
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={() => setFijar(null)} disabled={guardandoFijar}>
                Cancelar
              </Boton>
              <Boton type="submit" form="form-fijar" className="flex-1" disabled={guardandoFijar}>
                {guardandoFijar ? "Guardando…" : "Guardar"}
              </Boton>
            </div>
          </div>
        }
      >
        <form id="form-fijar" onSubmit={guardarFijado} className="flex flex-col gap-3">
          <Campo
            label="Importe de este mes"
            hint={
              fijar && (
                <>
                  Calculado: <Monto valor={fijar.proyectado} />
                </>
              )
            }
          >
            <InputPlata grande value={montoFijar} onChange={(e) => setMontoFijar(e.target.value)} placeholder="0" />
          </Campo>

          <Campo label="Nota (opcional)">
            <Textarea
              value={notaFijar}
              onChange={(e) => setNotaFijar(e.target.value)}
              placeholder="Ej: lo arreglamos por WhatsApp"
              rows={2}
            />
          </Campo>
        </form>
      </Panel>
    </Shell>
  );
}
