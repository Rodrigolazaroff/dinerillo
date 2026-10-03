import { rutaEmoji } from "@/lib/emoji";

// Un emoji del set propio (Fluent 3D). Decorativo: el texto de al lado dice lo
// mismo, así que el lector de pantalla lo saltea.

const TAMANOS = { xs: 16, sm: 20, md: 24, lg: 32, xl: 48, xxl: 72 } as const;

export function Emoji({
  nombre,
  tamano = "md",
  className = "",
}: {
  nombre: string;
  tamano?: keyof typeof TAMANOS;
  className?: string;
}) {
  const px = TAMANOS[tamano];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 128 px fijos, ya optimizados; next/image no suma nada
    <img
      src={rutaEmoji(nombre)}
      width={px}
      height={px}
      alt=""
      aria-hidden
      draggable={false}
      className={`inline-block shrink-0 select-none ${className}`}
    />
  );
}

/** El emoji dentro de un círculo de color: el "avatar" de cada fila. */
export function BurbujaEmoji({
  nombre,
  tono = "celeste",
  tamano = "md",
}: {
  nombre: string;
  tono?: "celeste" | "lima" | "azul" | "neutro";
  tamano?: "md" | "lg";
}) {
  const fondo = {
    celeste: "bg-celeste-claro",
    lima: "bg-lima-claro",
    azul: "bg-acento-claro",
    neutro: "bg-fondo",
  }[tono];
  const caja = tamano === "lg" ? "h-12 w-12" : "h-10 w-10";
  return (
    <span className={`flex ${caja} shrink-0 items-center justify-center rounded-full ${fondo}`}>
      <Emoji nombre={nombre} tamano={tamano === "lg" ? "lg" : "md"} />
    </span>
  );
}
