"use client";

import { useEffect } from "react";
import { Emoji } from "@/components/Emoji";
import { reportarError } from "@/components/ReportarErrores";
import { Boton } from "@/components/ui";

/** Una pantalla que se rompió: se avisa al panel y se puede reintentar. */
export default function ErrorDePantalla({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportarError(error.message || "Error de pantalla", `${error.digest ?? ""}\n${error.stack ?? ""}`);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Emoji nombre="pensando" tamano="xxl" />
      <h1 className="titulo text-2xl font-extrabold">Algo falló</h1>
      <p className="text-sm text-suave">Ya nos llegó el aviso.</p>
      <Boton onClick={reset} className="min-h-12 px-6">
        Reintentar
      </Boton>
    </main>
  );
}
