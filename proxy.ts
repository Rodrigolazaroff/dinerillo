import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Corre antes de cada pedido: refresca la sesion de Supabase (rota el token y
// reescribe la cookie) y manda al login a quien no la tenga.
//
// El login, la vuelta de Google y las piezas de la PWA (manifest, service
// worker, iconos) tienen que poder bajarse sin sesion: si no, el celular no
// puede instalar la app.
const PUBLICAS = [
  "/login",
  "/auth/",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline",
  "/icons/",
  "/privacidad",
  "/terminos",
];

export default async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (lista) => {
          for (const { name, value } of lista) req.cookies.set(name, value);
          res = NextResponse.next({ request: req });
          for (const { name, value, options } of lista) res.cookies.set(name, value, options);
        },
      },
    }
  );

  // getClaims verifica la firma del token acá mismo (y lo renueva si venció):
  // no hace un viaje a Supabase en cada navegación, como getUser. getSession
  // solo leería la cookie sin verificar nada.
  const { data } = await supabase.auth.getClaims();
  const { pathname } = req.nextUrl;

  if (data?.claims || PUBLICAS.some((p) => pathname.startsWith(p))) return res;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sesión vencida. Volvé a entrar." }, { status: 401 });
  }
  // La raíz es el link que se comparte: sin sesión muestra el login ahí mismo,
  // sin redirigir, así WhatsApp lee la página en un solo pedido (con el salto
  // armaba la tarjeta chica). Al entrar, el login recarga "/" y ya hay sesión.
  if (pathname === "/") {
    const login = NextResponse.rewrite(new URL("/login", req.url));
    for (const cookie of res.cookies.getAll()) login.cookies.set(cookie);
    return login;
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
