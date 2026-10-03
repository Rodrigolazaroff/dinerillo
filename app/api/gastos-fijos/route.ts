import { endpoints, vacioANulo } from "@/lib/crud";
import { TABLAS } from "@/lib/repo";
import { gastoFijoSchema } from "@/lib/schemas";

const h = endpoints(TABLAS.gastosFijos, gastoFijoSchema, vacioANulo("categoria_id"));
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
