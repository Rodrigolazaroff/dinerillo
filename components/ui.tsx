"use client";

import {
  useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore,
  type ButtonHTMLAttributes, type ChangeEvent, type FocusEvent, type InputHTMLAttributes, type KeyboardEvent as EventoTecla,
  type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Emoji } from "@/components/Emoji";
import type { EstadoCuota } from "@/lib/calc";
import { enmascararMonto } from "@/lib/format";

export function Card({
  children,
  className = "",
  titulo,
  accion,
  nota,
}: {
  children?: ReactNode;
  className?: string;
  titulo?: ReactNode;
  accion?: ReactNode;
  nota?: ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-borde bg-papel ${className}`}>
      {(titulo || accion) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-linea px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="titulo text-base font-semibold">{titulo}</h2>
            {nota && <p className="mt-0.5 text-[11px] text-tenue">{nota}</p>}
          </div>
          {accion}
        </header>
      )}
      {children}
    </section>
  );
}

type BotonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "fantasma" | "peligro";
  tamano?: "sm" | "md" | "icono";
};

/**
 * Las clases del boton, sueltas.
 *
 * Un <button> adentro de un <a> es HTML invalido y el navegador se come el
 * click: cuando lo que hace falta es navegar, se viste el <Link> con esto.
 */
export function clasesBoton(
  variante: "primario" | "secundario" | "fantasma" | "peligro" = "primario",
  tamano: "sm" | "md" | "icono" = "md"
) {
  // Píldoras: es lo que se toca. Al apretar se hunden un poco, como un botón de verdad.
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-[transform,background-color,color,box-shadow,border-color] duration-150 ease-[var(--ease-quart)] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento";
  const tam = {
    sm: "px-3 py-2 text-xs sm:py-1.5",
    md: "px-4 py-2.5 text-sm",
    // 44px es el minimo que se toca sin errarle en un celular.
    icono: "h-11 w-11 shrink-0 p-0 sm:h-9 sm:w-9",
  }[tamano];
  // Lima con tinta: la acción principal salta a la vista sobre blanco y sobre azul.
  const v = {
    primario: "bg-lima text-tinta shadow-[0_1px_0_oklch(0.75_0.17_128)] hover:brightness-[1.03]",
    secundario: "border border-borde bg-papel text-tinta hover:border-celeste hover:bg-celeste-claro",
    fantasma: "text-suave hover:bg-celeste-claro hover:text-tinta",
    peligro: "text-peligro hover:bg-peligro-claro",
  }[variante];
  return `${base} ${tam} ${v}`;
}

export function Boton({
  variante = "primario",
  tamano = "md",
  className = "",
  ...props
}: BotonProps) {
  return (
    <button type="button" className={`${clasesBoton(variante, tamano)} ${className}`} {...props} />
  );
}

export function Campo({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-suave">{label}</span>
      {children}
      {hint && <span className="text-[11px] leading-snug text-tenue">{hint}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl border border-borde bg-papel px-3.5 py-3 text-tinta placeholder:text-tenue transition-[border-color,box-shadow] duration-150 focus:border-acento focus:outline-none focus:ring-4 focus:ring-acento/15 sm:py-2.5 sm:text-sm";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputBase} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${inputBase} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputBase} min-h-20 resize-y ${className}`} {...props} />;
}

/** Dónde va el cursor: después de la misma cantidad de cifras que tenía antes. */
function posicionTras(texto: string, cifras: number): number {
  if (cifras <= 0) return 0;
  let vistas = 0;
  for (let i = 0; i < texto.length; i++) {
    if (/\d/.test(texto[i]) && ++vistas === cifras) return i + 1;
  }
  return texto.length;
}

/**
 * Input de plata: teclado numérico y el número formateado mientras se
 * escribe ("1.234.567,89"), con el símbolo de su moneda adelante.
 *
 * El valor sigue siendo el texto del campo: quien lo usa lo lee con
 * `aNumero` como siempre. La máscara reescribe `e.target.value` antes de
 * pasarle el evento, así ninguna pantalla tiene que cambiar.
 */
