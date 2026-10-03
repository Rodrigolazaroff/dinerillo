import { NextResponse } from "next/server";
import { z } from "zod";
import { sesionActual } from "@/lib/guard";
import { supabaseServer } from "@/lib/supabase/server";

const errorSchema = z.object({
  mensaje: z.string().trim().min(1).max(500),
  detalle: z.string().max(4000).default(""),
  ruta: z.string().max(300).default(""),
});

/** Un error que pasó en el celular de alguien. Lo manda la app sola. */
export async function POST(req: Request) {
  if (!(await sesionActual())) return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = errorSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await supabaseServer();
  await supabase.from("errores").insert({
    origen: "cliente",
    ...parsed.data,
    navegador: (req.headers.get("user-agent") ?? "").slice(0, 300),
  });
  return NextResponse.json({ ok: true });
}
