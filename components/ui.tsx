"use client";

import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { EstadoCuota } from "@/lib/calc";

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
    <section
      className={`rounded-xl border border-borde bg-papel shadow-[0_1px_2px_rgba(19,19,22,0.04)] ${className}`}
    >
      {(titulo || accion) && (
        <header className="flex flex-col items-stretch gap-2 border-b border-borde px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight">{titulo}</h2>
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
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-[transform,background-color,color] duration-150 ease-[var(--ease-salida)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento";
  const tam = {
    sm: "px-2.5 py-2 text-xs sm:py-1.5",
    md: "px-3.5 py-2.5 text-sm sm:py-2",
    // 44px es el minimo que se toca sin errarle en un celular.
    icono: "h-11 w-11 shrink-0 p-0 sm:h-9 sm:w-9",
  }[tamano];
  const v = {
    primario: "bg-acento text-white hover:bg-acento/90",
    secundario: "border border-borde bg-papel text-tinta hover:bg-fondo",
    fantasma: "text-suave hover:bg-fondo hover:text-tinta",
    peligro: "text-peligro hover:bg-peligro/10",
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
  "w-full rounded-lg border border-borde bg-papel px-3 py-2.5 text-tinta placeholder:text-tenue focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/15 sm:py-2 sm:text-sm";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputBase} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${inputBase} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputBase} min-h-20 resize-y ${className}`} {...props} />;
}

/** Input de plata: teclado numérico en el celular y alineado a la derecha. */
export function InputPlata({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-tenue">$</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`${inputBase} tabular pl-7 text-right ${className}`}
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
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${e.clase} ${className}`}
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
    <div className={`rounded-xl border border-borde bg-papel px-3.5 py-3 ${className}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-tenue">{etiqueta}</p>
      <p className={`tabular mt-1 text-xl font-semibold leading-none tracking-tight sm:text-2xl ${color}`}>
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
        className={`h-full rounded-full transition-[width] duration-500 ease-[var(--ease-salida)] ${
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
}: {
  titulo: string;
  children?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm font-semibold">{titulo}</p>
      {children && <p className="max-w-xs text-xs leading-relaxed text-suave">{children}</p>}
      {accion}
    </div>
  );
}

/**
 * Panel de carga. En celular sube desde abajo, donde está el pulgar; en
 * escritorio queda centrado.
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
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", onKey);
    // Sin scroll del fondo mientras el panel está abierto.
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previo;
    };
  }, [abierto, cerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <button
        className="absolute inset-0 bg-tinta/35 backdrop-blur-[2px]"
        onClick={cerrar}
        aria-label="Cerrar"
        tabIndex={-1}
      />
      <div className="panel-entra relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-borde bg-papel shadow-xl sm:max-w-lg sm:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-borde px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight">{titulo}</h3>
          <Boton variante="fantasma" tamano="icono" onClick={cerrar} aria-label="Cerrar">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </Boton>
        </header>
        <div
          className="scroll-x flex-1 overflow-y-auto px-4 py-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
        {pie && (
          <footer
            className="shrink-0 border-t border-borde bg-papel px-4 py-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            {pie}
          </footer>
        )}
      </div>
    </div>
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
    <div className={`inline-flex rounded-lg border border-borde bg-papel p-0.5 ${className}`} role="tablist">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={valor === o.valor}
          onClick={() => onCambio(o.valor)}
          className={`rounded-[6px] px-2.5 py-1.5 text-xs font-medium transition-colors ${
            valor === o.valor ? "bg-acento text-white" : "text-suave hover:text-tinta"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
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
