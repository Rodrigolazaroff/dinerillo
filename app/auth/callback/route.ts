import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * La vuelta de Google y del link de confirmacion del mail. Los dos llegan con
 * un `code` de un solo uso que se cambia por la sesion, y de aca al inicio.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const errorDeGoogle = searchParams.get("error_description");

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("El link venció o ya se usó. Probá entrar de nuevo.")}`);
  }

  const motivo = errorDeGoogle ? "Google no confirmó la entrada." : "No pude completar la entrada.";
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(motivo)}`);
}