export function InputPlata({
  className = "",
  simbolo = "$",
  grande = false,
  decimales = 2,
  onChange,
  onKeyDown,
  onBlur,
  value,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  simbolo?: string;
  /** El importe protagonista de un formulario: número grande. */
  grande?: boolean;
  decimales?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);

  // React repinta el valor y el navegador manda el cursor al final: se
  // vuelve a poner donde estaba, contando cifras y no caracteres.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && cursor.current !== null && document.activeElement === el) {
      el.setSelectionRange(cursor.current, cursor.current);
    }
    cursor.current = null;
  });

  function alCambiar(e: ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const crudo = el.value;
    const fin = el.selectionStart ?? crudo.length;
    const nuevo = enmascararMonto(crudo, String(value ?? ""), decimales);
    let pos = posicionTras(nuevo, crudo.slice(0, fin).replace(/\D/g, "").length);
    // Recién tipeada la coma (o el punto que hace de coma): el cursor la pasa.
    if (/[.,]/.test(crudo[fin - 1] ?? "") && nuevo[pos] === ",") pos++;
    el.value = nuevo;
    cursor.current = pos;
    if (document.activeElement === el) el.setSelectionRange(pos, pos);
    onChange?.(e);
  }

  // Borrar justo después de un punto de miles: el punto vuelve a aparecer y
  // parece que la tecla no anda. Se corre el cursor y se borra la cifra.
  function alTeclear(e: EventoTecla<HTMLInputElement>) {
    const el = e.currentTarget;
    const i = el.selectionStart ?? 0;
    if (i === el.selectionEnd) {
      if (e.key === "Backspace" && el.value[i - 1] === ".") el.setSelectionRange(i - 1, i - 1);
      if (e.key === "Delete" && el.value[i] === ".") el.setSelectionRange(i + 1, i + 1);
    }
    onKeyDown?.(e);
  }

  // "1.234," a medio escribir queda "1.234" al salir del campo.
  function alSalir(e: FocusEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    if (/,$/.test(el.value)) {
      el.value = el.value.slice(0, -1);
      onChange?.({ ...e, target: el, currentTarget: el } as unknown as ChangeEvent<HTMLInputElement>);
    }
    onBlur?.(e);
  }

  return (
    <div
      className={`flex w-full items-center gap-1.5 rounded-xl border border-borde bg-papel px-3.5 transition-[border-color,box-shadow] duration-150 focus-within:border-acento focus-within:ring-4 focus-within:ring-acento/15 ${
        props.disabled ? "opacity-60" : ""
      }`}
    >
      <span
        className={`pointer-events-none shrink-0 font-semibold text-tenue ${grande ? "numero text-xl" : "text-sm"}`}
        aria-hidden
      >
        {simbolo}
      </span>
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        value={value}
        onChange={alCambiar}
        onKeyDown={alTeclear}
        onBlur={alSalir}
        className={`tabular min-w-0 flex-1 bg-transparent py-3 text-right text-tinta placeholder:text-tenue focus:outline-none ${
          grande ? "numero text-3xl font-bold sm:py-2.5 sm:text-3xl" : "sm:py-2.5 sm:text-sm"
        } ${className}`}
        {...props}
      />
    </div>
  );
}

export function InputPct({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`${inputBase} tabular pr-7 text-right ${className}`}
        {...props}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-tenue">%</span>
    </div>
  );
}

export function Aviso({
  tipo = "error",
  children,
}: {
  tipo?: "error" | "info" | "ok";
  children?: ReactNode;
}) {
  if (!children) return null;
  const s = {
    error: "bg-peligro-claro text-peligro ring-peligro/20",
    info: "bg-espera-claro text-espera ring-espera/20",
    ok: "bg-ok-claro text-ok ring-ok/20",
  }[tipo];
  return <p className={`rounded-lg px-3 py-2 text-xs ring-1 ring-inset ${s}`}>{children}</p>;
}

const ESTADOS: Record<EstadoCuota, { texto: string; clase: string; punto: string }> = {
  cobrado: { texto: "Cobrado", clase: "bg-ok-claro text-ok ring-ok/20", punto: "bg-ok" },
  parcial: { texto: "Parcial", clase: "bg-espera-claro text-espera ring-espera/25", punto: "bg-espera" },
  vencido: { texto: "Vencido", clase: "bg-peligro-claro text-peligro ring-peligro/20", punto: "bg-peligro" },
  pendiente: { texto: "Pendiente", clase: "bg-acento-claro text-acento ring-acento/20", punto: "bg-acento" },
  futuro: { texto: "Más adelante", clase: "bg-fondo text-tenue ring-borde", punto: "bg-tenue" },
};

