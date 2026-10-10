import { NextResponse } from "next/server";
import { exigirEditor } from "@/lib/guard";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * El panel de administración: uso y errores. Lo decide la base: las funciones
 * `admin_*` (migración 0006) solo responden a quien está en `admins`.
 */
export async function GET() {
  const no = await exigirEditor();
  if (no) return no;
  const supabase = await supabaseServer();
  const [resumen, usuarios, errores, mejoras] = await Promise.all([
    supabase.rpc("admin_resumen"),
    supabase.rpc("admin_usuarios"),
    supabase.rpc("admin_errores"),
    // Migración 0007: si todavía no se aplicó, el panel sigue andando sin ideas.
    supabase.rpc("admin_mejoras"),
  ]);
  const error = resumen.error ?? usuarios.error ?? errores.error;
  if (error) {
    const noEs = error.code === "42501";
    return NextResponse.json(
      { error: noEs ? "Esto es solo para administradores." : "No pude leer el panel." },
      { status: noEs ? 403 : 500 }
    );
  }
  return NextResponse.json(
    { resumen: resumen.data, usuarios: usuarios.data ?? [], errores: errores.data ?? [], mejoras: mejoras.data ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
