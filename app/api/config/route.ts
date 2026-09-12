import { NextResponse } from "next/server";
import { exigirEditor } from "@/lib/guard";
import { escribirConfig } from "@/lib/sheets";
import { leerTodo } from "@/lib/repo";

/** Guarda las condiciones por defecto del formulario de contrato nuevo. */
export async function POST(req: Request) {
  const no = await exigirEditor();
  if (no) return no;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    const { config } = await leerTodo();
    const merged = { ...config, ...(body as Record<string, unknown>) };
    const pares = Object.entries(merged)
      .filter(([k]) => k)
      .map(([k, v]) => [k, String(v ?? "")] as [string, string]);
    await escribirConfig(pares);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No pude guardar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
