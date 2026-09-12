import { endpoints } from "@/lib/crud";
import { guardarBool } from "@/lib/repo";
import { gastoSchema } from "@/lib/schemas";
import { TABS } from "@/lib/sheets";

// `reparte` se guarda como "si"/"no" para que la planilla se lea a ojo.
const h = endpoints(TABS.gastos, gastoSchema, (v) => ({
  ...v,
  reparte: v.reparte === undefined ? undefined : guardarBool(Boolean(v.reparte)),
}));

export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
