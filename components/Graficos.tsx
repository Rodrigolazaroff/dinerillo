"use client";

/**
 * Los gráficos de la app: la escalera de cada contrato y el mes a mes de Inicio.
 *
 * Reglas que no se negocian acá: un solo eje Y por gráfico y desde cero, grilla
 * recesiva, tooltip propio y números siempre en color de texto — el color de
 * serie vive en la marca, nunca en el importe. Con el ojito cerrado no se
 * dibujan: el alto de una barra ya cuenta cuánto es.
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type TooltipContentProps,
} from "recharts";
import { usePrivado } from "@/components/Privado";
import { Card } from "@/components/ui";
import type { Cuota } from "@/lib/calc";
import type { MesSerie } from "@/lib/finanzas";
import { ejeCorto, periodoActual, periodoCorto, periodoLargo, plata, plataCorta } from "@/lib/format";

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

export const colorSerie = (i: number) => SERIES[Math.min(Math.max(i, 0), SERIES.length - 1)];

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

/** Con "reducir movimiento", las barras aparecen ya crecidas. */
function useSinMovimiento(): boolean {
  const [quieto, setQuieto] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const leer = () => setQuieto(mq.matches);
    leer();
    mq.addEventListener("change", leer);
    return () => mq.removeEventListener("change", leer);
  }, []);
  return quieto;
}

/** A 360px no entran doce etiquetas de mes: se muestra una cada 2 o 3. */
function intervaloTicks(n: number, maximo: number): number {
  return n <= maximo ? 0 : Math.ceil(n / maximo) - 1;
}

/**
 * Rectángulo con las puntas redondeadas sólo en la punta del dato.
 *
 * La barra tiene que quedar apoyada en el cero: redondear el arranque corre la
 * base de lugar y el ojo lee un valor que no está.
 */
function pathBarra(x: number, y: number, w: number, h: number, punta: "arriba" | "abajo", r = 4): string {
  if (!(w > 0) || !(h > 0)) return "";
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  if (punta === "arriba") {
    return `M${x},${y + h} L${x},${y + q} Q${x},${y} ${x + q},${y} L${x + w - q},${y} Q${x + w},${y} ${x + w},${y + q} L${x + w},${y + h} Z`;
  }
  return `M${x},${y} L${x + w},${y} L${x + w},${y + h - q} Q${x + w},${y + h} ${x + w - q},${y + h} L${x + q},${y + h} Q${x},${y + h} ${x},${y + h - q} Z`;
}

/* ------------------------------------------------------- piezas comunes --- */

/** El marco del tooltip: los importes con `plata()` y tabulares, como en toda la app. */
function Globo({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <div className="pointer-events-none min-w-40 rounded-lg border border-borde bg-papel px-3 py-2 text-xs shadow-[0_6px_20px_rgba(19,19,22,0.10)]">
      <p className="mb-1.5 font-semibold text-tinta first-letter:uppercase">{titulo}</p>
      {children}
    </div>
  );
}

function Renglon({ nombre, valor, color, fuerte = false }: { nombre: string; valor: number; color?: string; fuerte?: boolean }) {
  return (
    <p className="flex items-center gap-2">
      {color && <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: color }} aria-hidden />}
      <span className={fuerte ? "font-medium text-tinta" : "text-suave"}>{nombre}</span>
      <span className={`tabular ml-auto text-tinta ${fuerte ? "font-semibold" : "font-medium"}`}>{plata(valor)}</span>
    </p>
  );
}

/** Un gráfico en blanco no explica nada: el vacío lo dice en una línea. */
function SinDatos({ alto = 150, children }: { alto?: number; children: ReactNode }) {
  return (
    <div className="flex items-center justify-center px-6 py-8 text-center" style={{ minHeight: alto }}>
      <p className="max-w-[38ch] text-xs leading-relaxed text-tenue">{children}</p>
    </div>
  );
}

/* --------------------------------------------- escalera de un contrato --- */

type PuntoEscalera = { periodo: string; bruto: number; fijado: boolean };

function GloboEscalera({ active, payload, color }: Partial<TooltipContentProps> & { color: string }) {
  const p = active ? (payload?.[0]?.payload as PuntoEscalera | undefined) : undefined;
  if (!p) return null;
  return (
    <Globo titulo={periodoLargo(p.periodo)}>
      <Renglon nombre={p.fijado ? "Alquiler (a mano)" : "Alquiler"} valor={p.bruto} color={color} />
    </Globo>
  );
}

/**
 * Cómo sube el alquiler de un contrato, mes a mes. Escalones (`stepAfter`):
 * entre aumento y aumento el alquiler no se mueve, e interpolar mentiría. El
 * eje arranca en cero: cortado, un 15% parece el doble.
 */
