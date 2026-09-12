import { endpoints } from "@/lib/crud";
import { cobroSchema } from "@/lib/schemas";
import { TABS } from "@/lib/sheets";

const h = endpoints(TABS.cobros, cobroSchema);
export const POST = h.POST;
export const PATCH = h.PATCH;
export const DELETE = h.DELETE;
