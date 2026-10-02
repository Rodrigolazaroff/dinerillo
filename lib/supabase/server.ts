import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente del lado del server, atado a la sesion del que hace el pedido.
//
// No hay clave de servicio en esta app: todo se lee y se escribe como el
// usuario logueado, y es la base (RLS) la que decide que filas ve. Si un
// endpoint tuviera un bug, lo peor que puede pasar es que no vea nada, nunca
// que vea lo de otro.

export function urlYClave() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en las variables de entorno."
    );
  }
  return { url, clave };
}

export async function supabaseServer() {
  const store = await cookies();
  const { url, clave } = urlYClave();
  return createServerClient(url, clave, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) store.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies. No pasa
          // nada: el proxy ya refresco la sesion antes de llegar aca.
        }
      },
    },
  });
}
