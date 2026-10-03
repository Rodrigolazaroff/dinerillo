"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Asistente } from "@/components/Asistente";
import { Emoji } from "@/components/Emoji";
import { ETIQUETA_GASTO, FormGasto } from "@/components/FormGasto";
import { IconoLapiz, IconoMas, IconoTacho } from "@/components/iconos";
import { Monto, usePrivado } from "@/components/Privado";
import { SelectorMes } from "@/components/SelectorMes";
import { Shell } from "@/components/Shell";
import { Aviso, Boton, Card, Cargando } from "@/components/ui";
import { aCampo, aNumero, fechaCorta, pct, periodoCorto, periodoLargo, redondear } from "@/lib/format";
import { TIPOS_GASTO } from "@/lib/schemas";
import type { Gasto, TipoGasto } from "@/lib/types";
import { enviar, useData } from "@/lib/useData";
import { useMes } from "@/lib/useMes";

// Las boletas que se reparten entre inquilinos (el agua, el inmobiliario): se
// carga el total una vez y cada contrato se lleva su parte. En el celu, un mes
// a la vez; en la compu, el año entero en una grilla.

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_NUM = MESES.map((_, i) => String(i + 1).padStart(2, "0"));

/** Agua e inmobiliario van siempre; el resto aparece cuando tiene algo en el año. */
const SIEMPRE: TipoGasto[] = ["agua", "inmobiliario"];

const EMOJI_TIPO: Record<TipoGasto, string> = {
  agua: "agua",
  inmobiliario: "impuestos",
  expensas: "casa",
  luz: "luz",
  gas: "fuego",
  abl: "impuestos",
  otro: "recibo",
};

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

