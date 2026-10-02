import { NextResponse } from "next/server";
import { supabaseServer } from "./supabase/server";
import type { Rol } from "./types";

export interface Sesion {
  usuario: string;
  rol: Rol;
}

/**
 * Quien hace el pedido, validado contra Supabase. Cada cuenta es duena de sus
 * datos, asi que todo usuario logueado edita lo suyo.
 */
export async function sesionActual(): Promise<Sesion | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  const nombre = String(meta.full_name ?? meta.name ?? "").trim().split(/\s+/)[0];
  const usuario = nombre || u.email || "vos";
  return { usuario: usuario.charAt(0).toUpperCase() + usuario.slice(1), rol: "editor" };
}

/**
 * Puerta de escritura. Se llama al principio de todo endpoint que modifica
 * datos: el proxy ya filtra, pero el server lo vuelve a chequear por las dudas.
 */
export async function exigirEditor(): Promise<NextResponse | null> {
  const s = await sesionActual();
  if (!s) return NextResponse.json({ error: "Sesión vencida. Volvé a entrar." }, { status: 401 });
  return null;
}
