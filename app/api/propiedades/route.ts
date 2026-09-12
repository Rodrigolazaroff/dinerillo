import { endpoints } from "@/lib/crud";
import { propiedadSchema } from "@/lib/schemas";
import { TABS } from "@/lib/sheets";

const h = endpoints(TABS.propiedades, propiedadSchema);
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
