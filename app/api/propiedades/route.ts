import { endpoints } from "@/lib/crud";
import { propiedadSchema } from "@/lib/schemas";
import { TABLAS } from "@/lib/repo";

const h = endpoints(TABLAS.propiedades, propiedadSchema);
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
