"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Asistente } from "@/components/Asistente";
import { ETIQUETA_GASTO, FormGasto, aCampo, aNumero } from "@/components/FormGasto";
import { IconoLapiz, IconoMas, IconoTacho } from "@/components/iconos";
import { Shell } from "@/components/Shell";
import {
  Aviso, Boton, Card, Cargando, Kpi, Segmentado, Select, Vacio,
} from "@/components/ui";
import {
  fechaCorta, pct, periodoActual, periodoCorto, periodoLargo, plata, plataExacta, redondear,
} from "@/lib/format";
import { GASTOS_QUE_SE_REPARTEN, TIPOS_GASTO } from "@/lib/schemas";
import type { Gasto, TipoGasto } from "@/lib/types";
import { enviar, useData } from "@/lib/useData";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_NUM = MESES.map((_, i) => String(i + 1).padStart(2, "0"));

/** "50" -> "50%", "33.5" -> "33,5%" */
const comoPct = (n: number) => pct(n / 100, Number.isInteger(n) ? 0 : 1);

/**
 * El PATCH manda la fila entera y no sólo lo que cambió: el server mergea lo
 * que le llega, y una columna que no viaja puede volver vacía.
 */
const cuerpoDe = (g: Gasto) => ({
  tipo: g.tipo,
  periodo: g.periodo,
  fecha: g.fecha,
  propiedad_id: g.propiedad_id,
  monto: g.monto,
  nota: g.nota,
});

type EstadoCelda = "guardando" | "ok" | "error";

