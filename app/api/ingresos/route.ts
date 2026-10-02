import { endpoints } from "@/lib/crud";
import { TABLAS } from "@/lib/repo";
import { ingresoSchema } from "@/lib/schemas";

// Las fuentes de ingreso. Archivar es mandar `archivado_at` con la fecha, y
// reactivar es mandarlo vacio.
const h = endpoints(TABLAS.ingresos, ingresoSchema, (v) => ({
  ...v,
  archivado_at: v.archivado_at === undefined ? undefined : v.archivado_at || null,
}));
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
