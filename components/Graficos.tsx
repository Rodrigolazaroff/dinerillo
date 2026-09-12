"use client";

/**
 * Los cuatro gráficos del tablero.
 *
 * Reglas que no se negocian acá: un solo eje Y por gráfico, nada de torta (las
 * partes de un total van apiladas), grilla recesiva, tooltip propio y números
 * siempre en color de texto — el color de serie vive en la marca y en el
 * cuadradito de la leyenda, nunca en el importe.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type TooltipContentProps,
} from "recharts";
import type { FilaPeriodo, Resumen } from "@/lib/calc";
import { ejeCorto, pct, periodoCorto, periodoLargo, plata, plataCorta } from "@/lib/format";
import { Card, Segmentado } from "@/components/ui";

/* ------------------------------------------------------------------ tema --- */

/**
 * Slots del tema, en orden fijo: el color sigue a la propiedad, no a su
 * posición en un ranking. Pasado el slot 8 no se inventa un hex nuevo fuera de
 * la paleta validada: se repite el último.
 */
const SERIES = [
  "var(--color-serie-1)",
  "var(--color-serie-2)",
  "var(--color-serie-3)",
  "var(--color-serie-4)",
  "var(--color-serie-5)",
  "var(--color-serie-6)",
  "var(--color-serie-7)",
  "var(--color-serie-8)",
] as const;

const colorSerie = (i: number) => SERIES[Math.min(Math.max(i, 0), SERIES.length - 1)];

/** Eje fino y sin líneas: el dato tiene que pesar más que su marco. */
const EJE = {
  stroke: "var(--color-tenue)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

/** La grilla es referencia, no dibujo: sólo horizontal, punteada y clarita. */
const GRILLA = {
  vertical: false,
  stroke: "var(--color-linea)",
  strokeDasharray: "2 4",
} as const;

/* --------------------------------------------------------------- helpers --- */

/** Un celular de 360px no aguanta la densidad de un escritorio. */
function useAngosto(): boolean {
  const [angosto, setAngosto] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const leer = () => setAngosto(mq.matches);
    leer();
    mq.addEventListener("change", leer);
    return () => mq.removeEventListener("change", leer);
  }, []);
  return angosto;
}

/** A 360px no entran doce etiquetas de mes: se muestra una cada 2 o 3. */
function intervaloTicks(n: number, maximo: number): number {
  return n <= maximo ? 0 : Math.ceil(n / maximo) - 1;
}

/**
 * Rectángulo con las puntas redondeadas de un solo lado.
 *
 * La barra tiene que quedar apoyada en su línea de base: redondear el arranque
 * corre el cero de lugar y el ojo lee un valor que no está.
 */
function pathBarra(
  x: number,
  y: number,
  w: number,
  h: number,
  lado: "arriba" | "derecha",
  r = 4
): string {
  if (!(w > 0) || !(h > 0)) return "";
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  if (lado === "arriba") {
    return `M${x},${y + h} L${x},${y + q} Q${x},${y} ${x + q},${y} L${x + w - q},${y} Q${x + w},${y} ${x + w},${y + q} L${x + w},${y + h} Z`;
  }
  return `M${x},${y} L${x + w - q},${y} Q${x + w},${y} ${x + w},${y + q} L${x + w},${y + h - q} Q${x + w},${y + h} ${x + w - q},${y + h} L${x},${y + h} Z`;
}

/** Ancho de texto a ojo, para reservar el margen sin medir el DOM. */
const anchoTexto = (caracteres: number) => Math.ceil(caracteres * 6.2) + 12;

/**
 * La ventana de meses que se muestra: termina en el período actual (o en el
 * último con datos, si los contratos todavía no arrancaron) y va para atrás.
 */
function ultimos(filas: FilaPeriodo[], actual: string, meses: number): FilaPeriodo[] {
  if (filas.length === 0) return [];
  let fin = -1;
  filas.forEach((f, i) => {
    if (f.periodo <= actual) fin = i;
  });
  if (fin < 0) fin = Math.min(filas.length - 1, Math.max(0, meses - 1));
  return filas.slice(Math.max(0, fin + 1 - meses), fin + 1);
}

/* ------------------------------------------------------- piezas comunes --- */

const ES_PERIODO = /^\d{4}-\d{2}$/;