/** El estado nunca viaja solo en el color: siempre lleva su texto al lado. */
export function Estado({ estado, className = "" }: { estado: EstadoCuota; className?: string }) {
  const e = ESTADOS[estado];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${e.clase} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${e.punto}`} aria-hidden />
      {e.texto}
    </span>
  );
}

/**
 * Ficha de un número. Un valor solo no es un gráfico de una barra: cuando hay
 * un número que importa, va grande y sin decoración.
 */
export function Kpi({
  etiqueta,
  valor,
  detalle,
  tono = "neutro",
  className = "",
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  tono?: "neutro" | "ok" | "espera" | "peligro" | "acento";
  className?: string;
}) {
  const color = {
    neutro: "text-tinta",
    ok: "text-ok",
    espera: "text-espera",
    peligro: "text-peligro",
    acento: "text-acento",
  }[tono];
  return (
    <div className={`rounded-2xl border border-borde bg-papel px-4 py-3.5 ${className}`}>
      <p className="text-xs font-medium text-suave">{etiqueta}</p>
      <p className={`numero mt-1.5 text-2xl font-bold sm:text-[1.7rem] ${color}`}>
        {valor}
      </p>
      {detalle && <p className="mt-1.5 text-[11px] leading-snug text-suave">{detalle}</p>}
    </div>
  );
}

/** Medidor de una razón contra un límite. Mismo tono, no un semáforo. */
export function Medidor({ parte, total, tono = "ok" }: { parte: number; total: number; tono?: "ok" | "acento" }) {
  const p = total > 0 ? Math.min(100, Math.max(0, (parte / total) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-pista" role="presentation">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-[var(--ease-salida)] ${
          tono === "ok" ? "bg-ok" : "bg-acento"
        }`}
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

export function Vacio({
  titulo,
  children,
  accion,
  emoji,
}: {
  titulo: string;
  children?: ReactNode;
  accion?: ReactNode;
  /** Un emoji grande arriba: el vacío invita, no reta. */
  emoji?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      {emoji && <Emoji nombre={emoji} tamano="xxl" className="flota" />}
      <p className="titulo text-base font-semibold">{titulo}</p>
      {children && <p className="max-w-xs text-xs leading-relaxed text-suave">{children}</p>}
      {accion}
    </div>
  );
}

/**
 * Lo que de verdad se ve de la pantalla. Con el teclado abierto el celular
 * achica esta área (y en iOS la corre): el diálogo se centra adentro de ella
 * y no queda tapado.
 */
function useAreaVisible(activo: boolean) {
  const [area, setArea] = useState<{ alto: number; arriba: number } | null>(null);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!activo || !vv) return;
    const medir = () => setArea({ alto: vv.height, arriba: vv.offsetTop });
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, [activo]);
  return area;
}

/**
 * Los paneles abiertos, el de más arriba al final. Un panel puede abrir otro
 * (el emoji adentro del ingreso): Esc cierra solo el de arriba.
 */
const pila: object[] = [];

const nada = () => () => {};

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Panel de carga: una tarjeta flotante en el medio de la pantalla, en el
 * celular y en la compu.
 *
 * Al abrir, el foco va al diálogo y no a un campo: el teclado no salta solo,
 * se abre cuando tocás dónde escribir.
 */
