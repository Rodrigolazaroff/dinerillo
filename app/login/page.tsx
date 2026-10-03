"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Aviso, Boton, Campo, Input, Segmentado } from "@/components/ui";
import { Emoji } from "@/components/Emoji";
import { supabaseNavegador } from "@/lib/supabase/client";

// Dos maneras de entrar: con Google, que es un toque, o con mail y contraseña.
// Crear cuenta vive en la misma pantalla y no en otra ruta: es el mismo
// formulario con un dato más y un botón distinto.

type Modo = "entrar" | "crear";

/** Los errores de Supabase vienen en inglés y con tono de log. */
function traducir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "El mail o la contraseña no coinciden.";
  if (/email not confirmed/i.test(msg)) return "Todavía no confirmaste el mail. Fijate en tu casilla.";
  if (/already registered|already been registered/i.test(msg)) return "Ya hay una cuenta con ese mail. Probá entrar.";
  if (/password should be at least/i.test(msg)) return "La contraseña tiene que tener al menos 8 caracteres.";
  if (/rate limit|too many/i.test(msg)) return "Demasiados intentos. Esperá un rato y probá de nuevo.";
  if (/valid email|invalid email|unable to validate email/i.test(msg)) return "Ese mail no parece válido.";
  return "No pude entrar. Probá de nuevo.";
}

export default function Login() {
  // useSearchParams necesita un Suspense alrededor para que la página se pueda
  // generar estática.
  return (
    <Suspense>
      <Formulario />
    </Suspense>
  );
}

function Formulario() {
  // La vuelta de Google o de un link vencido trae el motivo en la URL.
  const errorDeLaUrl = useSearchParams().get("error") ?? "";
  const [modo, setModo] = useState<Modo>("entrar");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [mandando, setMandando] = useState<"google" | "mail" | null>(null);

  const volverA = () => `${window.location.origin}/auth/callback`;

  async function conGoogle() {
    setError("");
    setMandando("google");
    const { error } = await supabaseNavegador().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: volverA() },
    });
    // Si salió bien el navegador ya se está yendo a Google.
    if (error) {
      setError(traducir(error.message));
      setMandando(null);
    }
  }

  async function conMail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAviso("");
    setMandando("mail");
    const supabase = supabaseNavegador();

    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: clave });
      if (error) {
        setError(traducir(error.message));
        setMandando(null);
        return;
      }
      // Recarga completa: así el proxy vuelve a correr con la sesión puesta.
      window.location.href = "/";
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: clave,
      options: { emailRedirectTo: volverA(), data: { full_name: nombre.trim() } },
    });
    setMandando(null);
    if (error) {
      setError(traducir(error.message));
      return;
    }
    if (data.session) {
      // Cuenta nueva: directo a las preguntas de bienvenida.
      window.location.href = "/bienvenida";
      return;
    }
    setAviso(`Te mandamos un mail a ${email} para confirmar.`);
    setClave("");
  }

  const ocupado = mandando !== null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-xs">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-celeste-claro">
            <Emoji nombre="moneda" tamano="xxl" className="pop h-14 w-14" />
          </div>
          <div>
            <h1 className="titulo text-3xl font-extrabold text-acento">dinerillo</h1>
            <p className="mt-1 text-sm text-suave">Tu plata del mes, en un solo lugar.</p>
          </div>
        </div>

        <Boton
          variante="secundario"
          className="w-full"
          onClick={conGoogle}
          disabled={ocupado}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c1-2.9 3.6-4.9 6.7-4.9Z" />
          </svg>
          {mandando === "google" ? "Yendo a Google…" : "Continuar con Google"}
        </Boton>

        <div className="my-5 flex items-center gap-3 text-[11px] text-tenue">
          <span className="h-px flex-1 bg-borde" />
          o con tu mail
          <span className="h-px flex-1 bg-borde" />
        </div>

        <Segmentado
          valor={modo}
          opciones={[
            { valor: "entrar", label: "Entrar" },
            { valor: "crear", label: "Crear cuenta" },
          ]}
          onCambio={(m) => {
            setModo(m);
            setError("");
            setAviso("");
          }}
          className="mb-4 w-full [&>*]:flex-1"
        />

        <form onSubmit={conMail} className="flex flex-col gap-3">
          {modo === "crear" && (
            <Campo label="Tu nombre">
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoComplete="given-name"
                maxLength={60}
              />
            </Campo>
          )}
          <Campo label="Mail">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
            />
          </Campo>
          <Campo label="Contraseña" hint={modo === "crear" ? "Al menos 8 caracteres." : undefined}>
            <Input
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              autoComplete={modo === "crear" ? "new-password" : "current-password"}
              minLength={modo === "crear" ? 8 : undefined}
              required
            />
          </Campo>
          <Aviso tipo="error">{error || (aviso ? "" : errorDeLaUrl)}</Aviso>
          <Aviso tipo="ok">{aviso}</Aviso>
          <Boton type="submit" disabled={ocupado || !email || !clave} className="w-full">
            {mandando === "mail"
              ? modo === "entrar" ? "Entrando…" : "Creando la cuenta…"
              : modo === "entrar" ? "Entrar" : "Crear cuenta"}
          </Boton>
        </form>
      </div>
    </main>
  );
}
