"use client";

import { useState } from "react";
import { AjustesFinanzas } from "@/components/AjustesFinanzas";
import { salir } from "@/components/MenuPerfil";
import { BotonInstalar, useInstalable } from "@/components/PWA";
import { Shell } from "@/components/Shell";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, Campo, Card, Cargando, Input, InputPct, Interruptor } from "@/components/ui";
import { aNumero } from "@/lib/format";
import { CONDICIONES_FABRICA } from "@/lib/schemas";
import type { CondicionesDefault } from "@/lib/types";
import { enviar, useData, usaAlquileres } from "@/lib/useData";

type Condiciones = Record<keyof CondicionesDefault, string>;

const aTexto = (c: CondicionesDefault): Condiciones =>
  Object.fromEntries(Object.entries(c).map(([k, v]) => [k, String(v).replace(".", ",")])) as Condiciones;

/** Los campos de condiciones, en el orden en que se leen. */
const CAMPOS: { clave: keyof CondicionesDefault; label: string; pct?: boolean }[] = [
  { clave: "aumento_pct", label: "Aumento", pct: true },
  { clave: "aumento_meses", label: "Cada cuántos meses" },
  { clave: "meses", label: "Duración (meses)" },
  { clave: "comision_pct", label: "Comisión", pct: true },
  { clave: "dia_vencimiento", label: "Vence el día" },
  { clave: "mora_pct_diario", label: "Mora por día", pct: true },
  { clave: "prorrateo_pct", label: "Parte de los servicios", pct: true },
];

export default function Ajustes() {
  const { data, error, cargando, recargar } = useData();
  const { yaInstalada } = useInstalable();

  // El borrador solo existe mientras editás: espejar la respuesta de SWR en
  // estado te borraría lo que estás tipeando en cuanto revalida.
  const [borrador, setBorrador] = useState<Condiciones | null>(null);
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmandoPapelera, setConfirmandoPapelera] = useState(false);

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

  const cond = borrador ?? aTexto(data.condiciones);
  const conAlquileres = usaAlquileres(data);
  const tieneContratos = data.contratos.some((c) => !c.deleted_at);

  const borrados = [
    ...data.propiedades, ...data.contratos, ...data.cobros, ...data.gastos, ...data.alquileres,
    ...data.ingresos, ...data.ingresoCobros, ...data.categorias, ...data.misGastos,
    ...data.divGastos, ...data.divCierres,
  ].filter((x) => x.deleted_at).length;

  async function cambiarAlquileres(si: boolean) {
    const r = await enviar("/api/config", "POST", { alquileres: si ? "si" : "no" });
    if (!r.ok) return avisar(r.error);
    await recargar();
  }

  async function guardarCondiciones() {
    const valores = Object.fromEntries(CAMPOS.map(({ clave }) => [clave, aNumero(cond[clave])]));
    if (Object.values(valores).some((v) => !Number.isFinite(v) || v < 0)) {
      return setErr("Revisá los números.");
    }
    setErr("");
    setGuardando(true);
    const r = await enviar(
      "/api/config",
      "POST",
      Object.fromEntries(Object.entries(valores).map(([k, v]) => [`def_${k}`, String(v)]))
    );
    setGuardando(false);
    if (!r.ok) return setErr(r.error);
    setBorrador(null);
    await recargar();
    avisar("Guardado");
  }

  async function vaciarPapelera() {
    const r = await enviar("/api/papelera", "DELETE");
    setConfirmandoPapelera(false);
    if (!r.ok) return avisar(r.error);
    await recargar();
    avisar("Papelera vacía");
  }

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <h1 className="titulo text-2xl font-bold">Ajustes</h1>

        <AjustesFinanzas
          config={data.config}
          categorias={data.categorias}
          nombreCuenta={data.sesion.usuario}
          email={data.sesion.email}
          recargar={recargar}
        />

        <Card titulo="Alquileres">
          <div className="px-4 py-3 sm:px-5">
            <Interruptor
              activo={conAlquileres}
              onCambio={cambiarAlquileres}
              disabled={tieneContratos}
              detalle={tieneContratos ? "Tenés contratos cargados." : undefined}
            >
              Tengo propiedades en alquiler
            </Interruptor>
          </div>
          {conAlquileres && (
            <>
              <div className="border-t border-linea px-4 pb-1 pt-3 sm:px-5">
                <p className="text-sm font-medium">Con qué arranca un contrato nuevo</p>
                <p className="text-xs text-tenue">No cambia los contratos cargados.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-3 sm:px-5">
                {CAMPOS.map(({ clave, label, pct }) => (
                  <Campo key={clave} label={label}>
                    {pct ? (
                      <InputPct value={cond[clave]} onChange={(e) => setBorrador({ ...cond, [clave]: e.target.value })} />
                    ) : (
                      <Input
                        inputMode="numeric"
                        value={cond[clave]}
                        onChange={(e) => setBorrador({ ...cond, [clave]: e.target.value.replace(/\D/g, "") })}
                      />
                    )}
                  </Campo>
                ))}
              </div>
              <div className="flex flex-col gap-2 border-t border-borde px-4 py-3 sm:px-5">
                <Aviso tipo="error">{err}</Aviso>
                <div className="flex gap-2">
                  <Boton onClick={guardarCondiciones} disabled={guardando || !borrador} className="flex-1 sm:flex-none">
                    {guardando ? "Guardando…" : "Guardar"}
                  </Boton>
                  <Boton variante="secundario" onClick={() => setBorrador(aTexto({ ...CONDICIONES_FABRICA }))}>
                    Valores de fábrica
                  </Boton>
                </div>
              </div>
            </>
          )}
        </Card>

        {!yaInstalada && (
          <div id="instalar" className="scroll-mt-20">
            <Card titulo="Instalar la app">
              <div className="px-4 py-4 sm:px-5">
                <BotonInstalar />
              </div>
            </Card>
          </div>
        )}

        <Card titulo="Papelera" nota="Vaciarla borra todo para siempre.">
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
            <p className="text-sm text-suave">
              {borrados === 0 ? "Vacía." : `${borrados} ${borrados === 1 ? "cosa borrada" : "cosas borradas"}`}
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
                  Vaciar
                </Boton>
              ))}
          </div>
        </Card>

        <Boton variante="secundario" onClick={salir} className="self-center">
          Cerrar sesión
        </Boton>
      </div>
    </Shell>
  );
}
