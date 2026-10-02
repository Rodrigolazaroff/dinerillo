import { endpoints, vacioANulo } from "@/lib/crud";
import { TABLAS } from "@/lib/repo";
import { divGastoSchema, type DivGastoInput } from "@/lib/schemas";

const h = endpoints(TABLAS.divGastos, divGastoSchema, vacioANulo<DivGastoInput>("categoria_id"));
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
