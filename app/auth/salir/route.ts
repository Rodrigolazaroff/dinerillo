import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Cierra la sesion: Supabase invalida el token y borra la cookie. */
export async function POST() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
