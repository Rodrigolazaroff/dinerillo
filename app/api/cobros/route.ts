import { endpoints } from "@/lib/crud";
import { cobroSchema } from "@/lib/schemas";
import { TABLAS } from "@/lib/repo";

const h = endpoints(TABLAS.cobros, cobroSchema);
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
