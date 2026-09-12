import { NextResponse } from "next/server";
import { COOKIE, firmarSesion, verificarClave } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sesion = verificarClave(String(body?.clave ?? ""));
  if (!sesion) {
    // Freno chico para que no se pueda probar claves a mano a toda velocidad.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
  }
  const token = await firmarSesion(sesion);
  const res = NextResponse.json({ ok: true, sesion });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
