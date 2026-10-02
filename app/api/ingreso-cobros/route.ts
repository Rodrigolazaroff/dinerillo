import { endpoints } from "@/lib/crud";
import { TABLAS } from "@/lib/repo";
import { ingresoCobroSchema } from "@/lib/schemas";

const h = endpoints(TABLAS.ingresoCobros, ingresoCobroSchema);
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
