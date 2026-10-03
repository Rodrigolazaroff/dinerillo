"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { Cuota } from "@/lib/calc";
import {
  aCampo, aNumero, diasEntre, fechaCorta, hoyISO, periodoLargo, plata, plataExacta, redondear,
} from "@/lib/format";
import type { Contrato, Propiedad } from "@/lib/types";
import { enviar } from "@/lib/useData";
import { Aviso, Boton, Campo, Input, InputPlata, Panel, Textarea } from "@/components/ui";

const ID_FORM = "form-cobro";

/**
 * Cargar un cobro.
 *
 * El importe esperado no es un número fijo: con recargo por mora diario,
 * depende del día en que entró la plata. Así que cada vez que se toca la fecha
 * se recalcula el esperado con la misma fórmula del server (el bruto y el
 * subtotal ya vienen calculados en la cuota) y el importe sugerido se acomoda.
 * Si no, cargarías el número de ayer.
 *
 * El panel se desmonta al cerrarse y se remonta con `key` distinta cuando
 * cambia la cuota: el estado nace de las props una sola vez, sin un efecto que
 * lo resincronice y te borre lo que estás tipeando cuando SWR revalida.
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
  // Es un valor derivado, no estado: guardarlo obligaría a resincronizarlo cada
  // vez que cambia la fecha (y con ella la mora). Va con el formato del campo
  // ("620.936,33"): un "620936.33" crudo se leería como miles.
  const importeMostrado = tocoImporte ? importe : calculo && calculo.falta ? aCampo(calculo.falta) : "";

  if (!cuota || !contrato) return null;

  const monto = aNumero(importeMostrado);
  const hayMonto = Number.isFinite(monto) && monto > 0;
  const diferencia = calculo && hayMonto ? redondear(monto + cuota.cobrado - calculo.esperado) : 0;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!hayMonto) {
      setError("Poné el importe.");
      return;
    }
    setMandando(true);
    const r = await enviar("/api/cobros", "POST", {
      contrato_id: contrato!.id,
      periodo: cuota!.periodo,
      fecha_cobro: fecha,
      importe: redondear(monto),
      nota: nota.trim(),
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
        <div className="flex flex-col gap-2">
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={cerrar} disabled={mandando}>
              Cancelar
            </Boton>
            <Boton type="submit" form={ID_FORM} className="flex-1" disabled={mandando}>
              {mandando ? "Guardando…" : "Cargar cobro"}
            </Boton>
          </div>
        </div>
      }
    >
      <p className="mb-4 text-xs text-suave">
        {propiedad?.nombre ?? "Propiedad"} · {contrato.inquilino} · vencía el {fechaCorta(cuota.vence)}
      </p>

      <div className="mb-4 rounded-lg border border-borde bg-fondo px-3 py-2.5">
        <Detalle label="Alquiler" valor={plata(cuota.bruto)} />
        {cuota.comision > 0 && (
          <Detalle label={`Comisión ${contrato.comision_pct}%`} valor={`− ${plata(cuota.comision)}`} />
        )}
        <Detalle label="Te queda" valor={plata(cuota.neto)} />
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
        {cuota.cobrado > 0 && <Detalle label="Ya cobrado de este mes" valor={`− ${plata(cuota.cobrado)}`} />}
        <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-borde pt-1.5">
          <span className="text-xs font-medium">Tendría que entrar</span>
          <span className="tabular text-sm font-semibold">{plataExacta(calculo?.falta ?? 0)}</span>
        </div>
      </div>

      <form id={ID_FORM} onSubmit={guardar} className="flex flex-col gap-3">
        <Campo
          label="Cuánto entró"
          hint={
            hayMonto && calculo
              ? Math.abs(diferencia) < 1
                ? "Justo."
                : diferencia > 0
                  ? `${plataExacta(diferencia)} de más.`
                  : `Faltan ${plataExacta(-diferencia)}: queda parcial.`
              : undefined
          }
        >
          <InputPlata
            grande
            value={importeMostrado}
            onChange={(e) => {
              setTocoImporte(true);
              setImporte(e.target.value);
            }}
            placeholder="0"
          />
        </Campo>

        <Campo label="Entró el">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </Campo>

        <Campo label="Nota (opcional)">
          <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="Ej: transferencia" />
        </Campo>
      </form>
    </Panel>
  );
}

function Detalle({ label, valor, tono }: { label: string; valor: string; tono?: "peligro" }) {
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