type PropsGlobo = Partial<TooltipContentProps> & {
  /** Pisa el título; si no va, el label del eje se lee como período. */
  titulo?: ReactNode;
  /** Orden de lectura de las filas. Lo que no esté acá cae al final. */
  orden?: readonly string[];
  /** Texto chico al lado del importe (el porcentaje, por ejemplo). */
  detalle?: (valor: number, clave: string) => string | undefined;
  /** Renglón de cierre, calculado sobre la fila original del dato. */
  pie?: (fila: Record<string, unknown>) => ReactNode;
};

/**
 * El tooltip de los cuatro. El default de Recharts trae su propio estilo y sus
 * propios números sin formato: acá los importes salen con `plata()` y tabulares,
 * que es como se leen en toda la app.
 */
function Globo({ active, payload, label, titulo, orden, detalle, pie }: PropsGlobo) {
  if (!active || !payload || payload.length === 0) return null;

  const filas = payload
    .filter((p) => p.value != null && !p.hide)
    .map((p) => {
      // Con dataKey de función (nombres de propiedad con puntos) la identidad
      // de la serie la lleva el `name`, no el dataKey.
      const clave = typeof p.dataKey === "string" ? p.dataKey : String(p.name ?? "");
      return {
        clave,
        nombre: String(p.name ?? clave),
        color: p.color,
        valor: Number(p.value),
      };
    });
  if (filas.length === 0) return null;

  if (orden) {
    const pos = (clave: string) => {
      const i = orden.indexOf(clave);
      return i < 0 ? orden.length : i;
    };
    filas.sort((a, b) => pos(a.clave) - pos(b.clave));
  }

  const fila = payload[0]?.payload as Record<string, unknown> | undefined;
  const cierre = pie && fila ? pie(fila) : null;
  const encabezado =
    titulo ?? (typeof label === "string" && ES_PERIODO.test(label) ? periodoLargo(label) : label);

  return (
    <div className="pointer-events-none min-w-40 rounded-lg border border-borde bg-papel px-3 py-2 text-xs shadow-[0_6px_20px_rgba(19,19,22,0.10)]">
      {encabezado != null && (
        <p className="mb-1.5 font-semibold capitalize text-tinta">{encabezado}</p>
      )}
      <ul className="flex flex-col gap-1">
        {filas.map((f) => {
          const extra = detalle?.(f.valor, f.clave);
          return (
            <li key={f.clave} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: f.color ?? "var(--color-tenue)" }}
                aria-hidden
              />
              <span className="text-suave">{f.nombre}</span>
              <span className="tabular ml-auto font-medium text-tinta">{plata(f.valor)}</span>
              {extra && <span className="tabular w-11 text-right text-tenue">{extra}</span>}
            </li>
          );
        })}
      </ul>
      {cierre}
    </div>
  );
}

type ItemLeyenda = { clave: string; nombre: string; color: string };

/** Leyenda propia: el color queda en el cuadradito y el texto en tinta. */
function Leyenda({ items }: { items: ItemLeyenda[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 pb-4 sm:px-5">
      {items.map((i) => (
        <li key={i.clave} className="flex min-w-0 items-center gap-1.5 text-xs">
          <span
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ background: i.color }}
            aria-hidden
          />
          <span className="truncate text-suave">{i.nombre}</span>
        </li>
      ))}
    </ul>
  );
}

/** Un gráfico en blanco no explica nada: el vacío dice qué falta cargar. */
function SinDatos({ alto = 150, children }: { alto?: number; children: ReactNode }) {
  return (
    <div
      className="flex items-center justify-center px-6 py-8 text-center"
      style={{ minHeight: alto }}
    >
      <p className="max-w-[38ch] text-xs leading-relaxed text-tenue">{children}</p>
    </div>
  );
}

/* ------------------------------------------------ 1. cobrado vs esperado --- */

/** El slot que da Recharts es el 80% de la banda; la marca no lo llena todo. */
const anchoMarca = (slot: number) => Math.max(4, Math.min(32, slot * 0.78));

/**
 * Esto es énfasis, no dos series rivales: el esperado es la pista de contexto y
 * el cobrado va adelante, más angosto y centrado sobre la misma banda.
 *
 * Con `barGap="-80%"` las dos barras caen en el mismo slot, así que las dos
 * formas salen del mismo `x` y quedan concéntricas sin cuentas de píxeles
 * (y sin romperse cuando cambia el ancho de la pantalla o la cantidad de meses).
 */
