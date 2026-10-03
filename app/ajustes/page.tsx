"use client";

import Link from "next/link";
import { useState } from "react";
import { AjustesFinanzas } from "@/components/AjustesFinanzas";
import { salir } from "@/components/MenuPerfil";
import { BotonInstalar, useInstalable } from "@/components/PWA";
import { Shell } from "@/components/Shell";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, Card, Cargando, Panel } from "@/components/ui";
import { enviar, useData } from "@/lib/useData";

export default function Ajustes() {
  const { data, error, cargando, recargar } = useData();
  const { yaInstalada } = useInstalable();

  const [confirmandoPapelera, setConfirmandoPapelera] = useState(false);
  const [borrandoCuenta, setBorrandoCuenta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [errorCuenta, setErrorCuenta] = useState("");

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


  const borrados = [
    ...data.propiedades, ...data.contratos, ...data.cobros, ...data.gastos, ...data.alquileres,
    ...data.ingresos, ...data.ingresoCobros, ...data.categorias, ...data.misGastos,
    ...data.divGastos, ...data.divCierres,
  ].filter((x) => x.deleted_at).length;

  async function eliminarCuenta() {
    setOcupado(true);
    setErrorCuenta("");
    const r = await enviar("/api/cuenta", "DELETE");
    if (!r.ok) {
      setOcupado(false);
      return setErrorCuenta(r.error);
    }
    // Recarga completa: no queda nada de la cuenta en memoria.
    window.location.replace("/login");
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

        <div className="flex flex-col items-center gap-1 pt-2">
          <Boton variante="secundario" onClick={salir}>
            Cerrar sesión
          </Boton>
          <Boton variante="peligro" tamano="sm" onClick={() => setBorrandoCuenta(true)}>
            Eliminar mi cuenta
          </Boton>
          <p className="mt-2 text-xs text-tenue">
            <Link href="/terminos" className="underline underline-offset-2">
              Términos
            </Link>
            {" · "}
            <Link href="/privacidad" className="underline underline-offset-2">
              Privacidad
            </Link>
          </p>
        </div>
      </div>

      {borrandoCuenta && (
        <Panel
          abierto
          cerrar={() => !ocupado && setBorrandoCuenta(false)}
          titulo="¿Eliminar tu cuenta?"
          pie={
            <div className="flex flex-col gap-2">
              {errorCuenta && <Aviso tipo="error">{errorCuenta}</Aviso>}
              <div className="flex gap-2">
                <Boton variante="secundario" onClick={() => setBorrandoCuenta(false)} disabled={ocupado}>
                  Cancelar
                </Boton>
                <Boton
                  className="flex-1 !bg-peligro !text-white !shadow-none"
                  onClick={eliminarCuenta}
                  disabled={ocupado}
                >
                  {ocupado ? "Eliminando…" : "Sí, eliminar todo"}
                </Boton>
              </div>
            </div>
          }
        >
          <p className="text-sm leading-relaxed text-suave">
            Se borran tu cuenta y todo lo que cargaste: ingresos, gastos, ahorros, división y
            alquileres. <span className="font-semibold text-tinta">No se puede deshacer.</span>
          </p>
        </Panel>
      )}
    </Shell>
  );
}
