import { NextResponse } from "next/server";
import { ulid } from "ulid";
import { z } from "zod";
import { exigirEditor } from "./guard";
import { primerError } from "./schemas";
import { appendRow, updateRowById, type TabName } from "./sheets";

// Las cuatro tablas se escriben igual, asi que los endpoints se generan de una
// sola definicion. Lo unico propio de cada una es su schema.
//
// Dos decisiones que valen para todas:
//
// - El `id` es un ULID hecho en el server. Es la clave para editar y borrar:
//   nunca se depende del numero de fila, porque una fila se corre si borras
//   otra de arriba.
// - Borrar es escribir `deleted_at`. La fila no se mueve, asi que dos
//   escrituras simultaneas no se pisan. El borrado fisico pasa solo al vaciar
//   la papelera.

type Normalizador<T> = (v: T) => Record<string, unknown>;

export function endpoints<T extends z.ZodRawShape>(
  tab: TabName,
  schema: z.ZodObject<T>,
  normalizar?: Normalizador<z.infer<z.ZodObject<T>>>
) {
  const aFila = (v: z.infer<z.ZodObject<T>>) =>
    normalizar ? normalizar(v) : (v as Record<string, unknown>);

  return {
    async POST(req: Request) {
      const no = await exigirEditor();
      if (no) return no;
      const body = await req.json().catch(() => null);
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
      }
      const id = ulid();
      try {
        await appendRow(tab, {
          ...aFila(parsed.data),
          id,
          created_at: new Date().toISOString(),
          deleted_at: "",
        });
        return NextResponse.json({ ok: true, id });
      } catch (e) {
        return falla(e);
      }
    },

    async PATCH(req: Request) {
      const no = await exigirEditor();
      if (no) return no;
      const body = await req.json().catch(() => null);
      const id = String((body as { id?: string })?.id ?? "").trim();
      if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
      const parsed = schema.partial().safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
      }
      const datos = aFila(parsed.data as z.infer<z.ZodObject<T>>);
      delete datos.id;
      delete datos.created_at;
      try {
        const ok = await updateRowById(tab, id, datos);
        if (!ok) return NextResponse.json({ error: "No encontré ese registro" }, { status: 404 });
        return NextResponse.json({ ok: true });
      } catch (e) {
        return falla(e);
      }
    },

    async DELETE(req: Request) {
      const no = await exigirEditor();
      if (no) return no;
      const url = new URL(req.url);
      const body = await req.json().catch(() => null);
      const id = String((body as { id?: string })?.id ?? url.searchParams.get("id") ?? "").trim();
      if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
      try {
        const ok = await updateRowById(tab, id, { deleted_at: new Date().toISOString() });
        if (!ok) return NextResponse.json({ error: "No encontré ese registro" }, { status: 404 });
        return NextResponse.json({ ok: true });
      } catch (e) {
        return falla(e);
      }
    },
  };
}

function falla(e: unknown) {
  const msg = e instanceof Error ? e.message : "No pude escribir en la planilla";
  console.error("[rentifay]", msg);
  return NextResponse.json({ error: msg }, { status: 500 });
}
