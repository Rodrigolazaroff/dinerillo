import { endpoints } from "@/lib/crud";
import { contratoSchema } from "@/lib/schemas";
import { TABS } from "@/lib/sheets";

const h = endpoints(TABS.contratos, contratoSchema);
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
