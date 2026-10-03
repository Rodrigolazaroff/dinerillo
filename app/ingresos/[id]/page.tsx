"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormCobroIngreso } from "@/components/FormCobroIngreso";
import { Emoji } from "@/components/Emoji";
import { FormIngreso } from "@/components/FormIngreso";
import { IconoMas } from "@/components/iconos";
import { Monto } from "@/components/Privado";
import { Shell } from "@/components/Shell";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, Card, Cargando, Kpi, Vacio } from "@/components/ui";
import { emojiDe } from "@/lib/emoji";
import { enPesos } from "@/lib/finanzas";
import { enMoneda, fechaDia, periodoLargo, sumarMeses } from "@/lib/format";
import type { IngresoCobro } from "@/lib/types";
import { enviar } from "@/lib/useData";
import { useFinanzas } from "@/lib/useFinanzas";
import { usarParametro } from "@/lib/useMes";

// Una fuente de ingreso con todo su historial. Desde acá se carga lo que va
// entrando, y se edita, archiva o borra la fuente.


export default function DetalleIngreso() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, recargar, mes } = useFinanzas();
  const [cargando, setCargando] = useState(() => usarParametro("cobro"));
  const [editandoCobro, setEditandoCobro] = useState<IngresoCobro | null>(null);
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const fuente = data?.ingresos.find((i) => i.id === id && !i.deleted_at);
  const cobros = useMemo(
    () =>
      (data?.ingresoCobros ?? [])
        .filter((c) => c.ingreso_id === id && !c.deleted_at)
        .sort((a, b) => b.periodo.localeCompare(a.periodo) || b.fecha.localeCompare(a.fecha)),
    [data, id]
  );

  if (error) {
    return (
      <Shell>
        <Aviso tipo="error">{error.message}</Aviso>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <Cargando />
      </Shell>
    );
  }
  if (!fuente) {
    return (
      <Shell>
        <Vacio titulo="No encontré ese ingreso" accion={<Link href="/ingresos" className="text-sm text-acento">Volver a Ingresos</Link>}>
          Puede que lo hayas borrado.
        </Vacio>
      </Shell>
    );
  }

  const extranjera = fuente.moneda !== "ARS";
  const anio = mes.slice(0, 4);
  const delMes = cobros.filter((c) => c.periodo === mes);
  const sumaPesos = (xs: IngresoCobro[]) => xs.reduce((a, c) => a + enPesos(c), 0);
  const sumaOriginal = (xs: IngresoCobro[]) => xs.reduce((a, c) => a + c.monto, 0);
  const delAnio = cobros.filter((c) => c.periodo.startsWith(anio));

  // Promedio de los últimos seis meses que tuvieron algún cobro.
  const ultimos6 = Array.from({ length: 6 }, (_, i) => sumarMeses(mes, -i));
  const conCobro = ultimos6.filter((p) => cobros.some((c) => c.periodo === p));
  const promedio = conCobro.length
    ? sumaPesos(cobros.filter((c) => conCobro.includes(c.periodo))) / conCobro.length
    : 0;

  const ultimoTc = extranjera ? cobros.find((c) => c.tipo_cambio > 0)?.tipo_cambio ?? null : null;

  const porPeriodo = new Map<string, IngresoCobro[]>();
  for (const c of cobros) porPeriodo.set(c.periodo, [...(porPeriodo.get(c.periodo) ?? []), c]);

  async function archivar() {
    if (!fuente) return;
    setOcupado(true);
    const valor = fuente.archivado_at ? "" : new Date().toISOString();
    const r = await enviar("/api/ingresos", "PATCH", { id: fuente.id, archivado_at: valor });
    setOcupado(false);
    if (!r.ok) return avisar(r.error);
    await recargar();
    avisar(valor ? "Archivado: ya no aparece en la lista" : "Reactivado");
  }

  async function borrar() {
    if (!fuente) return;
    setOcupado(true);
    const r = await enviar("/api/ingresos", "DELETE", { id: fuente.id });
    setOcupado(false);
    if (!r.ok) return avisar(r.error);
    await recargar();
    router.push("/ingresos");
    avisar(`Borraste ${fuente.nombre}`, async () => {
      await enviar("/api/ingresos", "PATCH", { id: fuente.id, restaurar: true });
      recargar();
    });
  }

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <div>
          <Link href="/ingresos" className="text-xs text-tenue hover:text-tinta">
            ‹ Ingresos
          </Link>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <h1 className="titulo flex items-center gap-2 text-2xl font-bold">
              <Emoji nombre={emojiDe(fuente.emoji, fuente.nombre, "bolsa-plata")} tamano="lg" className="pop" />
              {fuente.nombre}
              {extranjera && (
                <span className="ml-2 rounded-md bg-acento-claro px-1.5 py-0.5 align-middle text-[11px] font-semibold text-acento">
                  {fuente.moneda}
                </span>
              )}
              {fuente.archivado_at && (
                <span className="ml-2 rounded-md bg-fondo px-1.5 py-0.5 align-middle text-[11px] font-semibold text-tenue">
                  archivado
                </span>
              )}
            </h1>
            <Boton onClick={() => setCargando(true)}>
              <IconoMas />
              Cargar cobro
            </Boton>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Kpi
            etiqueta={periodoLargo(mes)}
            valor={<Monto valor={sumaPesos(delMes)} />}
            detalle={extranjera && delMes.length ? enMoneda(sumaOriginal(delMes), fuente.moneda) : `${delMes.length} ${delMes.length === 1 ? "cobro" : "cobros"}`}
          />
          <Kpi
            etiqueta={`Año ${anio}`}
            valor={<Monto valor={sumaPesos(delAnio)} corto />}
            detalle={extranjera && delAnio.length ? enMoneda(sumaOriginal(delAnio), fuente.moneda) : `${delAnio.length} ${delAnio.length === 1 ? "cobro" : "cobros"}`}
          />
          <Kpi
            etiqueta="Promedio"
            valor={<Monto valor={promedio} corto />}
            detalle={conCobro.length ? `por mes, últimos ${conCobro.length === 1 ? "1 mes" : `${conCobro.length} meses`} con cobros` : "todavía sin cobros"}
            className="col-span-2 sm:col-span-1"
          />
        </div>

        <Card titulo="Cobros">
          {cobros.length === 0 ? (
            <Vacio
              titulo="Todavía no hay cobros"
              accion={
                <Boton onClick={() => setCargando(true)}>
                  <IconoMas />
                  Cargar el primero
                </Boton>
              }
            >
              Cada vez que entra plata de {fuente.nombre}, cargala acá con la fecha.
            </Vacio>
          ) : (
            <div className="divide-y divide-linea">
              {[...porPeriodo.entries()].map(([p, xs]) => (
                <div key={p}>
                  <div className="flex items-baseline justify-between bg-fondo/60 px-4 py-1.5 sm:px-5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-tenue">
                      {periodoLargo(p)}
                    </span>
                    <span className="tabular text-[11px] font-semibold text-suave">
                      <Monto valor={sumaPesos(xs)} />
                    </span>
                  </div>
                  <ul className="divide-y divide-linea">
                    {xs.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setEditandoCobro(c)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-fondo sm:px-5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm">Entró el {fechaDia(c.fecha)}</p>
                            {(c.nota || extranjera) && (
                              <p className="truncate text-[11px] text-tenue">
                                {extranjera && `TC $ ${c.tipo_cambio.toLocaleString("es-AR")}`}
                                {extranjera && c.nota && " · "}
                                {c.nota}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="tabular text-sm font-semibold">
                              {extranjera ? <>{enMoneda(c.monto, fuente.moneda)}</> : <Monto valor={c.monto} />}
                            </p>
                            {extranjera && (
                              <p className="tabular text-[11px] text-tenue">
                                <Monto valor={enPesos(c)} />
                              </p>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card titulo="Este ingreso">
          <div className="flex flex-wrap gap-2 px-4 py-4 sm:px-5">
            <Boton variante="secundario" tamano="sm" onClick={() => setEditando(true)} disabled={ocupado}>
              Editar
            </Boton>
            <Boton variante="secundario" tamano="sm" onClick={archivar} disabled={ocupado}>
              {fuente.archivado_at ? "Reactivar" : "Archivar"}
            </Boton>
            {cobros.length === 0 ? (
              <Boton variante="peligro" tamano="sm" onClick={borrar} disabled={ocupado}>
                Borrar
              </Boton>
            ) : (
              <p className="basis-full text-[11px] leading-relaxed text-tenue">
                Si ya no cobrás de acá, archivalo: deja de aparecer en la lista y su historial sigue
                contando en los meses que pasaron.
              </p>
            )}
          </div>
        </Card>
      </div>

      {(cargando || editandoCobro) && (
        <FormCobroIngreso
          key={editandoCobro?.id ?? "nuevo"}
          abierto
          cerrar={() => {
            setCargando(false);
            setEditandoCobro(null);
          }}
          ingreso={fuente}
          cobro={editandoCobro ?? undefined}
          ultimoTipoCambio={ultimoTc}
          mes={mes}
          recargar={recargar}
        />
      )}
      {editando && (
        <FormIngreso
          abierto={editando}
          cerrar={() => setEditando(false)}
          ingreso={fuente}
          cantidad={data.ingresos.length}
          recargar={recargar}
        />
      )}
    </Shell>
  );
}
