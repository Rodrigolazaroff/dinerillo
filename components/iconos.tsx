// Iconos de la barra inferior. Trazo de 1.6px: a 24px un trazo de 2px se ve
// tosco y uno de 1px desaparece en pantallas sin retina.

type Props = { className?: string };

const base = "h-6 w-6 transition-transform duration-150 ease-[var(--ease-salida)]";

export function IconoResumen({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 19h16" strokeLinecap="round" />
      <path d="M7 19v-6M12 19V6M17 19v-9" strokeLinecap="round" />
    </svg>
  );
}

export function IconoCobros({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 12h.01M17.5 12h.01" strokeLinecap="round" />
    </svg>
  );
}

export function IconoGastos({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M12 3.5c3 3.6 4.8 6.2 4.8 8.5a4.8 4.8 0 0 1-9.6 0C7.2 9.7 9 7.1 12 3.5Z" strokeLinejoin="round" />
      <path d="M12 17.2a2.9 2.9 0 0 0 2.9-2.9" strokeLinecap="round" />
    </svg>
  );
}

export function IconoContratos({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M6 3.5h8.5L19 8v12.5H6z" strokeLinejoin="round" />
      <path d="M14 3.5V8h5" strokeLinejoin="round" />
      <path d="M9 12.5h6M9 16h4" strokeLinecap="round" />
    </svg>
  );
}

export function IconoAjustes({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" strokeLinecap="round" />
    </svg>
  );
}

export function IconoMas({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 20 20" className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10 4.5v11M4.5 10h11" strokeLinecap="round" />
    </svg>
  );
}

export function IconoCheck({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 20 20" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconoAlerta({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 20 20" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M10 3.2 18 17H2z" strokeLinejoin="round" />
      <path d="M10 8v3.6M10 14.2h.01" strokeLinecap="round" />
    </svg>
  );
}

export function IconoReloj({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 20 20" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M10 6v4.3l2.8 1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconoDescargar({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 20 20" className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M10 3v9m0 0 3.2-3.2M10 12 6.8 8.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 14.5v1A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5v-1" strokeLinecap="round" />
    </svg>
  );
}

export function IconoLapiz({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 20 20" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M13.2 3.6l3.2 3.2L7.6 15.6l-3.9.7.7-3.9z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconoTacho({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 20 20" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M3.8 6h12.4M8 3.6h4M5.5 6l.7 10.4h7.6L14.5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconoInicio({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 11.2 12 4.5l8 6.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10.5V19.5h12v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconoIngresos({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M12 19V6M6.5 11.5 12 6l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20h14" strokeLinecap="round" />
    </svg>
  );
}

export function IconoDivision({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="8.5" cy="9" r="3" />
      <circle cx="15.5" cy="9" r="3" />
      <path d="M3.5 19c.6-2.8 2.6-4.5 5-4.5s4.4 1.7 5 4.5M13.6 15c.6-.3 1.2-.5 1.9-.5 2.4 0 4.4 1.7 5 4.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconoOjo({ abierto = true, className = "" }: Props & { abierto?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.8" />
      {!abierto && <path d="M4 20 20 4" strokeLinecap="round" />}
    </svg>
  );
}

export function IconoFlecha({ direccion = "derecha", className = "" }: Props & { direccion?: "izquierda" | "derecha" }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d={direccion === "derecha" ? "M8 5l5 5-5 5" : "M12 5l-5 5 5 5"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