export function Panel({
  abierto,
  cerrar,
  titulo,
  children,
  pie,
}: {
  abierto: boolean;
  cerrar: () => void;
  titulo: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const area = useAreaVisible(abierto);
  // En el server no hay document: el portal se arma recién en el navegador.
  const enNavegador = useSyncExternalStore(nada, () => true, () => false);
  // Quien lo usa suele pasar una flecha nueva en cada render: se guarda acá
  // para no rearmar los efectos (y robar el foco) mientras escribís.
  const alCerrar = useRef(cerrar);
  useEffect(() => {
    alCerrar.current = cerrar;
  });

  useEffect(() => {
    if (!abierto || !enNavegador) return;
    const yo = {};
    pila.push(yo);
    const antes = document.activeElement as HTMLElement | null;
    caja.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      // Un campo que usa Esc para lo suyo (cancelar una categoría nueva) lo marca.
      if (e.key === "Escape" && !e.defaultPrevented && pila[pila.length - 1] === yo) alCerrar.current();
    };
    document.addEventListener("keydown", onKey);
    // Sin scroll del fondo mientras el panel está abierto.
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      pila.splice(pila.indexOf(yo), 1);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previo;
      // Volver a un campo de texto abriría el teclado otra vez.
      if (antes && !antes.matches("input, textarea, select")) antes.focus?.({ preventScroll: true });
    };
  }, [abierto, enNavegador]);

  /** El Tab da vueltas adentro del diálogo, no se escapa al fondo. */
  function atraparTab(e: EventoTecla<HTMLDivElement>) {
    if (e.key !== "Tab" || !caja.current) return;
    const lista = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)];
    if (!lista.length) return;
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    if (e.shiftKey && (document.activeElement === primero || document.activeElement === caja.current)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  }

  if (!abierto || !enNavegador) return null;

  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-50 flex h-dvh items-center justify-center p-3 sm:p-6"
      style={area ? { height: area.alto, transform: `translateY(${area.arriba}px)` } : undefined}
    >
      <button
        className="fondo-entra absolute inset-0 bg-tinta/40 backdrop-blur-[2px]"
        onClick={() => alCerrar.current()}
        aria-label="Cerrar"
        tabIndex={-1}
      />
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onKeyDown={atraparTab}
        className="panel-entra relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-papel shadow-[0_24px_48px_-12px_oklch(0.24_0.06_264/0.35)] focus:outline-none sm:max-w-lg"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 px-5 pb-1 pt-4">
          <h3 id={idTitulo} className="titulo text-lg font-bold">
            {titulo}
          </h3>
          <Boton variante="fantasma" tamano="icono" onClick={() => alCerrar.current()} aria-label="Cerrar" className="-mr-2">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </Boton>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-3">{children}</div>
        {pie && <footer className="shrink-0 border-t border-linea bg-papel px-5 py-3.5">{pie}</footer>}
      </div>
    </div>,
    document.body
  );
}

/** Filtro de una sola fila, arriba de los gráficos. */
export function Segmentado<T extends string>({
  valor,
  opciones,
  onCambio,
  className = "",
}: {
  valor: T;
  opciones: { valor: T; label: string }[];
  onCambio: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex rounded-full bg-celeste-claro p-1 ${className}`} role="tablist">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={valor === o.valor}
          onClick={() => onCambio(o.valor)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] duration-200 ease-[var(--ease-quart)] ${
            valor === o.valor
              ? "bg-papel text-acento shadow-[0_1px_3px_oklch(0.24_0.06_264/0.12)]"
              : "text-suave hover:text-tinta"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Sí o no, con el texto al lado: toda la fila se toca. */
export function Interruptor({
  activo,
  onCambio,
  children,
  detalle,
  disabled,
}: {
  activo: boolean;
  onCambio: (v: boolean) => void;
  children: ReactNode;
  detalle?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => onCambio(!activo)}
      className="flex min-h-11 w-full items-center justify-between gap-3 text-left disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{children}</span>
        {detalle && <span className="block text-xs text-tenue">{detalle}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ease-[var(--ease-quart)] ${
          activo ? "bg-acento" : "bg-pista"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-papel shadow-sm transition-[left] duration-200 ease-[var(--ease-quart)] ${
            activo ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

export function Fila({ label, valor, fuerte = false }: { label: ReactNode; valor: ReactNode; fuerte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={`text-xs ${fuerte ? "font-medium text-tinta" : "text-suave"}`}>{label}</span>
      <span className={`tabular text-sm ${fuerte ? "font-semibold" : ""}`}>{valor}</span>
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-xs text-tenue">
      <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
      </svg>
      {texto}
    </div>
  );
}

/**
 * El "+" de cargar, abajo a la derecha y arriba de la barra de pestañas: donde
 * llega el pulgar. En escritorio no hace falta, el botón ya está arriba.
 */
export function BotonFlotante({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="no-print fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-lima text-tinta shadow-[0_6px_8px_-2px_oklch(0.24_0.06_264/0.25)] transition-transform duration-150 ease-[var(--ease-quart)] active:scale-[0.92] sm:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }}
    >
      <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d="M10 4v12M4 10h12" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** Barras horizontales por categoría: una lista que se lee, no un gráfico de torta. */
export function BarraParte({ parte, total, color }: { parte: number; total: number; color: string }) {
  const p = total > 0 ? Math.max(2, Math.min(100, (parte / total) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-pista" role="presentation">
      <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
    </div>
  );
}
