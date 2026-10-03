"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Asistente } from "@/components/Asistente";
import { colorCategoria, PuntoCategoria } from "@/components/Categorias";
import { FormMovimiento } from "@/components/FormMovimiento";
import { IconoDivision, IconoFlecha, IconoMas } from "@/components/iconos";
import { Monto } from "@/components/Privado";
import { SelectorMes } from "@/components/SelectorMes";
import { Shell } from "@/components/Shell";
import { Aviso, BarraParte, Boton, BotonFlotante, Card, Cargando, Vacio } from "@/components/ui";
import { fechaDia, periodoLargo } from "@/lib/format";
import type { MiGasto } from "@/lib/types";
import { useFinanzas } from "@/lib/useFinanzas";
import { usarParametro } from "@/lib/useMes";

// Tus gastos del mes. Los compartidos no se cargan acá: viven en División y
// aparecen como una sola línea con tu parte. Si corregís uno allá, acá se
// actualiza solo, porque no hay copia.


export default function Gastos() {
  const { data, error, recargar, resumen, anterior, mes, prefs } = useFinanzas();
  const [nuevo, setNuevo] = useState(() => usarParametro("nuevo"));
  const [editando, setEditando] = useState<MiGasto | null>(null);

  const propios = useMemo(
    () =>
      (data?.misGastos ?? [])
        .filter((g) => !g.deleted_at && g.periodo === mes)
        .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at)),
    [data, mes]
  );

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

  const cats = new Map(data.categorias.map((c) => [c.id, c]));
  const g = resumen.gastos;
  const delta = anterior ? g.total - anterior.gastos.total : 0;
  const porDia = new Map<string, MiGasto[]>();
  for (const x of propios) porDia.set(x.fecha, [...(porDia.get(x.fecha) ?? []), x]);

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold tracking-tight">Gastos</h1>
          <SelectorMes />
        </div>

        <section className="rounded-2xl border border-borde bg-papel px-5 py-5">
          <p className="text-xs font-medium text-suave">Gastaste en {periodoLargo(mes)}</p>
          <p className="tabular mt-1 text-4xl font-semibold tracking-tight">
            <Monto valor={g.total} />
          </p>
          <p className="mt-2 text-xs text-suave">
            Tuyos <span className="tabular font-medium text-tinta"><Monto valor={g.propios} /></span>
            {" · "}
            tu parte de lo compartido{" "}
            <span className="tabular font-medium text-tinta"><Monto valor={g.compartidos} /></span>
          </p>
          {anterior && anterior.gastos.total > 0 && (
            <p className={`mt-1 text-[11px] ${delta > 0 ? "text-espera" : "text-ok"}`}>
              {delta > 0 ? "▲" : "▼"} <Monto valor={Math.abs(delta)} /> contra {periodoLargo(anterior.periodo)}
            </p>
          )}
          <Asistente modo="gasto" className="mt-4 [&>*]:flex-1 sm:[&>*]:flex-none" />
          {/* En el celular está el "+" flotante; acá solo en pantalla grande. */}
          <div className="mt-4 hidden sm:block">
            <Boton onClick={() => setNuevo(true)}>
              <IconoMas />
              Nuevo gasto
            </Boton>
          </div>
        </section>

        {g.categorias.length > 0 && (
          <Card titulo="Por categoría">
            <ul className="flex flex-col gap-3 px-4 py-4 sm:px-5">
              {g.categorias.map((c) => (
                <li key={c.id || "sin"} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <PuntoCategoria color={c.color} />
                    <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                    <span className="tabular font-semibold">
                      <Monto valor={c.total} />
                    </span>
                  </div>
                  <BarraParte parte={c.total} total={g.total} color={colorCategoria(c.color)} />
                  {c.compartidos > 0 && c.propios > 0 && (
                    <p className="text-[11px] text-tenue">
                      <Monto valor={c.propios} /> tuyos · <Monto valor={c.compartidos} /> compartidos
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card titulo="Movimientos">
          {resumen.division.cantidad > 0 && (
            <Link
              href="/division"
              className="flex items-center gap-3 border-b border-linea px-4 py-3 hover:bg-fondo sm:px-5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-acento-claro text-acento">
                <IconoDivision className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Gastos compartidos · mi parte</p>
                <p className="text-[11px] text-tenue">
                  {resumen.division.cantidad} {resumen.division.cantidad === 1 ? "gasto" : "gastos"} con{" "}
                  {prefs.pareja || "tu pareja"} · se cargan en División
                </p>
              </div>
              <span className="tabular text-sm font-semibold">
                <Monto valor={g.compartidos} />
              </span>
              <IconoFlecha className="text-tenue" />
            </Link>
          )}

          {propios.length === 0 ? (
            <Vacio
              titulo={resumen.division.cantidad ? "No cargaste gastos tuyos este mes" : "Todavía no hay gastos este mes"}
              accion={
                <Boton onClick={() => setNuevo(true)}>
                  <IconoMas />
                  Cargar un gasto
                </Boton>
              }
            >
              Monto, en qué fue y listo. Lo que compartís con tu pareja va en División.
            </Vacio>
          ) : (
            <div>
              {[...porDia.entries()].map(([dia, xs]) => (
                <div key={dia}>
                  <p className="bg-fondo/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-tenue sm:px-5">
                    {fechaDia(dia)}
                  </p>
                  <ul className="divide-y divide-linea">
                    {xs.map((x) => {
                      const c = x.categoria_id ? cats.get(x.categoria_id) : undefined;
                      return (
                        <li key={x.id}>
                          <button
                            type="button"
                            onClick={() => setEditando(x)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-fondo sm:px-5"
                          >
                            <PuntoCategoria color={c && !c.deleted_at ? c.color : 0} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{x.descripcion}</p>
                              <p className="truncate text-[11px] text-tenue">
                                {c && !c.deleted_at ? c.nombre : "Sin categoría"}
                                {x.nota && ` · ${x.nota}`}
                              </p>
                            </div>
                            <span className="tabular text-sm font-semibold">
                              <Monto valor={x.monto} />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <BotonFlotante onClick={() => setNuevo(true)} label="Nuevo gasto" />

      {(nuevo || editando) && (
        <FormMovimiento
          key={editando?.id ?? "nuevo"}
          modo="propio"
          abierto
          cerrar={() => {
            setNuevo(false);
            setEditando(null);
          }}
          gasto={editando ?? undefined}
          mes={mes}
          categorias={data.categorias}
          pareja={prefs.pareja}
          miPctDefault={prefs.divMiPct}
          recargar={recargar}
        />
      )}
    </Shell>
  );
}