export function EscaleraContrato({
  cuotas,
  hoy,
  slot,
}: {
  cuotas: Cuota[];
  /** Período de hoy (YYYY-MM): la línea "hoy", si cae adentro del contrato. */
  hoy: string;
  /** Slot de la paleta de la propiedad (0 a 7): el mismo en toda la app. */
  slot: number;
}) {
  const [oculto] = usePrivado();
  const angosto = useAngosto();
  if (oculto || cuotas.length < 2) return null;

  const datos: PuntoEscalera[] = cuotas.map((q) => ({ periodo: q.periodo, bruto: q.bruto, fijado: q.fijado }));
  const color = colorSerie(slot);
  const conHoy = datos.some((d) => d.periodo === hoy);

  return (
    <ResponsiveContainer width="100%" height={angosto ? 120 : 140}>
      <LineChart data={datos} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid {...GRILLA} />
        <XAxis
          dataKey="periodo"
          tickFormatter={periodoCorto}
          interval={intervaloTicks(datos.length, angosto ? 4 : 8)}
          tickMargin={6}
          {...EJE}
        />
        <YAxis tickFormatter={ejeCorto} width={40} tickMargin={4} tickCount={3} domain={[0, "auto"]} {...EJE} />
        <Tooltip
          cursor={{ stroke: "var(--color-pista)", strokeWidth: 1 }}
          content={<GloboEscalera color={color} />}
        />
        {conHoy && (
          <ReferenceLine
            x={hoy}
            stroke="var(--color-tenue)"
            strokeDasharray="3 3"
            label={{ value: "hoy", position: "top", fill: "var(--color-suave)", fontSize: 11 }}
          />
        )}
        <Line
          dataKey="bruto"
          name="Alquiler"
          type="stepAfter"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          // Una escalera no se "dibuja": es el dato, aparece entero.
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------ mes a mes --- */

function GloboMes({ active, payload, enCurso }: Partial<TooltipContentProps> & { enCurso: string }) {
  const m = active ? (payload?.[0]?.payload as MesSerie | undefined) : undefined;
  if (!m) return null;
  return (
    <Globo titulo={`${periodoLargo(m.periodo)}${m.periodo === enCurso ? " · en curso" : ""}`}>
      <Renglon nombre="Entró" valor={m.ingresos} />
      <Renglon nombre="Salió" valor={m.gastos} />
      <div className="mt-1.5 border-t border-borde pt-1.5">
        <Renglon nombre="Te quedó" valor={m.quedo} fuerte />
      </div>
    </Globo>
  );
}

/**
 * La barra de cada mes. Verde si sobró, roja si faltó (con el texto del
 * tooltip y el signo del eje al lado: el color no va solo). El mes en curso
 * va a media tinta porque todavía no terminó, y el mes elegido lleva su valor.
 */
function formaQuedo(actual: string, enCurso: string) {
  return function BarraQuedo(p: BarShapeProps) {
    const m = p.payload as MesSerie;
    // Recharts dibuja los negativos con alto negativo, desde la punta hacia el cero.
    const negativo = p.height < 0;
    const y = negativo ? p.y + p.height : p.y;
    const h = Math.abs(p.height);
    const d = pathBarra(p.x, y, p.width, h, negativo ? "abajo" : "arriba", 3);
    return (
      <g>
        {d && (
          <path
            d={d}
            fill={negativo ? "var(--color-serie-8)" : "var(--color-serie-3)"}
            fillOpacity={m.periodo === enCurso ? 0.5 : 1}
          />
        )}
        {m.periodo === actual && (
          <text
            x={p.x + p.width / 2}
            y={negativo ? y + h + 13 : y - 6}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="var(--color-tinta)"
            className="tabular"
          >
            {plataCorta(m.quedo)}
          </text>
        )}
      </g>
    );
  };
}

/** El año de un vistazo: cuánto te quedó cada mes. Entró y salió, en el tooltip. */
export function IngresosVsGastos({ serie, actual }: { serie: MesSerie[]; actual: string }) {
  const [oculto] = usePrivado();
  const angosto = useAngosto();
  const sinMovimiento = useSinMovimiento();
  if (oculto) return null;

  const datos = angosto ? serie.slice(-6) : serie;
  const hayAlgo = datos.some((m) => m.ingresos > 0 || m.gastos > 0);
  const hayNegativos = datos.some((m) => m.quedo < 0);
  const enCurso = periodoActual();
  const alto = angosto ? 200 : 240;

  return (
    <Card titulo="Mes a mes">
      {!hayAlgo ? (
        <SinDatos alto={alto / 2}>Todavía no hay movimientos.</SinDatos>
      ) : (
        <div className="px-1 pb-3 pt-4 sm:px-2">
          <ResponsiveContainer width="100%" height={alto}>
            <BarChart data={datos} margin={{ top: 18, right: 8, bottom: hayNegativos ? 4 : 0, left: 0 }} barCategoryGap="28%">
              <CartesianGrid {...GRILLA} />
              {/* El mes elegido, con una banda detrás: es el que estás mirando. */}
              <ReferenceArea x1={actual} x2={actual} fill="var(--color-celeste-claro)" fillOpacity={1} />
              <XAxis
                dataKey="periodo"
                tickFormatter={periodoCorto}
                interval={intervaloTicks(datos.length, angosto ? 6 : 12)}
                tickMargin={8}
                {...EJE}
              />
              <YAxis
                tickFormatter={ejeCorto}
                width={46}
                tickMargin={4}
                domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
                {...EJE}
              />
              {hayNegativos && <ReferenceLine y={0} stroke="var(--color-borde)" />}
              <Tooltip cursor={{ fill: "var(--color-linea)" }} content={<GloboMes enCurso={enCurso} />} />
              <Bar
                dataKey="quedo"
                name="Te quedó"
                fill="var(--color-serie-3)"
                shape={formaQuedo(actual, enCurso)}
                isAnimationActive={!sinMovimiento}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
