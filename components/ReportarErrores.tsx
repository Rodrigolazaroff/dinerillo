"use client";

import { useEffect } from "react";

// Los errores que pasan en el celular de alguien llegan solos a /admin. Pocos
// por visita y sin repetir: un error en un bucle no tiene que llenar la tabla.

const vistos = new Set<string>();
const MAXIMO = 5;

export function reportarError(mensaje: string, detalle = "") {
  const clave = mensaje.slice(0, 200);
  if (!mensaje || vistos.has(clave) || vistos.size >= MAXIMO) return;
  vistos.add(clave);
  void fetch("/api/errores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mensaje: mensaje.slice(0, 500),
      detalle: detalle.slice(0, 4000),
      ruta: window.location.pathname,
    }),
    keepalive: true,
  }).catch(() => {});
}

export function ReportarErrores() {
  useEffect(() => {
    const alError = (e: ErrorEvent) => reportarError(e.message, e.error?.stack ?? `${e.filename}:${e.lineno}`);
    const alRechazo = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      reportarError(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack ?? "" : "");
    };
    window.addEventListener("error", alError);
    window.addEventListener("unhandledrejection", alRechazo);
    return () => {
      window.removeEventListener("error", alError);
      window.removeEventListener("unhandledrejection", alRechazo);
    };
  }, []);
  return null;
}
