"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Asistente } from "@/components/Asistente";
import { BurbujaEmoji, Emoji } from "@/components/Emoji";
import { FormIngreso } from "@/components/FormIngreso";
import { IconoFlecha, IconoMas } from "@/components/iconos";
import { Monto } from "@/components/Privado";
import { SelectorMes } from "@/components/SelectorMes";
import { Shell } from "@/components/Shell";
import { Aviso, Boton, Card, Cargando, Vacio } from "@/components/ui";
import { emojiDe } from "@/lib/emoji";
import { ID_ALQUILERES } from "@/lib/finanzas";
import { enMoneda } from "@/lib/format";
import { enviar, usaAlquileres } from "@/lib/useData";
import { avisar } from "@/components/Toast";
import { useFinanzas } from "@/lib/useFinanzas";

// Todo lo que entra, fuente por fuente. Alquileres figura acá porque es un
// ingreso más; tocándolo se abre su módulo con contratos, cobros y boletas.

export default function Ingresos() {
  const { data, error, recargar, resumen, prefs, mes } = useFinanzas();
  const [nuevo, setNuevo] = useState(false);
  const router = useRouter();

  if (error) {
    return (
      <Shell>
        <Aviso tipo="error">{error.message}</Aviso>
      </Shell>
    );
  }
  if (!data || !resumen) {
    return (
      <Shell>
        <Cargando />
      </Shell>
    );
  }

  const fuentes = data.ingresos.filter((i) => !i.deleted_at);
  const activas = fuentes.filter((i) => !i.archivado_at);
  const archivadas = fuentes.filter((i) => i.archivado_at);
  const delMes = new Map(resumen.ingresos.lineas.map((l) => [l.id, l]));
  const alquileres = delMes.get(ID_ALQUILERES);
  const hayAlquileres = usaAlquileres(data);

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="titulo text-2xl font-bold">Ingresos</h1>
          <SelectorMes />
        </div>

        <section className="relative overflow-hidden rounded-2xl bg-acento px-5 py-5 text-white">
          <Emoji nombre="bolsa-plata" tamano="xxl" className="pop pointer-events-none absolute -right-1 -top-1 h-20 w-20 rotate-12" />
          <p className="text-sm font-medium text-white/80">Entró</p>
          <p className="numero mt-2 text-[2.6rem] font-extrabold">
            <Monto valor={resumen.ingresos.total} animado />
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-white/90">
            <Emoji nombre="brote" tamano="xs" />
            Meta de ahorro {prefs.ahorroPct}% ·{" "}
            <span className="tabular font-semibold text-white">
              <Monto valor={resumen.ahorroSugerido} />
            </span>
          </p>
          <Asistente modo="ingreso" className="mt-4 [&>*]:flex-1 sm:[&>*]:flex-none" />
        </section>

        <Card>
          {!hayAlquileres && activas.length === 0 ? (
            <Vacio
              emoji="bolsa-plata"
              titulo="¿De dónde sale tu plata?"
              accion={
                <Boton onClick={() => setNuevo(true)}>
                  <IconoMas />
                  Crear el primero
                </Boton>
              }
            >
              Sueldo, consultoría, redes: uno por cada cosa.
            </Vacio>
          ) : (
            <ul className="divide-y divide-linea">
              {hayAlquileres && (
                <li>
                  <Link href="/alquileres" className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-celeste-claro sm:px-5">
                    <BurbujaEmoji nombre="llave" tono="azul" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">Alquileres</p>
                      {resumen.ingresos.alquileresPorCobrar > 0 && (
                        <p className="text-[11px] text-tenue">
                          falta cobrar <Monto valor={resumen.ingresos.alquileresPorCobrar} />
                        </p>
                      )}
                    </div>
                    <span className="tabular text-sm font-semibold">
                      <Monto valor={alquileres?.pesos ?? 0} />
                    </span>
                    <IconoFlecha className="text-tenue" />
                  </Link>
                </li>
              )}
              {activas.map((f) => {
                const l = delMes.get(f.id);
                return (
                  <li key={f.id}>
                    <Link href={`/ingresos/${f.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-celeste-claro sm:px-5">
                      <BurbujaEmoji nombre={emojiDe(f.emoji, f.nombre, "bolsa-plata")} tono={l ? "lima" : "celeste"} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.nombre}</p>
                        <p className="text-[11px] text-tenue">
                          {l
                            ? `${l.cobros} ${l.cobros === 1 ? "cobro" : "cobros"}${
                                f.moneda !== "ARS" ? ` · ${enMoneda(l.original, f.moneda)}` : ""
                              }`
                            : "Sin cobros"}
                        </p>
                      </div>
                      <span className={`tabular text-sm font-semibold ${l ? "" : "text-tenue"}`}>
                        <Monto valor={l?.pesos ?? 0} />
                      </span>
                      <IconoFlecha className="text-tenue" />
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setNuevo(true)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 text-sm font-semibold text-acento transition-colors hover:bg-celeste-claro sm:px-5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-celeste">
                    <IconoMas />
                  </span>
                  Nuevo ingreso
                </button>
              </li>
            </ul>
          )}
        </Card>

        {archivadas.length > 0 && (
          <details className="rounded-xl border border-borde bg-papel">
            <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-suave sm:px-5">
              Archivados ({archivadas.length})
            </summary>
            <ul className="divide-y divide-linea border-t border-borde">
              {archivadas.map((f) => (
                <li key={f.id}>
                  <Link href={`/ingresos/${f.id}`} className="flex items-center justify-between px-4 py-3 text-sm text-suave hover:bg-fondo sm:px-5">
                    {f.nombre}
                    <IconoFlecha className="text-tenue" />
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {nuevo && (
        <FormIngreso
          abierto={nuevo}
          cerrar={() => setNuevo(false)}
          cantidad={fuentes.length}
          recargar={recargar}
          // Recién creado, lo natural es cargarle el primer cobro.
          alCrear={(id) => router.push(`/ingresos/${id}?mes=${mes}&cobro=1`)}
          ofrecerAlquileres={
            hayAlquileres
              ? undefined
              : async () => {
                  const r = await enviar("/api/config", "POST", { alquileres: "si" });
                  if (!r.ok) return avisar(r.error);
                  setNuevo(false);
                  void recargar();
                  router.push("/alquileres/contratos");
                }
          }
        />
      )}
    </Shell>
  );
}
