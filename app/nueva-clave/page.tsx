"use client";

import { useState, type FormEvent } from "react";
import { Emoji } from "@/components/Emoji";
import { Aviso, Boton, Campo, Input } from "@/components/ui";
import { supabaseNavegador } from "@/lib/supabase/client";

// Llegás acá desde el link del mail de "¿Olvidaste la contraseña?", ya con la
// sesión puesta: solo falta elegir la nueva.

export default function NuevaClave() {
  const [clave, setClave] = useState("");
  const [otra, setOtra] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (clave.length < 8) return setError("La contraseña tiene que tener al menos 8 caracteres.");
    if (clave !== otra) return setError("Las dos no coinciden.");
    setError("");
    setGuardando(true);
    const { error } = await supabaseNavegador().auth.updateUser({ password: clave });
    if (error) {
      setGuardando(false);
      return setError("No pude cambiarla. Pedí otro link y probá de nuevo.");
    }
    window.location.replace("/");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <form onSubmit={guardar} className="flex w-full max-w-xs flex-col gap-3">
        <div className="mb-4 flex flex-col items-center gap-3 text-center">
          <Emoji nombre="llave" tamano="xl" className="pop" />
          <h1 className="titulo text-2xl font-extrabold">Nueva contraseña</h1>
        </div>
        <Campo label="Contraseña" hint="Al menos 8 caracteres.">
          <Input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" required />
        </Campo>
        <Campo label="Repetila">
          <Input type="password" value={otra} onChange={(e) => setOtra(e.target.value)} autoComplete="new-password" required />
        </Campo>
        <Aviso tipo="error">{error}</Aviso>
        <Boton type="submit" disabled={guardando || !clave || !otra} className="w-full">
          {guardando ? "Guardando…" : "Guardar y entrar"}
        </Boton>
      </form>
    </main>
  );
}