export default function BoletasPage() {
  const { data, error, recargar, puedeEditar } = useData();
  const [mes, setMes] = useMes();
  const anio = mes.slice(0, 4);

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

  const boletas = useMemo(() => (data?.gastos ?? []).filter((g) => !g.deleted_at), [data?.gastos]);
  const propiedades = data?.propiedades ?? [];

  const nombrePropiedad = (id: string) => propiedades.find((p) => p.id === id)?.nombre ?? "Propiedad borrada";

  const tipos = useMemo(() => {
    const con = new Set<TipoGasto>(SIEMPRE);
    for (const g of boletas) if (g.periodo.startsWith(`${anio}-`)) con.add(g.tipo);
    return TIPOS_GASTO.filter((t) => con.has(t));
  }, [boletas, anio]);

  /*
   * La celda maneja la boleta que cubre todo (el medidor único): una por tipo
   * y por mes. Una boleta cargada a una propiedad puntual, o una segunda del
   * mismo tipo y mes, no entra en la celda: se lista aparte para que quede
   * visible y editable en vez de desaparecer.
   */
  const { celdas, aparte } = useMemo(() => {
    const celdas = new Map<string, Gasto>();
    const aparte: Gasto[] = [];
    for (const g of boletas) {
      const clave = `${g.tipo}|${g.periodo}`;
      if (g.propiedad_id || celdas.has(clave)) aparte.push(g);
      else celdas.set(clave, g);
    }
    aparte.sort((a, b) => b.periodo.localeCompare(a.periodo));
    return { celdas, aparte };
  }, [boletas]);

  const aparteDelAnio = aparte.filter((g) => g.periodo.startsWith(`${anio}-`));

  const totalesMes = MESES_NUM.map((mm) =>
    tipos.reduce((t, tipo) => t + (celdas.get(`${tipo}|${anio}-${mm}`)?.monto ?? 0), 0)
  );
  const totalAnio = totalesMes.reduce((a, b) => a + b, 0);
  const totalFila = (tipo: TipoGasto) =>
    MESES_NUM.reduce((t, mm) => t + (celdas.get(`${tipo}|${anio}-${mm}`)?.monto ?? 0), 0);

  // El reparto del mes elegido. Cada contrato se lleva lo que el cálculo le
  // cobra de verdad (una boleta de una sola propiedad no le toca al otro), y
  // lo que nadie cubre lo ponés vos.
  const delMes = boletas.filter((g) => g.periodo === mes);
  const base = redondear(delMes.reduce((a, g) => a + g.monto, 0));
  const porTipo = TIPOS_GASTO.map((t) => ({
    tipo: t,
    total: delMes.filter((g) => g.tipo === t).reduce((a, g) => a + g.monto, 0),
  })).filter((x) => x.total > 0);
  const contratosMes = (data?.calculados ?? []).flatMap((cc) => {
    const q = cc.cuotas.find((x) => x.periodo === mes);
    return q ? [{ cc, parte: q.reintegro }] : [];
  });
  const sumaPct = redondear(contratosMes.reduce((a, x) => a + x.cc.contrato.prorrateo_pct, 0), 2);
  const vos = redondear(base - contratosMes.reduce((a, x) => a + x.parte, 0));

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

  const celda = (tipo: TipoGasto, periodo: string, variante: "grilla" | "campo") => {
    const clave = `${tipo}|${periodo}`;
    const g = celdas.get(clave);
    return (
      <CeldaMes
        valor={g ? aCampo(g.monto) : ""}
        estado={estados[clave]}
        deshabilitado={!puedeEditar}
        etiqueta={`${ETIQUETA_GASTO[tipo]} de ${periodoLargo(periodo)}`}
        variante={variante}
        alGuardar={(v) => guardarCelda(tipo, periodo, v)}
      />
    );
  };

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SelectorMes className="-mx-2" />
          <div className="flex flex-wrap items-center gap-2">
            {puedeEditar && (
              <Boton onClick={abrirNuevo} className="min-h-11 sm:min-h-9">
                <IconoMas />
                Cargar boleta
              </Boton>
            )}
            {/* Subir la boleta del agua o del inmobiliario y que se cargue sola. */}
            <Asistente modo="boleta" />
          </div>
        </div>

        {errorGrilla && <Aviso tipo="error">{errorGrilla}</Aviso>}

        {/* Celu: el mes elegido, una fila por servicio. */}
        <Card className="sm:hidden">
          <ul className="divide-y divide-linea">
            {tipos.map((tipo) => (
              <li key={tipo} className="flex items-center gap-3 px-4 py-2.5">
                <Emoji nombre={EMOJI_TIPO[tipo]} tamano="md" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{ETIQUETA_GASTO[tipo]}</span>
                <div className="w-36 shrink-0">{celda(tipo, mes, "campo")}</div>
              </li>
            ))}
          </ul>
          <p className="border-t border-linea px-4 py-2.5 text-[11px] text-tenue">
            El total de cada boleta. Se guarda solo.
          </p>
        </Card>

        <Card
          titulo="Cómo se reparte"
          nota={
            porTipo.length === 0
              ? "Sin boletas ese mes."
              : porTipo.map((x, i) => (
                  <span key={x.tipo}>
                    {i > 0 && " · "}
                    {ETIQUETA_GASTO[x.tipo]} <Monto valor={x.total} />
                  </span>
                ))
          }
        >
          {(contratosMes.length === 0 || sumaPct > 100 || base > 0) && (
            <div className="flex flex-col gap-3 px-4 py-3 sm:px-5">
              {contratosMes.length === 0 ? (
                <Aviso tipo="info">Sin contratos vigentes: las pagás enteras vos.</Aviso>
              ) : (
                <>
                  {sumaPct > 100 && (
                    <Aviso tipo="error">
                      Los contratos suman {comoPct(sumaPct)}: cobrás de más. Revisá cada contrato.
                    </Aviso>
                  )}
                  {base > 0 && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] font-medium uppercase tracking-wide text-tenue">
                          <th className="py-1 text-left font-medium">Inquilino</th>
                          <th className="py-1 text-right font-medium">Parte</th>
                          <th className="py-1 text-right font-medium">Le toca</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contratosMes.map(({ cc, parte }) => (
                          <tr key={cc.contrato.id} className="border-t border-linea">
                            <td className="py-2 pr-2">
                              <span className="font-medium">{cc.contrato.inquilino}</span>
                              {cc.propiedad && (
                                <span className="block text-[11px] text-tenue">{cc.propiedad.nombre}</span>
                              )}
                            </td>
                            <td className="tabular py-2 text-right text-xs text-suave">
                              {comoPct(cc.contrato.prorrateo_pct)}
                            </td>
                            <td className="tabular py-2 text-right font-semibold">
                              <Monto valor={parte} />
                            </td>
                          </tr>
                        ))}
                        {vos >= 1 && (
                          <tr className="border-t border-linea">
                            <td className="py-2 pr-2 text-suave">Vos</td>
                            <td className="tabular py-2 text-right text-xs text-suave">
                              {comoPct(redondear((vos / base) * 100, 1))}
                            </td>
                            <td className="tabular py-2 text-right font-semibold text-suave">
                              <Monto valor={vos} />
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-borde">
                          <td className="py-2 pr-2 text-xs font-semibold">Total</td>
                          <td />
                          <td className="tabular py-2 text-right text-xs font-semibold">
                            <Monto valor={base} />
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </>
              )}
            </div>
          )}
        </Card>

        {/* Compu: el año entero. */}
        <Card className="hidden sm:block" titulo={`Todo ${anio}`} nota="El total de cada boleta. Se guarda solo.">
          <div className="scroll-x">
            <table className="w-full table-fixed border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-[150px] border-b border-borde bg-papel px-5 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-tenue">
                    Servicio
                  </th>
                  {MESES.map((m, i) => {
                    const periodo = `${anio}-${MESES_NUM[i]}`;
                    const elegido = periodo === mes;
                    return (
                      <th key={m} className="w-[64px] border-b border-borde bg-papel px-0.5 py-1 text-right">
                        {/* Tocar el mes elige ese mes: el reparto de arriba lo sigue. */}
                        <button
                          type="button"
                          onClick={() => setMes(periodo)}
                          aria-pressed={elegido}
                          aria-label={`Ver ${periodoLargo(periodo)}`}
                          className={`w-full rounded-md px-1.5 py-1 text-right text-[11px] font-medium transition-colors ${
                            elegido ? "bg-acento-claro text-acento" : "text-tenue hover:bg-celeste-claro hover:text-tinta"
                          }`}
                        >
                          {m}
                        </button>
                      </th>
                    );
                  })}
                  <th className="w-[96px] border-b border-borde bg-papel px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-tenue">
                    Año
                  </th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((tipo) => (
                  <tr key={tipo} className="fila-hover">
                    <th
                      scope="row"
                      title={ETIQUETA_GASTO[tipo]}
                      className="sticky left-0 z-10 truncate border-b border-linea bg-papel px-5 py-1 text-left text-xs font-medium"
                    >
                      {ETIQUETA_GASTO[tipo]}
                    </th>
                    {MESES_NUM.map((mm) => (
                      <td key={mm} className="border-b border-linea px-0.5 py-1">
                        {celda(tipo, `${anio}-${mm}`, "grilla")}
                      </td>
                    ))}
                    <td className="tabular border-b border-linea px-3 py-1 text-right text-xs font-semibold">
                      {totalFila(tipo) > 0 ? <Monto valor={totalFila(tipo)} /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-fondo px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-suave"
                  >
                    Total
                  </th>
                  {totalesMes.map((t, i) => (
                    <td
                      key={MESES_NUM[i]}
                      className="tabular bg-fondo px-1.5 py-2 text-right text-[11px] font-semibold text-suave"
                    >
                      {t > 0 ? <Monto valor={t} /> : "—"}
                    </td>
                  ))}
                  <td className="tabular bg-fondo px-3 py-2 text-right text-xs font-semibold">
                    {totalAnio > 0 ? <Monto valor={totalAnio} /> : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {aparteDelAnio.length > 0 && (
          <Card titulo="Otras boletas" nota="Se reparten igual.">
            {errorLista && (
              <div className="px-4 pt-3 sm:px-5">
                <Aviso tipo="error">{errorLista}</Aviso>
              </div>
            )}
            <ul className="divide-y divide-linea">
              {aparteDelAnio.map((g) => (
                <FilaBoleta
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

      {abierto && (
        <FormGasto
          key={editando?.id ?? "nuevo"}
          abierto={abierto}
          cerrar={cerrarForm}
          gasto={editando ?? undefined}
          inicial={editando ? undefined : { periodo: mes }}
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
 * Un importe editable en el lugar. Guarda al salir del campo o con Enter, y
 * sólo si cambió. Con Escape vuelve a lo que había y no guarda nada. Con el
 * ojito cerrado muestra puntitos hasta que lo tocás.
 */
function CeldaMes({
  valor,
  estado,
  deshabilitado,
  etiqueta,
  variante,
  alGuardar,
}: {
  valor: string;
  estado?: EstadoCelda;
  deshabilitado: boolean;
  etiqueta: string;
  /** "grilla": sin borde hasta que lo tocás. "campo": un campo de verdad, para el dedo. */
  variante: "grilla" | "campo";
  alGuardar: (v: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const [previo, setPrevio] = useState(valor);
  const [enfocado, setEnfocado] = useState(false);
  const cancelado = useRef(false);
  const [oculto] = usePrivado();

  // Mientras tenés el cursor adentro, una revalidación de SWR no te tiene que
  // mover el número abajo de los dedos. Afuera, el campo sigue a lo guardado.
  if (valor !== previo && !enfocado) {
    setPrevio(valor);
    setTexto(valor);
  }
  const mostrado = !enfocado && oculto && texto ? "••••" : texto;

  const reposo =
    variante === "grilla"
      ? "border-transparent hover:border-borde"
      : "border-borde bg-papel";
  const borde =
    estado === "guardando"
      ? "border-acento/40 bg-acento-claro"
      : estado === "ok"
        ? "border-ok bg-ok-claro"
        : estado === "error"
          ? "border-peligro bg-peligro-claro"
          : `${reposo} focus:border-acento focus:bg-papel focus:ring-2 focus:ring-acento/15`;
  const tam = variante === "grilla" ? "h-11 rounded-md px-1.5 text-sm sm:h-9 sm:text-xs" : "h-11 rounded-xl px-3";

  return (
    <input
      value={mostrado}
      inputMode="decimal"
      autoComplete="off"
      aria-label={etiqueta}
      disabled={deshabilitado}
      placeholder="—"
      onFocus={() => setEnfocado(true)}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        setEnfocado(false);
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
      className={`tabular w-full border text-right outline-none transition-colors placeholder:text-tenue/60 disabled:bg-transparent ${tam} ${borde}`}
    />
  );
}

function FilaBoleta({
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
  propiedad: ReactNode;
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
          {g.fecha && ` · pagada el ${fechaCorta(g.fecha)}`}
        </p>
        {g.nota && <p className="mt-1 text-[11px] leading-snug text-tenue">{g.nota}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="tabular text-sm font-semibold">
          <Monto valor={g.monto} />
        </span>
        {puedeEditar && (
          <>
            <Boton variante="fantasma" tamano="icono" onClick={alEditar} aria-label="Editar boleta">
              <IconoLapiz />
            </Boton>
            {porBorrar ? (
              <Boton variante="peligro" tamano="sm" className="min-h-11 sm:min-h-9" onClick={alBorrar} disabled={borrando}>
                {borrando ? "Borrando…" : "¿Seguro?"}
              </Boton>
            ) : (
              <Boton variante="peligro" tamano="icono" onClick={alPedirBorrar} aria-label="Borrar boleta">
                <IconoTacho />
              </Boton>
            )}
          </>
        )}
      </div>
    </li>
  );
}
