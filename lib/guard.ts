import { NextResponse } from "next/server";
import { supabaseServer } from "./supabase/server";
import type { Rol } from "./types";

export interface Sesion {
  /** Primer nombre de la cuenta, o lo de antes de la arroba del mail. */
  usuario: string;
  email: string;
  /** La foto de Google, si entró con Google. */
  avatar: string;
  proveedor: string;
  rol: Rol;
}

/**
 * Quien hace el pedido, validado contra Supabase. Cada cuenta es duena de sus
 * datos, asi que todo usuario logueado edita lo suyo.
 */
export async function sesionActual(): Promise<Sesion | null> {
  const supabase = await supabaseServer();
  // El token firmado ya trae quién es, su mail y su metadata: verificarlo acá
  // es más rápido que preguntarle a Supabase en cada pedido.
  const { data } = await supabase.auth.getClaims();
  const u = data?.claims;
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  const email = u.email ?? "";
  const nombre = String(meta.full_name ?? meta.name ?? "").trim().split(/\s+/)[0];
  // Nunca el mail entero: "Hola, juan.perez@gmail.com" no es un saludo.
  const usuario = nombre || email.split("@")[0] || "vos";
  return {
    usuario: usuario.charAt(0).toUpperCase() + usuario.slice(1),
    email,
    avatar: String(meta.avatar_url ?? meta.picture ?? ""),
    proveedor: String(u.app_metadata?.provider ?? "email"),
    rol: "editor",
  };
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
