"use client";

import { useMemo, useState } from "react";
import type { Cuota } from "@/lib/calc";
import { diasEntre, fechaCorta, hoyISO, periodoLargo, plata, plataExacta, redondear } from "@/lib/format";
import type { Contrato, Propiedad } from "@/lib/types";
import { enviar } from "@/lib/useData";
import { Aviso, Boton, Campo, Input, InputPlata, Panel, Textarea } from "@/components/ui";

/**
 * Registrar un cobro.
 *
 * El importe esperado no es un número fijo: con recargo por mora diario,
 * depende del día en que entró la plata. Así que cada vez que se toca la fecha
 * se recalcula el esperado con la misma fórmula del server (el bruto y el
 * subtotal ya vienen calculados en la cuota) y el importe sugerido se acomoda.
 * Si no, cargarías el número de ayer.
 */
/**
 * El panel se desmonta al cerrarse y se remonta con `key` distinta cuando cambia
 * lo que se edita.
 *
 * Asi el estado del formulario nace de las props una sola vez, en el
 * useState, y no hace falta un efecto que lo resincronice: un efecto que
 * llama a setState dispara un render extra y, peor, si se equivoca de
 * dependencias te borra lo que estas tipeando cuando SWR revalida.
 */
export function FormCobro(props: {
  abierto: boolean;
  cerrar: () => void;
  cuota: Cuota | null;
  contrato: Contrato | null;
  propiedad: Propiedad | null;
  alDeGuardar: () => void;
}) {
  if (!props.abierto) return null;
  return <FormCobroAbierto key={`${props.contrato?.id ?? ""}-${props.cuota?.periodo ?? ""}`} {...props} />;
}

function FormCobroAbierto({
  abierto,
  cerrar,
  cuota,
  contrato,
  propiedad,
  alDeGuardar,
}: {
  abierto: boolean;
  cerrar: () => void;
  cuota: Cuota | null;
  contrato: Contrato | null;
  propiedad: Propiedad | null;
  alDeGuardar: () => void;
}) {
  const [fecha, setFecha] = useState(hoyISO());
  const [importe, setImporte] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const [mandando, setMandando] = useState(false);
  const [tocoImporte, setTocoImporte] = useState(false);

  const calculo = useMemo(() => {
    if (!cuota || !contrato) return null;
    const dias = Math.max(0, diasEntre(cuota.vence, fecha));
    const recargo = redondear(cuota.bruto * (contrato.mora_pct_diario / 100) * dias);
    const esperado = redondear(cuota.subtotal + recargo);
    // Lo que falta, si ya había un cobro parcial imputado a este período.
    const falta = redondear(Math.max(0, esperado - cuota.cobrado));
    return { dias, recargo, esperado, falta };
  }, [cuota, contrato, fecha]);


  // Mientras no lo toques a mano, el importe sigue solo a lo que falta cobrar.
  // Es un valor derivado, no estado: guardarlo obligaria a resincronizarlo cada
  // vez que cambia la fecha (y con ella la mora).
  const importeMostrado = tocoImporte
    ? importe
    : calculo && calculo.falta
      ? String(calculo.falta)
      : "";

  if (!cuota || !contrato) return null;

  const monto = Number(String(importeMostrado).replace(/\./g, "").replace(",", ".")) || 0;
  const diferencia = calculo ? redondear(monto + cuota.cobrado - calculo.esperado) : 0;

  async function guardar() {
    setError("");
    if (monto <= 0) {
      setError("Poné el importe que te transfirieron");
      return;
    }
    setMandando(true);
    const r = await enviar("/api/cobros", "POST", {
      contrato_id: contrato!.id,
      periodo: cuota!.periodo,
      fecha_cobro: fecha,
      importe: monto,
      nota,
    });
    setMandando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    alDeGuardar();
  }

  return (
    <Panel
      abierto={abierto}
      cerrar={cerrar}
      titulo={`Cobro de ${periodoLargo(cuota.periodo)}`}
      pie={
        <div className="flex gap-2">
          <Boton variante="secundario" onClick={cerrar} className="flex-1">
            Cancelar
          </Boton>
          <Boton onClick={guardar} disabled={mandando} className="flex-[2]">
            {mandando ? "Guardando…" : "Registrar cobro"}
          </Boton>
        </div>
      }
    >
      <p className="mb-4 text-xs text-suave">
        {propiedad?.nombre ?? "Propiedad"} · {contrato.inquilino} · vencía el{" "}
        {fechaCorta(cuota.vence)}
      </p>

      <div className="mb-4 rounded-lg border border-borde bg-fondo px-3 py-2.5">
        <Detalle label="Alquiler" valor={plata(cuota.bruto)} />
        {cuota.comision > 0 && (
          <Detalle label={`Comisión ${contrato.comision_pct}%`} valor={`− ${plata(cuota.comision)}`} />
        )}
        <Detalle label="Neto del alquiler" valor={plata(cuota.neto)} />
        {cuota.partes.map((p) => (
          <Detalle
            key={p.tipo}
            label={`${etiquetaGasto(p.tipo)} · ${contrato.prorrateo_pct}% de ${plataExacta(p.total)}`}
            valor={plataExacta(p.parte)}
          />
        ))}
        {calculo && calculo.dias > 0 && (
          <Detalle
            label={`Mora · ${calculo.dias} ${calculo.dias === 1 ? "día" : "días"} al ${contrato.mora_pct_diario}% diario`}
            valor={plata(calculo.recargo)}
            tono="peligro"
          />
        )}
        {cuota.cobrado > 0 && (
          <Detalle label="Ya cobrado de este mes" valor={`− ${plata(cuota.cobrado)}`} />
        )}
        <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-borde pt-1.5">
          <span className="text-xs font-medium">Tendría que entrar</span>
          <span className="tabular text-sm font-semibold">{plataExacta(calculo?.falta ?? 0)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Campo label="Fecha en que entró la plata">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>

        <Campo
          label="Importe transferido"
          hint={
            monto > 0 && calculo
              ? diferencia === 0
                ? "Coincide exacto con lo esperado."
                : diferencia > 0
                  ? `Te transfirieron ${plataExacta(diferencia)} de más.`
                  : `Faltan ${plataExacta(Math.abs(diferencia))}. Va a quedar como cobro parcial.`
              : undefined
          }
        >
          <InputPlata
            value={importeMostrado}
            onChange={(e) => {
              setTocoImporte(true);
              setImporte(e.target.value);
            }}
            placeholder="0"
          />
        </Campo>

        <Campo label="Nota" hint="Opcional. Por ejemplo el medio de pago.">
          <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} />
        </Campo>

        <Aviso tipo="error">{error}</Aviso>
      </div>
    </Panel>
  );
}

function Detalle({
  label,
  valor,
  tono,
}: {
  label: string;
  valor: string;
  tono?: "peligro";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className={`text-[11px] ${tono === "peligro" ? "text-peligro" : "text-suave"}`}>{label}</span>
      <span className={`tabular text-xs ${tono === "peligro" ? "text-peligro" : ""}`}>{valor}</span>
    </div>
  );
}

const ETIQUETAS: Record<string, string> = {
  agua: "Agua",
  inmobiliario: "Impuesto inmobiliario",
  expensas: "Expensas",
  abl: "ABL",
  luz: "Luz",
  gas: "Gas",
  mantenimiento: "Mantenimiento",
  reparacion: "Reparación",
  seguro: "Seguro",
  otro: "Otro",
};

export const etiquetaGasto = (t: string) => ETIQUETAS[t] ?? t;
