"use client";

import { useMemo, useState } from "react";
import { Asistente } from "@/components/Asistente";
import { PuntoCategoria } from "@/components/Categorias";
import { FormMovimiento } from "@/components/FormMovimiento";
import { IconoCheck, IconoMas } from "@/components/iconos";
import { Monto } from "@/components/Privado";
import { SelectorMes } from "@/components/SelectorMes";
import { Shell } from "@/components/Shell";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, BotonFlotante, Card, Cargando, Fila, Input, Vacio } from "@/components/ui";
import { fechaCorta, fechaDia, hoyISO, periodoLargo } from "@/lib/format";
import type { DivGasto } from "@/lib/types";
import { enviar } from "@/lib/useData";
import { compartirPdf, fraseDelAjuste, pdfDivision } from "@/lib/pdfDivision";
import { useFinanzas } from "@/lib/useFinanzas";
import { usarParametro } from "@/lib/useMes";

// Lo que se comparte con la pareja, resuelto en un número: quién le transfiere
// cuánto a quién. Cada gasto se carga una vez, con quién lo pagó y qué parte
// es tuya; tu parte aparece sola en Gastos.


export default function Division() {
  const { data, error, recargar, resumen, mes, prefs } = useFinanzas();
  const [nuevo, setNuevo] = useState(() => usarParametro("nuevo"));
  const [editando, setEditando] = useState<DivGasto | null>(null);
  const [nombre, setNombre] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [armandoPdf, setArmandoPdf] = useState(false);

  const gastos = useMemo(
    () =>
      (data?.divGastos ?? [])
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

  const d = resumen.division;
  // Al principio de una frase va con mayúscula; en el medio, no.
  const Pareja = prefs.pareja || "Tu pareja";
  const pareja = prefs.pareja || "tu pareja";
  const cats = new Map(data.categorias.map((c) => [c.id, c]));
  const aMano = Math.abs(d.saldo) < 1;

  async function guardarNombre() {
    if (!nombre.trim()) return;
    const r = await enviar("/api/config", "POST", { pareja_nombre: nombre.trim() });
    if (!r.ok) return avisar(r.error);
    await recargar();
    avisar("Listo");
  }

  async function marcarTransferido() {
    setOcupado(true);
    const r = await enviar("/api/division-cierres", "POST", {
      periodo: mes,
      monto: Math.abs(d.saldo),
      fecha: hoyISO(),
      nota: d.saldo > 0 ? `${Pareja} → vos` : `Vos → ${pareja}`,
    });
    setOcupado(false);
    if (!r.ok) return avisar(r.error);
    await recargar();
    avisar("Mes saldado");
  }

  async function deshacerCierre() {
    if (!d.cierre) return;
    setOcupado(true);
    const r = await enviar("/api/division-cierres", "DELETE", { id: d.cierre.id });
    setOcupado(false);
    if (!r.ok) return avisar(r.error);
    await recargar();
    avisar("El mes volvió a quedar abierto");
  }

  async function compartir() {
    if (!data) return;
    setArmandoPdf(true);
    try {
      const blob = await pdfDivision({
        mes,
        yo: data.sesion.usuario,
        pareja: Pareja,
        gastos,
        categorias: data.categorias,
        division: d,
      });
      const r = await compartirPdf(
        blob,
        `Division-${mes}.pdf`,
        `${periodoLargo(mes)}: ${fraseDelAjuste(d, data.sesion.usuario, Pareja)}`
      );
      if (r === "descargado") avisar("PDF descargado");
    } catch {
      avisar("No pude armar el PDF. Probá de nuevo.");
    } finally {
      setArmandoPdf(false);
    }
  }

  const porDia = new Map<string, DivGasto[]>();
  for (const g of gastos) porDia.set(g.fecha, [...(porDia.get(g.fecha) ?? []), g]);

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold tracking-tight">División</h1>
          <SelectorMes />
        </div>

        {!prefs.pareja && (
          <Card>
            <div className="flex flex-col gap-2 px-4 py-4 sm:px-5">
              <p className="text-sm font-medium">¿Con quién compartís los gastos?</p>
              <div className="flex gap-2">
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Su nombre"
                  maxLength={40}
                  onKeyDown={(e) => e.key === "Enter" && guardarNombre()}
                />
                <Boton onClick={guardarNombre} disabled={!nombre.trim()}>
                  Guardar
                </Boton>
              </div>
            </div>
          </Card>
        )}

        <section
          className={`rounded-2xl px-5 py-5 ${
            d.cierre || aMano ? "border border-borde bg-papel" : "bg-acento text-white"
          }`}
        >
          {d.cantidad === 0 ? (
            <p className="text-sm text-suave">Todavía no hay gastos compartidos en {periodoLargo(mes)}.</p>
          ) : d.cierre ? (
            <>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ok">
                <IconoCheck className="h-4 w-4" />
                Saldado el {fechaCorta(d.cierre.fecha)}
              </p>
              <p className="tabular mt-1 text-3xl font-semibold tracking-tight">
                <Monto valor={d.cierre.monto} />
              </p>
              <p className="mt-1 text-xs text-suave">{d.cierre.nota}</p>
              {Math.abs(Math.abs(d.saldo) - d.cierre.monto) >= 1 && (
                <p className="mt-2 text-xs text-espera">
                  Después se cargaron más gastos: ahora la cuenta da <Monto valor={Math.abs(d.saldo)} />{" "}
                  {d.saldo > 0 ? `a tu favor` : `a favor de ${pareja}`}.
                </p>
              )}
              <button
                type="button"
                onClick={deshacerCierre}
                disabled={ocupado}
                className="mt-3 text-xs font-medium text-acento underline-offset-2 hover:underline"
              >
                Deshacer: no se transfirió
              </button>
            </>
          ) : aMano ? (
            <p className="text-base font-semibold">Están a mano en {periodoLargo(mes)}</p>
          ) : (
            <>
              <p className="text-xs font-medium text-white/75">
                {d.saldo > 0 ? `${Pareja} te tiene que pasar` : `Le tenés que pasar a ${pareja}`}
              </p>
              <p className="tabular mt-1 text-4xl font-semibold tracking-tight">
                <Monto valor={Math.abs(d.saldo)} />
              </p>
              <Boton
                variante="secundario"
                className="mt-4 border-white/30 bg-white/10 text-white hover:bg-white/20"
                onClick={marcarTransferido}
                disabled={ocupado}
              >
                <IconoCheck className="h-4 w-4" />
                Ya se transfirió
              </Boton>
            </>
          )}
        </section>

        <Asistente modo="compartido" className="[&>*]:flex-1 sm:[&>*]:flex-none" />

        {d.cantidad > 0 && (
          <Card
            titulo="El mes"
            accion={
              <Boton variante="secundario" tamano="sm" onClick={compartir} disabled={armandoPdf}>
                {armandoPdf ? "Armando…" : "Compartir PDF"}
              </Boton>
            }
          >
            <div className="px-4 py-2 sm:px-5">
              <Fila label="Gastaron entre los dos" valor={<Monto valor={d.total} />} fuerte />
              <Fila label="Pagaste vos" valor={<Monto valor={d.pagueYo} />} />
              <Fila label={`Pagó ${pareja}`} valor={<Monto valor={d.pagoPareja} />} />
              <div className="my-1 border-t border-linea" />
              <Fila label="Tu parte (va a tus Gastos)" valor={<Monto valor={d.miParte} />} fuerte />
              <Fila label={`Parte de ${pareja}`} valor={<Monto valor={d.suParte} />} />
            </div>
          </Card>
        )}

        <Card
          titulo="Gastos compartidos"
          accion={
            <div className="hidden sm:block">
              <Boton onClick={() => setNuevo(true)}>
                <IconoMas />
                Gasto compartido
              </Boton>
            </div>
          }
        >
          {gastos.length === 0 ? (
            <Vacio
              titulo="Nada compartido este mes"
              accion={
                <Boton onClick={() => setNuevo(true)}>
                  <IconoMas />
                  Cargar un gasto
                </Boton>
              }
            >
              El súper, el alquiler, los servicios: cargalos con quién pagó y qué parte es tuya. La
              cuenta de quién le pasa cuánto a quién se hace sola.
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
                      const mia = (x.monto * x.mi_pct) / 100;
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
                                Pagó {x.pago === "yo" ? "vos" : pareja} ·{" "}
                                {x.mi_pct === 50 ? "mitad y mitad" : x.mi_pct === 100 ? "todo tuyo" : x.mi_pct === 0 ? `todo de ${pareja}` : `tu parte ${x.mi_pct}%`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="tabular text-sm font-semibold">
                                <Monto valor={x.monto} />
                              </p>
                              <p className="tabular text-[11px] text-tenue">
                                tuyo <Monto valor={mia} />
                              </p>
                            </div>
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

      <BotonFlotante onClick={() => setNuevo(true)} label="Nuevo gasto compartido" />

      {(nuevo || editando) && (
        <FormMovimiento
          key={editando?.id ?? "nuevo"}
          modo="compartido"
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
