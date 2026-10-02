import { NextResponse } from "next/server";
import { falla } from "@/lib/crud";
import { exigirEditor } from "@/lib/guard";
import { TABLAS } from "@/lib/repo";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Vacia la papelera: borrado fisico de todo lo que tenga `deleted_at`.
 * Es la unica operacion que saca filas de la base. Va de las hojas a la raiz
 * (cobros antes que contratos, contratos antes que propiedades) para que
 * ninguna clave foranea quede apuntando a algo que ya no existe.
 */
export async function DELETE() {
  const no = await exigirEditor();
  if (no) return no;
  const supabase = await supabaseServer();
  const orden = [
    TABLAS.cobros, TABLAS.gastos, TABLAS.alquileres, TABLAS.contratos, TABLAS.propiedades,
  ];
  let borrados = 0;
  for (const tabla of orden) {
    const { data, error } = await supabase
      .from(tabla).delete().not("deleted_at", "is", null).select("id");
    if (error) return falla(error);
    borrados += data?.length ?? 0;
  }
  return NextResponse.json({ ok: true, borrados });
}
