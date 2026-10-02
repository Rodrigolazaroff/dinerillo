import { endpoints } from "@/lib/crud";
import { contratoSchema } from "@/lib/schemas";
import { TABLAS } from "@/lib/repo";

const h = endpoints(TABLAS.contratos, contratoSchema);
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
