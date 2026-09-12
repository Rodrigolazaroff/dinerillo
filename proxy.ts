import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, leerSesion } from "@/lib/auth";

// El login y las piezas de la PWA (manifest, service worker, iconos) tienen que
// poder bajarse sin sesion: si no, el celular no puede instalar la app.
const PUBLICAS = [
  "/login",
  "/api/login",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline",
  "/icons/",
];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLICAS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const sesion = await leerSesion(req.cookies.get(COOKIE)?.value);
  if (sesion) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sesión vencida. Volvé a entrar." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|webmanifest|js)$).*)",
  ],
};
