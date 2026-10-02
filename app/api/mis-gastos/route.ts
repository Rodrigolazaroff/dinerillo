import { endpoints, vacioANulo } from "@/lib/crud";
import { TABLAS } from "@/lib/repo";
import { miGastoSchema, type MiGastoInput } from "@/lib/schemas";

const h = endpoints(TABLAS.misGastos, miGastoSchema, vacioANulo<MiGastoInput>("categoria_id"));
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
