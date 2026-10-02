"use client";

import { useState } from "react";
import { AjustesFinanzas } from "@/components/AjustesFinanzas";
import { BotonInstalar } from "@/components/PWA";
import { Shell } from "@/components/Shell";
import { Aviso, Boton, Campo, Card, Cargando, Input, InputPct } from "@/components/ui";
import { CONDICIONES_FABRICA } from "@/lib/schemas";
import type { CondicionesDefault } from "@/lib/types";
import { enviar, useData } from "@/lib/useData";

export default function Ajustes() {
  const { data, error, cargando, recargar, puedeEditar } = useData();

  // Lo que se muestra sale de la planilla; el borrador solo existe mientras
  // estas editando. Espejar la respuesta de SWR en estado te borraria lo que
  // estas tipeando en cuanto revalida.
  const [borrador, setBorrador] = useState<CondicionesDefault | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmandoPapelera, setConfirmandoPapelera] = useState(false);

  const cond: CondicionesDefault = borrador ?? data?.condiciones ?? { ...CONDICIONES_FABRICA };
  const setCond = (c: CondicionesDefault) => setBorrador(c);

  const borrados = data
    ? [
        ...data.propiedades, ...data.contratos, ...data.cobros, ...data.gastos, ...data.alquileres,
        ...data.ingresos, ...data.ingresoCobros, ...data.categorias, ...data.misGastos,
        ...data.divGastos, ...data.divCierres,
      ].filter((x) => x.deleted_at).length
    : 0;

  async function guardarCondiciones() {
    setErr("");
    setMsg("");
    setGuardando(true);
    const r = await enviar("/api/config", "POST", {
      def_aumento_pct: String(cond.aumento_pct),
      def_aumento_meses: String(cond.aumento_meses),
      def_meses: String(cond.meses),
      def_comision_pct: String(cond.comision_pct),
      def_mora_pct_diario: String(cond.mora_pct_diario),
      def_dia_vencimiento: String(cond.dia_vencimiento),
      def_prorrateo_pct: String(cond.prorrateo_pct),
    });
    setGuardando(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setMsg("Listo. El próximo contrato que cargues arranca con estos valores.");
    recargar();
  }

  async function vaciarPapelera() {
    setErr("");
    setMsg("");
    const r = await enviar("/api/papelera", "DELETE");
    setConfirmandoPapelera(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setMsg("Papelera vacía.");
    recargar();
  }

  async function salir() {
    await fetch("/auth/salir", { method: "POST" });
    // Recarga completa: que no quede nada de la sesion anterior en memoria.
    window.location.href = "/login";
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

  const num = (v: string) => Number(String(v).replace(",", ".")) || 0;

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <Card titulo="Instalar en el celular" nota="Queda como una app más, con su icono y sin barra del navegador.">
          <div className="px-4 py-4 sm:px-5">
            <BotonInstalar />
          </div>
        </Card>

        <AjustesFinanzas config={data.config} categorias={data.categorias} recargar={recargar} />

        <Card
          titulo="Alquileres: con qué arranca un contrato nuevo"
          nota="Son sólo los valores que vienen precargados en el formulario. Cada contrato guarda los suyos, y cambiar esto no toca ningún contrato ya cargado."
        >
          <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:px-5">
            <Campo label="% de aumento">
              <InputPct
                value={String(cond.aumento_pct)}
                onChange={(e) => setCond({ ...cond, aumento_pct: num(e.target.value) })}
                disabled={!puedeEditar}
              />
            </Campo>
            <Campo label="Cada cuántos meses">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={String(cond.aumento_meses)}
                onChange={(e) => setCond({ ...cond, aumento_meses: num(e.target.value) })}
                disabled={!puedeEditar}
              />
            </Campo>
            <Campo label="Duración en meses">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={String(cond.meses)}
                onChange={(e) => setCond({ ...cond, meses: num(e.target.value) })}
                disabled={!puedeEditar}
              />
            </Campo>
            <Campo label="% de comisión">
              <InputPct
                value={String(cond.comision_pct)}
                onChange={(e) => setCond({ ...cond, comision_pct: num(e.target.value) })}
                disabled={!puedeEditar}
              />
            </Campo>
            <Campo label="Día de vencimiento">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={String(cond.dia_vencimiento)}
                onChange={(e) => setCond({ ...cond, dia_vencimiento: num(e.target.value) })}
                disabled={!puedeEditar}
              />
            </Campo>
            <Campo label="% de mora por día">
              <InputPct
                value={String(cond.mora_pct_diario)}
                onChange={(e) => setCond({ ...cond, mora_pct_diario: num(e.target.value) })}
                disabled={!puedeEditar}
              />
            </Campo>
            <Campo
              label="% de servicios por inquilino"
              hint="Con dos inquilinos al 50% cada uno, el agua y el impuesto quedan cubiertos."
              className="col-span-2"
            >
              <InputPct
                value={String(cond.prorrateo_pct)}
                onChange={(e) => setCond({ ...cond, prorrateo_pct: num(e.target.value) })}
                disabled={!puedeEditar}
              />
            </Campo>
          </div>
          {puedeEditar && (
            <div className="flex flex-col gap-2 border-t border-borde px-4 py-3 sm:px-5">
              <Aviso tipo="error">{err}</Aviso>
              <Aviso tipo="ok">{msg}</Aviso>
              <div className="flex gap-2">
                <Boton onClick={guardarCondiciones} disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar"}
                </Boton>
                <Boton variante="secundario" onClick={() => setCond({ ...CONDICIONES_FABRICA })}>
                  Volver a los de fábrica
                </Boton>
              </div>
            </div>
          )}
        </Card>

        <Card titulo="Los datos" nota="Viven en tu cuenta y solo los ves vos.">
          <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
            <p className="text-[11px] leading-relaxed text-tenue">
              Se guardan filas planas: los aumentos, la comisión, el reparto de servicios y la mora
              se calculan acá cada vez, así que corregir un dato nunca rompe una cuenta.
            </p>
          </div>
        </Card>

        {puedeEditar && (
          <Card
            titulo="Papelera"
            nota="Lo que borrás queda marcado pero no se va, por si te arrepentís. Vaciarla lo borra para siempre."
          >
            <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <p className="text-xs text-suave">
                {borrados === 0
                  ? "No hay nada borrado."
                  : `${borrados} ${borrados === 1 ? "registro borrado" : "registros borrados"}.`}
              </p>
              {borrados > 0 &&
                (confirmandoPapelera ? (
                  <span className="flex shrink-0 gap-1">
                    <Boton variante="peligro" tamano="sm" onClick={vaciarPapelera}>
                      Sí, vaciar
                    </Boton>
                    <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmandoPapelera(false)}>
                      No
                    </Boton>
                  </span>
                ) : (
                  <Boton variante="peligro" tamano="sm" onClick={() => setConfirmandoPapelera(true)}>
                    Vaciar papelera
                  </Boton>
                ))}
            </div>
          </Card>
        )}

        <Card titulo="Sesión">
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
            <p className="text-xs text-suave">
              Entraste como <span className="font-medium text-tinta">{data.sesion.usuario}</span>
            </p>
            <Boton variante="secundario" tamano="sm" onClick={salir}>
              Cerrar sesión
            </Boton>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
