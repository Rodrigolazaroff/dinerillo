"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso, Boton, Input } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [mandando, setMandando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMandando(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "No pude entrar");
        setMandando(false);
        return;
      }
      // Recarga completa: así el middleware vuelve a correr con la cookie puesta.
      window.location.href = "/";
    } catch {
      setError("No hay conexión");
      setMandando(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-xs">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-acento">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 11.2 12 4.5l8 6.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 10.5V19h12v-8.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 19v-4.2h4V19" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Rentifay</h1>
            <p className="mt-1 text-xs text-suave">Tus alquileres, sin abrir la planilla.</p>
          </div>
        </div>

        <form onSubmit={entrar} className="flex flex-col gap-3">
          <Input
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="Clave"
            autoFocus
            autoComplete="current-password"
            aria-label="Clave"
          />
          <Aviso tipo="error">{error}</Aviso>
          <Boton type="submit" disabled={mandando || !clave} className="w-full">
            {mandando ? "Entrando…" : "Entrar"}
          </Boton>
        </form>
      </div>
    </main>
  );
}
