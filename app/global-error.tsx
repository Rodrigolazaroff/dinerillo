"use client";

import { useEffect } from "react";
import { reportarError } from "@/components/ReportarErrores";

/** Si se rompe hasta el layout: una página mínima, sin depender de nada. */
export default function ErrorGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportarError(error.message || "Error global", `${error.digest ?? ""}\n${error.stack ?? ""}`);
  }, [error]);

  return (
    <html lang="es-AR">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1>Algo falló</h1>
          <p>Ya nos llegó el aviso.</p>
          <button onClick={reset} style={{ padding: "12px 24px", borderRadius: 999, border: 0, background: "#1d52de", color: "white" }}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
