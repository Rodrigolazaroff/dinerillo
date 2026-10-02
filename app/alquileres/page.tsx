"use client";

import Link from "next/link";
import {
  CobradoVsEsperado, ComposicionDelIngreso, EscaleraDeAlquileres,
} from "@/components/Graficos";
import { Shell } from "@/components/Shell";
import { IconoAlerta, IconoCheck, IconoMas, IconoReloj } from "@/components/iconos";
import { Aviso, Card, Cargando, clasesBoton, Estado, Kpi, Medidor, Vacio } from "@/components/ui";
import { fechaDia, periodoLargo, plata, plataCorta } from "@/lib/format";
import { useData } from "@/lib/useData";

export default function Resumen() {
  const { data, error, cargando } = useData();

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
  const sinNada = data.contratos.filter((c) => !c.deleted_at).length === 0;

  if (sinNada) {
    return (
      <Shell>
        <Card>
          <Vacio
            titulo="Arranquemos"
            accion={
              <Link href="/alquileres/contratos" className={clasesBoton()}>
                <IconoMas /> Cargar el primer contrato
              </Link>
            }
          >
            Cargá una propiedad y su contrato con las condiciones que pactaste: el monto inicial,
            cada cuánto y cuánto aumenta, la comisión de la inmobiliaria y qué parte de los
            servicios paga el inquilino. Con eso solo, la app te arma los meses del contrato
            enteros y ya podés ir registrando los cobros.
          </Vacio>
        </Card>
      </Shell>
    );
  }

  const todoCobrado = resumen.mes.falta <= 0 && resumen.mes.cuotas > 0;

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        {/* El número que importa cuando abrís la app: qué falta cobrar. */}
        <Card className="px-4 py-4 sm:px-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-tenue">
            {periodoLargo(resumen.periodoActual)}
          </p>
          {todoCobrado ? (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ok-claro text-ok">
                <IconoCheck />
              </span>
              <p className="text-2xl font-semibold tracking-tight text-ok sm:text-3xl">
                Todo cobrado
              </p>
            </div>
          ) : (
            <>
              <p className="tabular mt-1 text-3xl font-semibold leading-none tracking-tight sm:text-4xl">
                {plata(resumen.mes.falta)}
              </p>
              <p className="mt-1.5 text-xs text-suave">
                falta cobrar este mes ·{" "}
                <span className="text-tinta">{plata(resumen.mes.cobrado)}</span> ya entraron
              </p>
            </>
          )}
          <div className="mt-3">
            <Medidor parte={resumen.mes.cobrado} total={resumen.mes.esperado} />
            <p className="mt-1.5 text-[11px] text-tenue">
              {resumen.mes.cobradas} de {resumen.mes.cuotas}{" "}
              {resumen.mes.cuotas === 1 ? "alquiler cobrado" : "alquileres cobrados"}
            </p>
          </div>
        </Card>

        {resumen.deudaVencida > 0 && (
          <Link href="/alquileres/cobros" className="block">
            <div className="flex items-center gap-3 rounded-xl bg-peligro-claro px-4 py-3 ring-1 ring-inset ring-peligro/20">
              <IconoAlerta className="h-5 w-5 shrink-0 text-peligro" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-peligro">
                  {plata(resumen.deudaVencida)} atrasados
                </p>
                <p className="text-[11px] text-peligro/80">
                  Incluye la mora corrida hasta hoy. Tocá para ver el detalle.
                </p>
              </div>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Kpi
            etiqueta="Neto del año"
            valor={plataCorta(resumen.anio.neto)}
            detalle={`de ${plataCorta(resumen.anio.bruto)} de alquileres`}
          />
          <Kpi
            etiqueta="Comisiones"
            valor={plataCorta(resumen.anio.comision)}
            detalle="lo que se lleva la inmobiliaria"
          />
          <Kpi
            etiqueta="Cobrado en el año"
            valor={plataCorta(resumen.anio.cobrado)}
            detalle="lo que ya entró, con reintegros y mora"
            className="col-span-2 sm:col-span-1"
          />
        </div>

        {resumen.proximos.length > 0 && (
          <Card titulo="Lo que sigue" nota="Los próximos vencimientos, de lo más viejo a lo más nuevo.">
            <ul className="divide-y divide-borde">
              {resumen.proximos.slice(0, 4).map(({ cuota, contrato, propiedad }) => (
                <li key={`${contrato.id}-${cuota.periodo}`} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <IconoReloj className="shrink-0 text-tenue" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {propiedad?.nombre ?? "Sin propiedad"}
                      <span className="text-suave"> · {contrato.inquilino}</span>
                    </p>
                    <p className="text-[11px] text-suave">vence {fechaDia(cuota.vence)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm font-medium">{plata(cuota.esperado - cuota.cobrado)}</p>
                    <Estado estado={cuota.estado} className="mt-0.5" />
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-borde px-4 py-2.5 sm:px-5">
              <Link href="/alquileres/cobros" className="text-xs font-medium text-acento underline-offset-2 hover:underline">
                Ver todos y registrar un cobro
              </Link>
            </div>
          </Card>
        )}

        <CobradoVsEsperado resumen={resumen} meses={12} />
        <EscaleraDeAlquileres resumen={resumen} />
        <ComposicionDelIngreso resumen={resumen} />
      </div>
    </Shell>
  );
}