function formaPista(p: BarShapeProps) {
  const w = anchoMarca(p.width);
  const d = pathBarra(p.x + (p.width - w) / 2, p.y, w, p.height, "arriba");
  return d ? <path d={d} fill="var(--color-pista)" /> : null;
}

function formaCobrado(p: BarShapeProps) {
  const w = anchoMarca(p.width) * 0.52;
  const d = pathBarra(p.x + (p.width - w) / 2, p.y, w, p.height, "arriba");
  return d ? <path d={d} fill="var(--color-serie-1)" /> : null;
}

type Ventana = "6" | "12" | "24";
const OPCIONES_VENTANA: { valor: Ventana; label: string }[] = [
  { valor: "6", label: "6 m" },
  { valor: "12", label: "12 m" },
  { valor: "24", label: "24 m" },
];
const ventanaInicial = (meses: number): Ventana => {
  const v = String(meses);
  return v === "6" || v === "12" || v === "24" ? v : "12";
};

export function CobradoVsEsperado({
  resumen,
  meses = 12,
}: {
  resumen: Resumen;
  /** Cuántos meses arranca mostrando; después manda el filtro de la tarjeta. */
  meses?: number;
}) {
  const angosto = useAngosto();
  const [ventana, setVentana] = useState<Ventana>(() => ventanaInicial(meses));
  const datos = useMemo(
    () => ultimos(resumen.porPeriodo, resumen.periodoActual, Number(ventana)),
    [resumen.porPeriodo, resumen.periodoActual, ventana]
  );
  const alto = angosto ? 220 : 280;

  return (
    <Card
      titulo="Cobrado contra esperado"
      nota="La barra gris es lo que había que cobrar; la azul, lo que entró."
      accion={
        <Segmentado
          valor={ventana}
          opciones={OPCIONES_VENTANA}
          onCambio={setVentana}
          className="self-start sm:self-auto"
        />
      }
    >
      {datos.length === 0 ? (
        <SinDatos alto={alto / 2}>
          Todavía no hay cuotas. Cargá un contrato y sus cobros, y acá vas a ver mes a mes cuánto
          había que cobrar y cuánto entró.
        </SinDatos>
      ) : (
        <div className="px-1 pb-4 pt-4 sm:px-2">
          <ResponsiveContainer width="100%" height={alto}>
            <BarChart
              data={datos}
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
              barCategoryGap="10%"
              barGap="-80%"
            >
              <CartesianGrid {...GRILLA} />
              <XAxis
                dataKey="periodo"
                tickFormatter={periodoCorto}
                interval={intervaloTicks(datos.length, angosto ? 5 : 10)}
                tickMargin={8}
                {...EJE}
              />
              <YAxis tickFormatter={ejeCorto} width={46} tickMargin={4} {...EJE} />
              <Tooltip
                cursor={{ fill: "var(--color-linea)" }}
                content={
                  <Globo
                    orden={["cobrado", "esperado"]}
                    pie={(fila) => {
                      const d = Number(fila.diferencia) || 0;
                      if (Math.abs(d) < 1) return null;
                      return (
                        <p className="mt-1.5 border-t border-borde pt-1.5 text-[11px] text-suave">
                          {d < 0 ? `Falta ${plata(-d)}` : `Entró ${plata(d)} de más`}
                        </p>
                      );
                    }}
                  />
                }
              />
              {/* La pista va primero: el cobrado se dibuja encima. */}
              <Bar
                dataKey="esperado"
                name="Esperado"
                fill="var(--color-pista)"
                shape={formaPista}
              />
              <Bar
                dataKey="cobrado"
                name="Cobrado"
                fill="var(--color-serie-1)"
                shape={formaCobrado}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------- 2. escalera de precios --- */

export function EscaleraDeAlquileres({ resumen }: { resumen: Resumen }) {
  const angosto = useAngosto();
  const { escalera, seriesEscalera } = resumen;
  const alto = angosto ? 230 : 290;
  const hayDatos = escalera.length > 0 && seriesEscalera.length > 0;
  const unaSola = seriesEscalera.length === 1;

  return (
    <Card
      titulo={unaSola ? `Escalera de alquileres · ${seriesEscalera[0]}` : "Escalera de alquileres"}
      nota="Cada escalón es un aumento. Entre aumento y aumento el alquiler no se mueve."
    >
      {!hayDatos ? (
        <SinDatos alto={alto / 2}>
          No hay contratos cargados. Con el alquiler inicial y el aumento por escalones, acá
          aparece cómo sube el alquiler de cada propiedad.
        </SinDatos>
      ) : (
        <>
          <div className="px-1 pb-2 pt-4 sm:px-2">
            <ResponsiveContainer width="100%" height={alto}>
              <LineChart data={escalera} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid {...GRILLA} />
                <XAxis
                  dataKey="periodo"
                  tickFormatter={periodoCorto}
                  interval={intervaloTicks(escalera.length, angosto ? 5 : 10)}
                  tickMargin={8}
                  {...EJE}
                />
                {/* Desde cero: si el eje arranca cortado, un 15% parece el doble. */}
                <YAxis
                  tickFormatter={ejeCorto}
                  width={46}
                  tickMargin={4}
                  domain={[0, "auto"]}
                  {...EJE}
                />
                <Tooltip
                  cursor={{ stroke: "var(--color-pista)", strokeWidth: 1 }}
                  content={<Globo orden={seriesEscalera} />}
                />
                {seriesEscalera.map((serie, i) => (
                  <Line
                    key={serie}
                    name={serie}
                    // dataKey por función: un nombre de propiedad con punto
                    // ("Casa de Av. San Martín") rompe el acceso por path.
                    dataKey={(fila: Record<string, number | string>) => fila[serie]}
                    type="stepAfter"
                    stroke={colorSerie(i)}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    // Un contrato que terminó no sigue: el hueco es el dato.
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Con una sola serie el título ya la nombra: la caja sería ruido. */}
          {!unaSola && (
            <Leyenda
              items={seriesEscalera.map((serie, i) => ({
                clave: serie,
                nombre: serie,
                color: colorSerie(i),
              }))}
            />
          )}
        </>
      )}
    </Card>
  );
}

/* --------------------------------------------- 3. composición del ingreso --- */

/** El aire entre segmentos: se recorta el fill y por abajo se ve el papel. */
const AIRE = 2;

function formaSegmento(color: string, conAire: boolean, redondeado: boolean) {
  return function Segmento(p: BarShapeProps) {
    const w = conAire ? p.width - AIRE : p.width;
    if (!(w > 0) || !(p.height > 0)) return null;
    if (redondeado) {
      return <path d={pathBarra(p.x, p.y, w, p.height, "derecha")} fill={color} />;
    }
    return <rect x={p.x} y={p.y} width={w} height={p.height} fill={color} />;
  };
}

export function ComposicionDelIngreso({ resumen }: { resumen: Resumen }) {
  const anio = resumen.periodoActual.slice(0, 4);
  // `resumen.anio` no trae el reintegro: sale de sumar los períodos del año.
  const reintegro = useMemo(
    () =>
      resumen.porPeriodo
        .filter((f) => f.periodo.startsWith(anio))
        .reduce((a, f) => a + f.reintegro, 0),
    [resumen.porPeriodo, anio]
  );

  const { bruto, comision, neto } = resumen.anio;
  // El total es lo facturado: el bruto es alquiler (neto + comisión) y el
  // reintegro de servicios va arriba de eso, no adentro.
  const total = neto + comision + reintegro;

  const partes = [
    { clave: "neto", nombre: "Neto tuyo", color: colorSerie(0), valor: Math.max(0, neto) },
    { clave: "comision", nombre: "Comisión inmobiliaria", color: colorSerie(1), valor: Math.max(0, comision) },
    { clave: "reintegro", nombre: "Reintegro de servicios", color: colorSerie(2), valor: Math.max(0, reintegro) },
  ];
  let ultimoConDato = -1;
  partes.forEach((p, i) => {
    if (p.valor > 0) ultimoConDato = i;
  });

  return (
    <Card
      titulo={`De cada peso facturado en ${anio}`}
      nota="Alquiler más los servicios que te reintegran. El neto es lo que te queda."
    >
      {bruto <= 0 || total <= 0 ? (
        <SinDatos alto={120}>
          Este año todavía no hay alquileres facturados. Cuando el contrato tenga cuotas en {anio},
          acá se parte el total entre lo tuyo, la comisión y los servicios.
        </SinDatos>
      ) : (
        <>
          <div className="px-4 pb-1 pt-4 sm:px-5">
            <ResponsiveContainer width="100%" height={56}>
              <BarChart
                data={[{ nombre: anio, neto, comision, reintegro }]}
                layout="vertical"
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                {/* Dominio fijado al total: la barra ocupa el ancho entero. */}
                <XAxis type="number" domain={[0, total]} hide />
                <YAxis type="category" dataKey="nombre" hide />
                <Tooltip
                  cursor={false}
                  content={
                    <Globo
                      titulo={`Facturado en ${anio}: ${plata(total)}`}
                      orden={partes.map((p) => p.clave)}
                      detalle={(valor) => pct(valor / total)}
                    />
                  }
                />
                {partes.map((p, i) => (
                  <Bar
                    key={p.clave}
                    dataKey={p.clave}
                    name={p.nombre}
                    stackId="facturado"
                    barSize={28}
                    fill={p.color}
                    shape={formaSegmento(p.color, i < ultimoConDato, i === ultimoConDato)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex flex-col gap-1.5 px-4 pb-4 sm:px-5">
            {partes.map((p) => (
              <li key={p.clave} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ background: p.color }}
                  aria-hidden
                />
                <span className="truncate text-suave">{p.nombre}</span>
                <span className="tabular ml-auto font-medium text-tinta">{plata(p.valor)}</span>
                <span className="tabular w-12 text-right text-tenue">{pct(p.valor / total)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/* -------------------------------------------------- 4. gastos por categoría --- */

type TipoGasto = Resumen["gastosPorTipo"][number]["tipo"];

const NOMBRE_GASTO: Partial<Record<TipoGasto, string>> = {
  abl: "ABL",
  agua: "Agua",
  expensas: "Expensas",
  gas: "Gas",
  inmobiliario: "Inmobiliario",
  luz: "Luz",
  mantenimiento: "Mantenimiento",
  otro: "Otros",
  reparacion: "Reparaciones",
  seguro: "Seguro",
};

/** Si mañana aparece un tipo nuevo, se muestra capitalizado en vez de romper. */
const nombreGasto = (t: TipoGasto) => NOMBRE_GASTO[t] ?? t.charAt(0).toUpperCase() + t.slice(1);

export function GastosPorCategoria({ resumen }: { resumen: Resumen }) {
  const angosto = useAngosto();
  const datos = useMemo(
    () =>
      resumen.gastosPorTipo
        .filter((g) => g.monto > 0)
        .map((g) => ({ nombre: nombreGasto(g.tipo), monto: g.monto }))
        .sort((a, b) => b.monto - a.monto),
    [resumen.gastosPorTipo]
  );

  if (datos.length === 0) {
    return (
      <Card
        titulo="Gastos que pagás vos"
        nota="Los que no se reparten con el inquilino."
      >
        <SinDatos alto={120}>
          No hay gastos propios cargados. Los que no se reparten (mantenimiento, impuestos, seguro)
          aparecen acá ordenados de mayor a menor.
        </SinDatos>
      </Card>
    );
  }

  // En celular el importe largo no entra al lado de la barra.
  const formato = angosto ? plataCorta : plata;
  const largoImporte = Math.max(...datos.map((d) => formato(d.monto).length));
  const largoNombre = Math.max(...datos.map((d) => d.nombre.length));
  const alto = datos.length * (angosto ? 30 : 36) + 16;

  return (
    <Card
      titulo="Gastos que pagás vos"
      nota="Los que no se reparten con el inquilino, de mayor a menor."
    >
      <div className="px-1 pb-4 pt-4 sm:px-2">
        <ResponsiveContainer width="100%" height={alto}>
          <BarChart
            data={datos}
            layout="vertical"
            margin={{ top: 2, right: anchoTexto(largoImporte), bottom: 2, left: 0 }}
          >
            {/* Sin eje de valores ni grilla: la etiqueta al final de cada barra
                dice el número exacto, y una cosa sola alcanza. */}
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="nombre"
              width={Math.min(108, anchoTexto(largoNombre))}
              tickMargin={6}
              {...EJE}
            />
            <Tooltip cursor={{ fill: "var(--color-linea)" }} content={<Globo />} />
            {/* Magnitudes del mismo tipo: un solo tono, no colores por categoría. */}
            <Bar
              dataKey="monto"
              name="Gastado"
              fill="var(--color-serie-1)"
              radius={[0, 4, 4, 0]}
              barSize={angosto ? 14 : 18}
            >
              <LabelList
                dataKey="monto"
                position="right"
                offset={8}
                formatter={(v) => formato(Number(v))}
                className="tabular"
                fill="var(--color-suave)"
                fontSize={11}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
