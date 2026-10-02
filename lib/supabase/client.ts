"use client";

import { createBrowserClient } from "@supabase/ssr";

// Solo lo usa la pantalla de login, para arrancar el flujo de Google o del
// mail. Los datos nunca se piden desde el navegador: van por /api.
export function supabaseNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
