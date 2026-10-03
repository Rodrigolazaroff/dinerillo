import { after } from "next/server";
import { supabaseServer } from "./supabase/server";

// Los errores quedan en la tabla `errores` y se ven en /admin. Se guardan
// después de responder (`after`): registrar un error nunca demora ni rompe la
// respuesta. Como todo en esta app, se escribe como el usuario logueado; sin
// sesión no se registra.

export function registrarError(mensaje: string, detalle = "", ruta = "") {
  after(async () => {
    try {
      const supabase = await supabaseServer();
      await supabase.from("errores").insert({
        origen: "server",
        mensaje: mensaje.slice(0, 500),
        detalle: detalle.slice(0, 4000),
        ruta: ruta.slice(0, 300),
      });
    } catch {
      // Si no se puede registrar, queda en los logs de Vercel.
    }
  });
}
