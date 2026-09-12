import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, leerSesion, type Sesion } from "./auth";

export async function sesionActual(): Promise<Sesion | null> {
  const store = await cookies();
  return leerSesion(store.get(COOKIE)?.value);
}

/**
 * Puerta de escritura. Se llama al principio de todo endpoint que modifica
 * datos: la cookie firmada sola no alcanza, el rol se vuelve a chequear en el
 * server para que el modo lectura no se pueda saltear desde el navegador.
 */
export async function exigirEditor(): Promise<NextResponse | null> {
  const s = await sesionActual();
  if (!s) return NextResponse.json({ error: "Sesión vencida. Volvé a entrar." }, { status: 401 });
  if (s.rol !== "editor") {
    return NextResponse.json({ error: "Tu usuario es de solo lectura." }, { status: 403 });
  }
  return null;
}

export async function exigirSesion(): Promise<NextResponse | null> {
  const s = await sesionActual();
  if (!s) return NextResponse.json({ error: "Sesión vencida. Volvé a entrar." }, { status: 401 });
  return null;
}

/** Envuelve un handler para que un error de Sheets no devuelva un 500 pelado. */
export async function conError<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json((await fn()) ?? { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Algo salió mal";
    console.error("[rentifay]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
