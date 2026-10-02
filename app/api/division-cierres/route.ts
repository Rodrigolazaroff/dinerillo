import { endpoints } from "@/lib/crud";
import { TABLAS } from "@/lib/repo";
import { divCierreSchema } from "@/lib/schemas";

// Marcar el ajuste del mes como transferido. Deshacerlo es borrarlo.
const h = endpoints(TABLAS.divCierres, divCierreSchema);
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
