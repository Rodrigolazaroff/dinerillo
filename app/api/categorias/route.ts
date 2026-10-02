import { endpoints } from "@/lib/crud";
import { TABLAS } from "@/lib/repo";
import { categoriaSchema } from "@/lib/schemas";

const h = endpoints(TABLAS.categorias, categoriaSchema);
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
