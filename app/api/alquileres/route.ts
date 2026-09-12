import { endpoints } from "@/lib/crud";
import { alquilerSchema } from "@/lib/schemas";
import { TABS } from "@/lib/sheets";

// Importes de alquiler fijados a mano para un período puntual. Le ganan a la
// proyección del contrato.
const h = endpoints(TABS.alquileres, alquilerSchema);
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
