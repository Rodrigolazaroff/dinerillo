// Ideas, críticas y comentarios de los usuarios (tabla `mejoras`, migración 0007).

export type TipoMejora = "idea" | "problema" | "critica" | "otro";
export type EstadoMejora = "nueva" | "la_hacemos" | "hecha" | "no_por_ahora";

export const TIPOS_MEJORA: { valor: TipoMejora; label: string }[] = [
  { valor: "idea", label: "Idea" },
  { valor: "problema", label: "Algo falla" },
  { valor: "critica", label: "Crítica" },
  { valor: "otro", label: "Otro" },
];

/** El estado nunca viaja solo en el color: siempre con su texto. */
export const ESTADOS_MEJORA: Record<EstadoMejora, { texto: string; clase: string }> = {
  nueva: { texto: "Recibida", clase: "bg-fondo text-tenue ring-borde" },
  la_hacemos: { texto: "La hacemos", clase: "bg-acento-claro text-acento ring-acento/20" },
  hecha: { texto: "Hecha", clase: "bg-ok-claro text-ok ring-ok/20" },
  no_por_ahora: { texto: "No por ahora", clase: "bg-espera-claro text-espera ring-espera/25" },
};

export const etiquetaTipo = (t: TipoMejora) => TIPOS_MEJORA.find((x) => x.valor === t)?.label ?? t;
