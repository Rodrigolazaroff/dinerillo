import { endpoints } from "@/lib/crud";
import { TABLAS } from "@/lib/repo";
import { gastoSchema } from "@/lib/schemas";

// Las boletas que se reparten. En la base, "todas las propiedades" y "sin
// fecha" son null, no un texto vacio: asi la clave foranea no se queja.
const h = endpoints(TABLAS.boletas, gastoSchema, (v) => ({
  ...v,
  fecha: v.fecha === undefined ? undefined : v.fecha || null,
  propiedad_id: v.propiedad_id === undefined ? undefined : v.propiedad_id || null,
}));

export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
