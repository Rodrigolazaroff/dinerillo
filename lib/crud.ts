import { NextResponse } from "next/server";
import { ulid } from "ulid";
import { z } from "zod";
import { exigirEditor } from "./guard";
import type { Tabla } from "./repo";
import { primerError } from "./schemas";
import { supabaseServer } from "./supabase/server";

// Las cinco tablas se escriben igual, asi que los endpoints se generan de una
// sola definicion. Lo unico propio de cada una es su schema.
//
// Dos decisiones que valen para todas:
//
// - El `id` es un ULID hecho en el server. Es la clave para editar y borrar.
// - Borrar es escribir `deleted_at`: la fila queda en la papelera y se puede
//   recuperar hasta que la vacies. Un PATCH con `restaurar: true` la devuelve:
//   es lo que usa el "Deshacer" que aparece despues de borrar.
//
// El `user_id` no se manda nunca: lo pone la base con auth.uid(), y la
// politica de RLS impide escribir una fila a nombre de otro.

type Normalizador<T> = (v: T) => Record<string, unknown>;

/**
 * Los campos opcionales que en la base son null y en el formulario un texto
 * vacio ("sin categoria", "todas las propiedades"). Asi la clave foranea no
 * busca una fila con id "".
 */
export function vacioANulo<T extends Record<string, unknown>>(...campos: (keyof T)[]) {
  return (v: T): Record<string, unknown> => {
    const o: Record<string, unknown> = { ...v };
    for (const c of campos) if (o[c as string] === "") o[c as string] = null;
    return o;
  };
}

export function endpoints<T extends z.ZodRawShape>(
  tabla: Tabla,
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
      const supabase = await supabaseServer();
      const { error } = await supabase.from(tabla).insert({ ...aFila(parsed.data), id });
      if (error) return falla(error);
      return NextResponse.json({ ok: true, id });
    },

    async PATCH(req: Request) {
      const no = await exigirEditor();
      if (no) return no;
      const body = await req.json().catch(() => null);
      const id = String((body as { id?: string })?.id ?? "").trim();
      if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
      if ((body as { restaurar?: unknown }).restaurar === true) {
        return actualizar(tabla, id, { deleted_at: null });
      }
      const parsed = schema.partial().safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
      }
      // `partial()` igual completa los `.default()` de los campos que no
      // vinieron: sin este filtro, editar solo el importe vaciaba la nota.
      const enviados = new Set(Object.keys(body as object));
      const soloEnviados = Object.fromEntries(
        Object.entries(parsed.data).filter(([k]) => enviados.has(k))
      );
      const datos = sinIndefinidos(aFila(soloEnviados as z.infer<z.ZodObject<T>>));
      delete datos.id;
      delete datos.created_at;
      delete datos.user_id;
      return actualizar(tabla, id, datos);
    },

    async DELETE(req: Request) {
      const no = await exigirEditor();
      if (no) return no;
      const url = new URL(req.url);
      const body = await req.json().catch(() => null);
      const id = String((body as { id?: string })?.id ?? url.searchParams.get("id") ?? "").trim();
      if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
      return actualizar(tabla, id, { deleted_at: new Date().toISOString() });
    },
  };
}

async function actualizar(tabla: Tabla, id: string, datos: Record<string, unknown>) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from(tabla).update(datos).eq("id", id).select("id");
  if (error) return falla(error);
  if (!data?.length) return NextResponse.json({ error: "No encontré ese registro" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Un PATCH parcial no tiene que pisar con vacio lo que no se mando. */
function sinIndefinidos(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

/** Los errores de Postgres, traducidos a algo que se pueda mostrar. */
export function falla(e: { code?: string; message: string }) {
  console.error("[dinerillo]", e.code, e.message);
  const msg =
    e.code === "23503" ? "Eso está vinculado a algo que no existe o que todavía se usa."
    : e.code === "23514" ? "Algún dato está fuera de rango. Revisalo."
    : e.code === "23505" ? "Ya existe un registro igual."
    : e.code === "42501" ? "No tenés permiso para hacer eso."
    : "No pude guardar. Probá de nuevo.";
  // Un dato que la base no acepta es culpa del pedido (400), no del server.
  const status = e.code === "42501" ? 403 : e.code?.startsWith("23") ? 400 : 500;
  return NextResponse.json({ error: msg }, { status });
}
