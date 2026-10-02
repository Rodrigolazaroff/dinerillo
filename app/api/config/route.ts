import { NextResponse } from "next/server";
import { falla } from "@/lib/crud";
import { exigirEditor } from "@/lib/guard";
import { configSchema, primerError } from "@/lib/schemas";
import { supabaseServer } from "@/lib/supabase/server";

/** Guarda las condiciones por defecto del formulario de contrato nuevo. */
export async function POST(req: Request) {
  const no = await exigirEditor();
  if (no) return no;
  const body = await req.json().catch(() => null);
  const parsed = configSchema.safeParse(
    body && typeof body === "object"
      ? Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v ?? "")]))
      : null
  );
  if (!parsed.success) {
    return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
  }
  const filas = Object.entries(parsed.data)
    .filter(([clave]) => clave)
    .map(([clave, valor]) => ({ clave, valor }));
  if (!filas.length) return NextResponse.json({ ok: true });

  const supabase = await supabaseServer();
  const { error } = await supabase.from("ajustes").upsert(filas, { onConflict: "user_id,clave" });
  if (error) return falla(error);
  return NextResponse.json({ ok: true });
}
