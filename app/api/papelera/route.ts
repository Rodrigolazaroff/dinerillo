import { NextResponse } from "next/server";
import { exigirEditor } from "@/lib/guard";
import { leerTodo } from "@/lib/repo";
import { deleteRowsByIds, TABS } from "@/lib/sheets";

/**
 * Vacia la papelera: borrado fisico de todo lo que tenga `deleted_at`.
 * Es la unica operacion que saca filas de la planilla.
 */
export async function DELETE() {
  const no = await exigirEditor();
  if (no) return no;
  try {
    const d = await leerTodo();
    const borrados =
      (await deleteRowsByIds(TABS.cobros, d.cobros.filter((x) => x.deleted_at).map((x) => x.id))) +
      (await deleteRowsByIds(TABS.gastos, d.gastos.filter((x) => x.deleted_at).map((x) => x.id))) +
      (await deleteRowsByIds(TABS.alquileres, d.alquileres.filter((x) => x.deleted_at).map((x) => x.id))) +
      (await deleteRowsByIds(TABS.contratos, d.contratos.filter((x) => x.deleted_at).map((x) => x.id))) +
      (await deleteRowsByIds(TABS.propiedades, d.propiedades.filter((x) => x.deleted_at).map((x) => x.id)));
    return NextResponse.json({ ok: true, borrados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No pude vaciar la papelera";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