export default function GastosPage() {
  const { data, error, recargar, puedeEditar } = useData();

  const hoyPeriodo = periodoActual();
  const anioHoy = Number(hoyPeriodo.slice(0, 4));

  const [anio, setAnio] = useState(anioHoy);

  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<Gasto | null>(null);

  const [estados, setEstados] = useState<Record<string, EstadoCelda>>({});
  const [errorGrilla, setErrorGrilla] = useState("");
  const [errorLista, setErrorLista] = useState("");
  const [porBorrar, setPorBorrar] = useState("");
  const [borrando, setBorrando] = useState("");

  const relojes = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const relojBorrar = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      Object.values(relojes.current).forEach(clearTimeout);
      clearTimeout(relojBorrar.current);
    },
    []
  );

  const gastos = useMemo(
    () => (data?.gastos ?? []).filter((g) => !g.deleted_at),
    [data?.gastos]
  );
  const propiedades = data?.propiedades ?? [];
  const vigentes = (data?.calculados ?? []).filter((c) => c.vigente);

  const reparten = gastos;

  const nombrePropiedad = (id: string) =>
    propiedades.find((p) => p.id === id)?.nombre ?? "Propiedad borrada";

  const anios = useMemo(() => {
    const s = new Set<number>([anioHoy, anioHoy + 1]);
    for (const g of gastos) {
      const y = Number(g.periodo.slice(0, 4));
      if (y) s.add(y);
    }
    return [...s].sort((a, b) => b - a);
  }, [gastos, anioHoy]);

  // Filas de la grilla: los cuatro que se reparten siempre, más cualquier otro
  // tipo que ya tenga boletas cargadas con reintegro.
  const tiposGrilla = useMemo(() => {
    const con = new Set<TipoGasto>(GASTOS_QUE_SE_REPARTEN);
    for (const g of reparten) con.add(g.tipo);
    return TIPOS_GASTO.filter((t) => con.has(t));
  }, [reparten]);

  /*
   * La grilla maneja la boleta que cubre todo (el medidor único): una por tipo
   * y por mes. Una boleta cargada a una propiedad puntual, o una segunda del
   * mismo tipo y mes, no entra en la celda — se lista abajo para que quede
   * visible y editable en vez de desaparecer.
   */
  const { celdas, aparte } = useMemo(() => {
    const celdas = new Map<string, Gasto>();
    const aparte: Gasto[] = [];
    for (const g of reparten) {
      const clave = `${g.tipo}|${g.periodo}`;
      if (g.propiedad_id || celdas.has(clave)) aparte.push(g);
      else celdas.set(clave, g);
    }
    aparte.sort((a, b) => b.periodo.localeCompare(a.periodo));
    return { celdas, aparte };
  }, [reparten]);

  const totalesMes = useMemo(
    () =>
      MESES_NUM.map((mm) =>
        tiposGrilla.reduce((t, tipo) => t + (celdas.get(`${tipo}|${anio}-${mm}`)?.monto ?? 0), 0)
      ),
    [celdas, tiposGrilla, anio]
  );
  const totalAnio = totalesMes.reduce((a, b) => a + b, 0);
  const totalFila = (tipo: TipoGasto) =>
    MESES_NUM.reduce((t, mm) => t + (celdas.get(`${tipo}|${anio}-${mm}`)?.monto ?? 0), 0);

  // Base del reparto: todas las boletas con reintegro de un período, incluidas
  // las que quedaron fuera de la grilla.
  const porPeriodo = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of reparten) {
      if (!g.periodo.startsWith(`${anio}-`)) continue;
      m.set(g.periodo, (m.get(g.periodo) ?? 0) + g.monto);
    }
    return m;
  }, [reparten, anio]);

  const periodoReparto = useMemo(() => {
    if (anio === anioHoy) return hoyPeriodo;
    // Un año que ya pasó no tiene "mes actual": vale el último que cargó.
    const conDatos = [...porPeriodo.keys()].sort();
    return conDatos[conDatos.length - 1] ?? `${anio}-12`;
  }, [anio, anioHoy, hoyPeriodo, porPeriodo]);

  const baseReparto = porPeriodo.get(periodoReparto) ?? 0;
  const detalleReparto = reparten
    .filter((g) => g.periodo === periodoReparto)
    .map((g) => `${ETIQUETA_GASTO[g.tipo]} ${plata(g.monto)}`)
    .join(" · ");

  const sumaPct = redondear(vigentes.reduce((a, c) => a + c.contrato.prorrateo_pct, 0), 2);
  const restaPct = redondear(100 - sumaPct, 2);


  function marcar(clave: string, estado: EstadoCelda | null) {
    setEstados((p) => {
      const n = { ...p };
      if (estado) n[clave] = estado;
      else delete n[clave];
      return n;
    });
  }

  function abrirNuevo() {
    setEditando(null);
    setAbierto(true);
  }

  function abrirEdicion(g: Gasto) {
    setEditando(g);
    setAbierto(true);
  }

  function cerrarForm() {
    setAbierto(false);
    setEditando(null);
  }

  async function guardarCelda(tipo: TipoGasto, periodo: string, crudo: string) {
    const clave = `${tipo}|${periodo}`;
    const actual = celdas.get(clave);
    const texto = crudo.trim();
    const leido = texto ? aNumero(texto) : null;

    if (leido !== null && !Number.isFinite(leido)) {
      setErrorGrilla(`${ETIQUETA_GASTO[tipo]} de ${periodoLargo(periodo)}: eso no es un número.`);
      marcar(clave, "error");
      return;
    }
    if (leido !== null && leido < 0) {
      setErrorGrilla(`${ETIQUETA_GASTO[tipo]} de ${periodoLargo(periodo)}: el importe no puede ser negativo.`);
      marcar(clave, "error");
      return;
    }

    const nuevo = leido === null ? null : redondear(leido, 2);
    if (!actual && nuevo === null) {
      marcar(clave, null);
      return;
    }
    if (actual && nuevo !== null && redondear(actual.monto, 2) === nuevo) {
      marcar(clave, null);
      return;
    }

    setErrorGrilla("");
    marcar(clave, "guardando");
    const r = !actual
      ? await enviar("/api/boletas", "POST", {
          tipo, periodo, fecha: "", propiedad_id: "", monto: nuevo, nota: "",
        })
      : nuevo === null
        ? await enviar("/api/boletas", "DELETE", { id: actual.id })
        : await enviar("/api/boletas", "PATCH", { ...cuerpoDe(actual), id: actual.id, monto: nuevo });

    if (!r.ok) {
      setErrorGrilla(r.error);
      marcar(clave, "error");
      return;
    }
    await recargar();
    marcar(clave, "ok");
    clearTimeout(relojes.current[clave]);
    relojes.current[clave] = setTimeout(() => marcar(clave, null), 1800);
  }

  function pedirBorrar(id: string) {
    setErrorLista("");
    setPorBorrar(id);
    // El "¿Seguro?" se desarma solo: si te fuiste a otra cosa, no queda un
    // botón rojo esperando un toque distraído.
    clearTimeout(relojBorrar.current);
    relojBorrar.current = setTimeout(() => setPorBorrar(""), 6000);
  }

  async function borrar(id: string) {
    setBorrando(id);
    const r = await enviar("/api/boletas", "DELETE", { id });
    setBorrando("");
    setPorBorrar("");
    if (!r.ok) {
      setErrorLista(r.error);
      return;
    }
    await recargar();
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
        <Cargando />
      </Shell>
    );
  }

  const selectorAnio = (
    <Select
      aria-label="Año"
      value={anio}
      onChange={(e) => setAnio(Number(e.target.value))}
      className="w-auto"
    >
      {anios.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </Select>
  );

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Boletas</h1>
          {/* Subir la boleta del agua o del inmobiliario y que se cargue sola. */}
          <Asistente modo="boleta" />
        </div>

        <div className="aparece flex flex-col gap-4">
            <Card
              titulo="Servicios que te reintegran"
              nota="Cargá el total de cada boleta. Escribí el importe y salí del campo: se guarda solo."
              accion={
                <div className="flex items-center gap-2">
                  {selectorAnio}
                  {puedeEditar && (
                    <Boton onClick={abrirNuevo}>
                      <IconoMas />
                      Cargar boleta
                    </Boton>
                  )}
                </div>
              }
            >
              {errorGrilla && (
                <div className="px-4 pt-3 sm:px-5">
                  <Aviso tipo="error">{errorGrilla}</Aviso>
                </div>
              )}
              <div className="scroll-x">
                <table className="w-full min-w-[1320px] table-fixed border-separate border-spacing-0 sm:min-w-0">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 w-[124px] border-b border-borde bg-papel px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-tenue sm:w-[150px] sm:px-5">
                        Servicio
                      </th>
                      {MESES.map((m, i) => (
                        <th
                          key={m}
                          className={`w-[92px] border-b border-borde bg-papel px-1.5 py-2 text-right text-[11px] font-medium text-tenue sm:w-[64px] ${
                            `${anio}-${MESES_NUM[i]}` === hoyPeriodo ? "text-acento" : ""
                          }`}
                        >
                          {m}
                        </th>
                      ))}
                      <th className="w-[96px] border-b border-borde bg-papel px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-tenue sm:w-[84px]">
                        Año
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiposGrilla.map((tipo) => (
                      <tr key={tipo} className="fila-hover">
                        <th
                          scope="row"
                          title={ETIQUETA_GASTO[tipo]}
                          className="sticky left-0 z-10 truncate border-b border-linea bg-papel px-4 py-1 text-left text-xs font-medium sm:px-5"
                        >
                          {ETIQUETA_GASTO[tipo]}
                        </th>
                        {MESES_NUM.map((mm) => {
                          const periodo = `${anio}-${mm}`;
                          const clave = `${tipo}|${periodo}`;
                          const g = celdas.get(clave);
                          return (
                            <td key={mm} className="border-b border-linea px-0.5 py-1">
                              <CeldaMes
                                valor={g ? aCampo(g.monto) : ""}
                                estado={estados[clave]}
                                deshabilitado={!puedeEditar}
                                etiqueta={`${ETIQUETA_GASTO[tipo]} de ${periodoLargo(periodo)}`}
                                alGuardar={(v) => guardarCelda(tipo, periodo, v)}
                              />
                            </td>
                          );
                        })}
                        <td className="tabular border-b border-linea px-3 py-1 text-right text-xs font-semibold">
                          {totalFila(tipo) > 0 ? plata(totalFila(tipo)) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-fondo px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-suave sm:px-5"
                      >
                        Total
                      </th>
                      {totalesMes.map((t, i) => (
                        <td
                          key={MESES_NUM[i]}
                          className="tabular bg-fondo px-1.5 py-2 text-right text-[11px] font-semibold text-suave"
                        >
                          {t > 0 ? plata(t) : "—"}
                        </td>
                      ))}
                      <td className="tabular bg-fondo px-3 py-2 text-right text-xs font-semibold">
                        {totalAnio > 0 ? plata(totalAnio) : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            <Card
              titulo={`Cómo se reparte ${periodoLargo(periodoReparto)}`}
              nota={detalleReparto || "Todavía no hay boletas cargadas en ese mes."}
            >
              <div className="flex flex-col gap-3 px-4 py-3 sm:px-5">
                {vigentes.length === 0 ? (
                  <Aviso tipo="info">
                    No hay contratos vigentes, así que estas boletas las estás poniendo enteras vos.
                  </Aviso>
                ) : (
                  <>
                    {restaPct > 0 && (
                      <Aviso tipo="info">
                        Los contratos vigentes cubren el {comoPct(sumaPct)} de los servicios que se
                        reparten. El {comoPct(restaPct)} restante lo estás poniendo vos.
                      </Aviso>
                    )}
                    {restaPct < 0 && (
                      <Aviso tipo="error">
                        Los contratos vigentes suman el {comoPct(sumaPct)}: estás cobrando{" "}
                        {comoPct(-restaPct)} más de lo que pagás. Revisá el prorrateo de cada
                        contrato.
                      </Aviso>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] font-medium uppercase tracking-wide text-tenue">
                          <th className="py-1 text-left font-medium">Inquilino</th>
                          <th className="py-1 text-right font-medium">Prorrateo</th>
                          <th className="py-1 text-right font-medium">Le toca</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vigentes.map((c) => (
                          <tr key={c.contrato.id} className="border-t border-linea">
                            <td className="py-2 pr-2">
                              <span className="font-medium">{c.contrato.inquilino}</span>
                              {c.propiedad && (
                                <span className="block text-[11px] text-tenue">
                                  {c.propiedad.nombre}
                                </span>
                              )}
                            </td>
                            <td className="tabular py-2 text-right text-xs text-suave">
                              {comoPct(c.contrato.prorrateo_pct)}
                            </td>
                            <td className="tabular py-2 text-right font-semibold">
                              {plataExacta((baseReparto * c.contrato.prorrateo_pct) / 100)}
                            </td>
                          </tr>
                        ))}
                        {restaPct > 0 && (
                          <tr className="border-t border-linea">
                            <td className="py-2 pr-2 text-suave">Lo que queda para vos</td>
                            <td className="tabular py-2 text-right text-xs text-suave">
                              {comoPct(restaPct)}
                            </td>
                            <td className="tabular py-2 text-right font-semibold text-suave">
                              {plataExacta((baseReparto * restaPct) / 100)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-borde">
                          <td className="py-2 pr-2 text-xs font-semibold">Total de las boletas</td>
                          <td />
                          <td className="tabular py-2 text-right text-xs font-semibold">
                            {plataExacta(baseReparto)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </>
                )}
              </div>
            </Card>

            {aparte.length > 0 && (
              <Card
                titulo="Boletas que no entran en la grilla"
                nota="Son de una propiedad puntual, o quedaron dos del mismo tipo en el mismo mes. Se reparten igual."
              >
                <ul className="divide-y divide-linea">
                  {aparte.map((g) => (
                    <FilaGasto
                      key={g.id}
                      g={g}
                      propiedad={g.propiedad_id ? nombrePropiedad(g.propiedad_id) : "Todas las propiedades"}
                      puedeEditar={puedeEditar}
                      porBorrar={porBorrar === g.id}
                      borrando={borrando === g.id}
                      alEditar={() => abrirEdicion(g)}
                      alPedirBorrar={() => pedirBorrar(g.id)}
                      alBorrar={() => borrar(g.id)}
                    />
                  ))}
                </ul>
              </Card>
            )}
          </div>
      </div>

      {abierto && (
        <FormGasto
          key={editando?.id ?? "nuevo"}
          abierto={abierto}
          cerrar={cerrarForm}
          gasto={editando ?? undefined}
          propiedades={propiedades}
          alDeGuardar={() => {
            recargar();
            cerrarForm();
          }}
        />
      )}
    </Shell>
  );
}

/**
 * Celda de la grilla. Guarda al salir del campo o con Enter, y sólo si el
 * importe cambió. Con Escape vuelve a lo que había y no guarda nada.
 */
function CeldaMes({
  valor,
  estado,
  deshabilitado,
  etiqueta,
  alGuardar,
}: {
  valor: string;
  estado?: EstadoCelda;
  deshabilitado: boolean;
  etiqueta: string;
  alGuardar: (v: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const enfocado = useRef(false);
  const cancelado = useRef(false);

  // Mientras tenés el cursor adentro, una revalidación de SWR no te tiene que
  // mover el número abajo de los dedos.
  useEffect(() => {
    if (!enfocado.current) setTexto(valor);
  }, [valor]);

  const borde =
    estado === "guardando"
      ? "border-acento/40 bg-acento-claro"
      : estado === "ok"
        ? "border-ok bg-ok-claro"
        : estado === "error"
          ? "border-peligro bg-peligro-claro"
          : "border-transparent hover:border-borde focus:border-acento focus:bg-papel focus:ring-2 focus:ring-acento/15";

  return (
    <input
      value={texto}
      inputMode="decimal"
      autoComplete="off"
      aria-label={etiqueta}
      disabled={deshabilitado}
      placeholder="—"
      onFocus={() => {
        enfocado.current = true;
      }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        enfocado.current = false;
        if (cancelado.current) {
          cancelado.current = false;
          setTexto(valor);
          return;
        }
        alGuardar(texto);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          cancelado.current = true;
          e.currentTarget.blur();
        }
      }}
      className={`tabular h-9 w-full rounded-md border px-1.5 text-right text-sm outline-none transition-colors placeholder:text-tenue/60 disabled:bg-transparent sm:text-xs ${borde}`}
    />
  );
}

function FilaGasto({
  g,
  propiedad,
  puedeEditar,
  porBorrar,
  borrando,
  alEditar,
  alPedirBorrar,
  alBorrar,
}: {
  g: Gasto;
  propiedad: string;
  puedeEditar: boolean;
  porBorrar: boolean;
  borrando: boolean;
  alEditar: () => void;
  alPedirBorrar: () => void;
  alBorrar: () => void;
}) {
  return (
    <li className="fila-hover flex items-start gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
          {ETIQUETA_GASTO[g.tipo]}
          <span className="text-[11px] font-normal text-tenue">{periodoCorto(g.periodo)}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-suave">
          {propiedad}
          {g.fecha && ` · pagado el ${fechaCorta(g.fecha)}`}
        </p>
        {g.nota && <p className="mt-1 text-[11px] leading-snug text-tenue">{g.nota}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="tabular text-sm font-semibold">{plata(g.monto)}</span>
        {puedeEditar && (
          <>
            <Boton variante="fantasma" tamano="icono" onClick={alEditar} aria-label="Editar gasto">
              <IconoLapiz />
            </Boton>
            {porBorrar ? (
              <Boton variante="peligro" tamano="sm" onClick={alBorrar} disabled={borrando}>
                {borrando ? "Borrando…" : "¿Seguro?"}
              </Boton>
            ) : (
              <Boton
                variante="peligro"
                tamano="icono"
                onClick={alPedirBorrar}
                aria-label="Borrar gasto"
              >
                <IconoTacho />
              </Boton>
            )}
          </>
        )}
      </div>
    </li>
  );
}
