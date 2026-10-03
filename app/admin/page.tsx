"use client";

import useSWR from "swr";
import { Shell } from "@/components/Shell";
import { Aviso, Card, Cargando, Kpi } from "@/components/ui";

// Para el dueño de la app: cuánta gente la usa, cuánto se gasta en IA y qué
// se rompió. Métricas y errores; nunca los montos de nadie.

interface Panel {
  resumen: {
    usuarios: number;
    nuevos_7d: number;
    activos_7d: number;
    ia_hoy: number;
    ia_7d: number;
    tokens_7d: number;
    errores_24h: number;
  };
  usuarios: {
    email: string;
    creado: string;
    ultimo_ingreso: string | null;
    proveedor: string;
    ia_7d: number;
    onboarding: string | null;
  }[];
  errores: {
    id: number;
    creado: string;
    email: string | null;
    origen: string;
    mensaje: string;
    detalle: string;
    ruta: string;
    navegador: string;
  }[];
}

async function leer(url: string): Promise<Panel> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "No pude leer el panel");
  return data;
}

const cuando = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

/** Haiku 4.5: US$ 1 por millón de tokens de entrada y 5 de salida; se estima con 1,5. */
const dolares = (tokens: number) => `US$ ${((tokens / 1_000_000) * 1.5).toFixed(2).replace(".", ",")}`;

export default function Admin() {
  const { data, error } = useSWR<Panel>("/api/admin", leer, { refreshInterval: 60_000 });

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <h1 className="titulo text-2xl font-bold">Administración</h1>
        {error ? (
          <Aviso tipo="error">{error.message}</Aviso>
        ) : !data ? (
          <Cargando />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Kpi etiqueta="Usuarios" valor={data.resumen.usuarios} detalle={`+${data.resumen.nuevos_7d} en 7 días`} />
              <Kpi etiqueta="Activos 7 días" valor={data.resumen.activos_7d} />
              <Kpi
                etiqueta="IA en 7 días"
                valor={data.resumen.ia_7d}
                detalle={`${data.resumen.ia_hoy} hoy · ≈ ${dolares(data.resumen.tokens_7d)}`}
              />
              <Kpi
                etiqueta="Errores 24 h"
                valor={data.resumen.errores_24h}
                tono={data.resumen.errores_24h > 0 ? "peligro" : "ok"}
              />
            </div>

            <Card titulo="Errores">
              {data.errores.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-suave sm:px-5">Ninguno. Todo tranqui.</p>
              ) : (
                <ul className="divide-y divide-linea">
                  {data.errores.map((e) => (
                    <li key={e.id}>
                      <details className="px-4 py-3 sm:px-5">
                        <summary className="cursor-pointer list-none">
                          <p className="text-sm font-medium text-peligro">{e.mensaje}</p>
                          <p className="text-[11px] text-tenue">
                            {cuando(e.creado)} · {e.origen} · {e.ruta || "—"} · {e.email ?? "sin sesión"}
                          </p>
                        </summary>
                        {(e.detalle || e.navegador) && (
                          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-fondo p-2 text-[11px] text-suave">
                            {e.detalle}
                            {e.navegador && `\n\n${e.navegador}`}
                          </pre>
                        )}
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card titulo="Usuarios">
              <ul className="divide-y divide-linea">
                {data.usuarios.map((u) => (
                  <li key={u.email} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{u.email}</p>
                      <p className="text-[11px] text-tenue">
                        alta {cuando(u.creado)} · entró {cuando(u.ultimo_ingreso)} · {u.proveedor}
                        {!u.onboarding && " · sin bienvenida"}
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-xs text-suave">{u.ia_7d} IA</span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}
