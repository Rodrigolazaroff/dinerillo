"use client";

import { useMemo, useState } from "react";
import { FormCobro } from "@/components/FormCobro";
import { Shell } from "@/components/Shell";
import { IconoAlerta, IconoTacho } from "@/components/iconos";
import { Aviso, Boton, Card, Cargando, Estado, Kpi, Segmentado, Vacio } from "@/components/ui";
import type { Cuota } from "@/lib/calc";
import { fechaCorta, fechaDia, periodoCorto, periodoLargo, plata, plataExacta } from "@/lib/format";
import type { Contrato, Propiedad } from "@/lib/types";
import { enviar, useData } from "@/lib/useData";

type Vista = "pendientes" | "historial";

interface Pendiente {
  cuota: Cuota;
  contrato: Contrato;
  propiedad: Propiedad | null;
}

export default function Cobros() {
  const { data, error, cargando, recargar, puedeEditar } = useData();
  const [vista, setVista] = useState<Vista>("pendientes");
  const [elegida, setElegida] = useState<Pendiente | null>(null);
  const [confirmando, setConfirmando] = useState("");
  const [aviso, setAviso] = useState("");

  // Todo lo que falta cobrar, de todos los contratos, ordenado por vencimiento:
  // lo más viejo primero, que es lo que hay que reclamar.
  const pendientes = useMemo<Pendiente[]>(() => {
    if (!data) return [];
    return data.calculados
      .flatMap((cc) =>
        cc.cuotas
          .filter((q) => q.estado === "vencido" || q.estado === "pendiente" || q.estado === "parcial")
          .map((cuota) => ({ cuota, contrato: cc.contrato, propiedad: cc.propiedad }))
      )
      .sort((a, b) => a.cuota.vence.localeCompare(b.cuota.vence));
  }, [data]);

  const cobradas = useMemo<Pendiente[]>(() => {
    if (!data) return [];
    return data.calculados
      .flatMap((cc) =>
        cc.cuotas
          .filter((q) => q.cobrado > 0)
          .map((cuota) => ({ cuota, contrato: cc.contrato, propiedad: cc.propiedad }))
      )
      .sort((a, b) => b.cuota.periodo.localeCompare(a.cuota.periodo));
  }, [data]);

  async function borrarCobro(id: string) {
    setAviso("");
    const r = await enviar("/api/cobros", "DELETE", { id });
    setConfirmando("");
    if (!r.ok) {
      setAviso(r.error);
      return;
    }
    recargar();
  }

  if (error) {
    return (
      <Shell>
        <Aviso tipo="error">{error.message}</Aviso>
      </Shell>
    );
  }
  if (cargando || !data) {
    return (
      <Shell>
        <Cargando />
      </Shell>
    );
  }

  const { resumen } = data;

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Kpi
            etiqueta="Falta este mes"
            valor={plata(resumen.mes.falta)}
            detalle={`${resumen.mes.cobradas} de ${resumen.mes.cuotas} cobrados`}
            tono={resumen.mes.falta > 0 ? "espera" : "ok"}
          />
          <Kpi etiqueta="Cobrado este mes" valor={plata(resumen.mes.cobrado)} tono="ok" />
          <Kpi
            etiqueta="Deuda vencida"
            valor={plata(resumen.deudaVencida)}
            detalle={resumen.deudaVencida > 0 ? "incluye la mora corrida a hoy" : "nada atrasado"}
            tono={resumen.deudaVencida > 0 ? "peligro" : "neutro"}
            className="col-span-2 sm:col-span-1"
          />
        </div>

        <Segmentado
          valor={vista}
          onCambio={setVista}
          opciones={[
            { valor: "pendientes", label: `Por cobrar (${pendientes.length})` },
            { valor: "historial", label: "Cobrados" },
          ]}
          className="self-start"
        />

        <Aviso tipo="error">{aviso}</Aviso>

        {vista === "pendientes" ? (
          <Card
            titulo="Por cobrar"
            nota="Ordenado por vencimiento. Tocá una fila para registrar la transferencia."
          >
            {pendientes.length === 0 ? (
              <Vacio titulo="No hay nada pendiente">
                {data.contratos.length === 0
                  ? "Todavía no cargaste ningún contrato. Andá a Contratos y levantá el primero."
                  : "Todos los períodos vencidos están cobrados. Buen mes."}
              </Vacio>
            ) : (
              <ul className="divide-y divide-borde">
                {pendientes.map((p) => (
                  <li key={`${p.contrato.id}-${p.cuota.periodo}`}>
                    <button
                      onClick={() => puedeEditar && setElegida(p)}
                      disabled={!puedeEditar}
                      className="fila-hover flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-default sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {p.propiedad?.nombre ?? "Sin propiedad"}
                          <span className="font-normal text-suave"> · {p.contrato.inquilino}</span>
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-suave">
                          <span>{periodoLargo(p.cuota.periodo)}</span>
                          <span className="text-tenue">·</span>
                          <span>vence {fechaDia(p.cuota.vence)}</span>
                          {p.cuota.diasMora > 0 && (
                            <span className="inline-flex items-center gap-1 text-peligro">
                              <IconoAlerta className="h-3 w-3" />
                              {p.cuota.diasMora} {p.cuota.diasMora === 1 ? "día" : "días"} de mora
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular text-sm font-semibold">
                          {plata(p.cuota.esperado - p.cuota.cobrado)}
                        </p>
                        <Estado estado={p.cuota.estado} className="mt-1" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card titulo="Cobros registrados" nota="El más reciente arriba.">
            {cobradas.length === 0 ? (
              <Vacio titulo="Todavía no registraste cobros">
                Cuando entre la primera transferencia, cargala desde “Por cobrar”.
              </Vacio>
            ) : (
              <ul className="divide-y divide-borde">
                {cobradas.map((p) => (
                  <li key={`${p.contrato.id}-${p.cuota.periodo}`} className="px-4 py-3 sm:px-5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {p.propiedad?.nombre ?? "Sin propiedad"}
                          <span className="font-normal text-suave"> · {periodoCorto(p.cuota.periodo)}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-suave">
                          {p.cuota.fechaCobro ? `entró el ${fechaCorta(p.cuota.fechaCobro)}` : "sin fecha"}
                          {p.cuota.recargo > 0 && ` · con ${plata(p.cuota.recargo)} de mora`}
                          {Math.abs(p.cuota.diferencia) >= 1 &&
                            ` · ${p.cuota.diferencia > 0 ? "de más" : "de menos"} ${plataExacta(Math.abs(p.cuota.diferencia))}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular text-sm font-semibold text-ok">{plata(p.cuota.cobrado)}</p>
                        <Estado estado={p.cuota.estado} className="mt-1" />
                      </div>
                    </div>

                    {puedeEditar && p.cuota.cobros.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1 border-t border-linea pt-2">
                        {p.cuota.cobros.map((c) => (
                          <li key={c.id} className="flex items-center justify-between gap-2 text-[11px] text-suave">
                            <span className="tabular">
                              {fechaCorta(c.fecha_cobro)} · {plataExacta(c.importe)}
                              {c.nota && <span className="text-tenue"> · {c.nota}</span>}
                            </span>
                            {confirmando === c.id ? (
                              <span className="flex shrink-0 items-center gap-1">
                                <Boton variante="peligro" tamano="sm" onClick={() => borrarCobro(c.id)}>
                                  Sí, borrar
                                </Boton>
                                <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmando("")}>
                                  No
                                </Boton>
                              </span>
                            ) : (
                              <Boton
                                variante="fantasma"
                                tamano="sm"
                                onClick={() => setConfirmando(c.id)}
                                aria-label="Borrar este cobro"
                              >
                                <IconoTacho />
                              </Boton>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {!puedeEditar && (
          <p className="text-center text-[11px] text-tenue">
            Tu usuario es de solo lectura: podés ver todo pero no cargar cobros.
          </p>
        )}
      </div>

      <FormCobro
        abierto={!!elegida}
        cerrar={() => setElegida(null)}
        cuota={elegida?.cuota ?? null}
        contrato={elegida?.contrato ?? null}
        propiedad={elegida?.propiedad ?? null}
        alDeGuardar={() => {
          setElegida(null);
          recargar();
        }}
      />
    </Shell>
  );
}
