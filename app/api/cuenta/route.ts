import { NextResponse } from "next/server";
import { falla } from "@/lib/crud";
import { exigirEditor } from "@/lib/guard";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Borra la cuenta y todos sus datos, para siempre. Lo hace la base
 * (`eliminar_mi_cuenta`, migración 0005), que solo puede borrar al usuario
 * de la sesión: no hay clave de servicio en la app.
 */
export async function DELETE() {
  const no = await exigirEditor();
  if (no) return no;
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("eliminar_mi_cuenta");
  if (error) {
    if (error.code === "PGRST202") {
      return NextResponse.json({ error: "Falta actualizar la base de datos. Avisale a quien la mantiene." }, { status: 503 });
    }
    return falla(error);
  }
  // El usuario ya no existe: solo queda borrar las cookies de este navegador.
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.json({ ok: true });
}
