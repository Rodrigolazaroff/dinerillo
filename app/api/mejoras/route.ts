import { NextResponse } from "next/server";
import { z } from "zod";
import { exigirEditor } from "@/lib/guard";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Más que esto por día ya no es una idea, es spam. */
const TOPE_DIARIO = 10;

const mejoraSchema = z.object({
  tipo: z.enum(["idea", "problema", "critica", "otro"]),
  texto: z.string().trim().min(3, "Contanos un poco más").max(1000, "Hasta 1000 letras"),
});

const respuestaSchema = z.object({
  id: z.number().int().positive(),
  estado: z.enum(["nueva", "la_hacemos", "hecha", "no_por_ahora"]),
  respuesta: z.string().trim().max(1000).default(""),
});

/** Las que mandó la persona, con el estado y la respuesta si la hay. */
export async function GET() {
  const no = await exigirEditor();
  if (no) return no;
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("mejoras")
    .select("id, tipo, texto, estado, respuesta, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: "No pude leer tus ideas." }, { status: 500 });
  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const no = await exigirEditor();
  if (no) return no;
  const parsed = mejoraSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisá el texto" }, { status: 400 });
  }
  const supabase = await supabaseServer();
  const { count } = await supabase
    .from("mejoras")
    .select("id", { count: "exact", head: true })
    .gt("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= TOPE_DIARIO) {
    return NextResponse.json({ error: "Por hoy ya mandaste muchas. ¡Gracias! Seguí mañana." }, { status: 429 });
  }
  const { error } = await supabase.from("mejoras").insert(parsed.data);
  if (error) return NextResponse.json({ error: "No se pudo mandar. Probá de nuevo." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** El admin le pone estado y respuesta. Lo decide la base (`admin_mejora_responder`). */
export async function PATCH(req: Request) {
  const no = await exigirEditor();
  if (no) return no;
  const parsed = respuestaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("admin_mejora_responder", {
    p_id: parsed.data.id,
    p_estado: parsed.data.estado,
    p_respuesta: parsed.data.respuesta,
  });
  if (error) {
    const noEs = error.code === "42501";
    return NextResponse.json(
      { error: noEs ? "Esto es solo para administradores." : "No pude guardar." },
      { status: noEs ? 403 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
