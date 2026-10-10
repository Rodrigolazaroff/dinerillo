"use client";

import { useState } from "react";
import useSWR from "swr";
import { Shell } from "@/components/Shell";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, Card, Cargando, Segmentado, Textarea, Vacio } from "@/components/ui";
import { ESTADOS_MEJORA, TIPOS_MEJORA, etiquetaTipo, type EstadoMejora, type TipoMejora } from "@/lib/mejoras";
import { enviar } from "@/lib/useData";

// Ideas, críticas y comentarios de quien usa la app. Van a la tabla `mejoras`;
// una vez por semana se leen todas y se decide qué se hace. Acá cada uno ve lo
// que mandó y en qué quedó.

type Tipo = TipoMejora;

interface Mejora {
  id: number;
  tipo: Tipo;
  texto: string;
  estado: EstadoMejora;
  respuesta: string;
  created_at: string;
}

const AYUDA: Record<Tipo, string> = {
  idea: "¿Qué te gustaría que haga la app?",
  problema: "¿Qué pasó y en qué pantalla?",
  critica: "¿Qué no te gusta o te cuesta?",
  otro: "Lo que quieras contarnos",
};

async function leer(url: string): Promise<Mejora[]> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "No pude leer tus ideas");
  return data;
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

export default function Mejoras() {
  const { data, error, mutate } = useSWR<Mejora[]>("/api/mejoras", leer);
  const [tipo, setTipo] = useState<Tipo>("idea");
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [falla, setFalla] = useState("");

  async function mandar() {
    setOcupado(true);
    setFalla("");
    const r = await enviar("/api/mejoras", "POST", { tipo, texto });
    setOcupado(false);
    if (!r.ok) return setFalla(r.error);
    setTexto("");
    avisar("¡Gracias! La vamos a leer");
    await mutate();
  }

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="titulo text-2xl font-bold">Ideas y mejoras</h1>
          <p className="mt-1 text-sm text-suave">Contanos qué cambiarías. Las leemos todas, cada semana.</p>
        </div>

        <Card>
          <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
            <Segmentado valor={tipo} opciones={TIPOS_MEJORA} onCambio={setTipo} className="self-start" />
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={AYUDA[tipo]}
              maxLength={1000}
              rows={4}
              aria-label={AYUDA[tipo]}
            />
            <Aviso>{falla}</Aviso>
            <div className="flex items-center justify-between gap-3">
              <span className="tabular text-[11px] text-tenue">{texto.length}/1000</span>
              <Boton onClick={mandar} disabled={ocupado || texto.trim().length < 3}>
                {ocupado ? "Mandando…" : "Mandar"}
              </Boton>
            </div>
          </div>
        </Card>

        <Card titulo="Lo que mandaste">
          {error ? (
            <div className="p-4">
              <Aviso>{error.message}</Aviso>
            </div>
          ) : !data ? (
            <Cargando />
          ) : data.length === 0 ? (
            <Vacio titulo="Todavía nada" emoji="luz">
              Lo que mandes aparece acá, con lo que decidimos.
            </Vacio>
          ) : (
            <ul className="divide-y divide-linea">
              {data.map((m) => (
                <li key={m.id} className="lista-entra flex flex-col gap-1.5 px-4 py-3 sm:px-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-tenue">
                      {etiquetaTipo(m.tipo)} · {fecha(m.created_at)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${ESTADOS_MEJORA[m.estado].clase}`}
                    >
                      {ESTADOS_MEJORA[m.estado].texto}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm">{m.texto}</p>
                  {m.respuesta && (
                    <p className="rounded-lg bg-celeste-claro px-3 py-2 text-xs text-tinta">{m.respuesta}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Shell>
  );
}
