"use client";

import { useState, type FormEvent } from "react";
import {
  Aviso, Boton, Campo, Input, InputPlata, Panel, Select, Textarea,
} from "@/components/ui";
import { pct, periodoActual, plata, redondear } from "@/lib/format";
import { TIPOS_GASTO } from "@/lib/schemas";
import type { Gasto, Propiedad, TipoGasto } from "@/lib/types";
import { enviar, useData } from "@/lib/useData";

const ID_FORM = "form-gasto";

export const ETIQUETA_GASTO: Record<TipoGasto, string> = {
  agua: "Agua",
  inmobiliario: "Impuesto inmobiliario",
  expensas: "Expensas",
  luz: "Luz",
  gas: "Gas",
  abl: "ABL",
  otro: "Otro",
};

// El importe se escribe y se lee igual en el formulario y en la grilla de
// meses, así que las dos conversiones viven acá y las importa la pantalla. No
// hay un lib para esto y duplicarlas es pedir que se separen con el tiempo.

const nfCampo = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/** Un número como se ve dentro de un campo editable: "17.872,66". */
export function aCampo(n: number): string {
  return Number.isFinite(n) ? nfCampo.format(n) : "";
}

/**
 * Lee un importe tipeado a mano. Acepta "17.872,66", "17872,66" y "17872.66".
 * Devuelve NaN si no hay nada parseable, para poder distinguir un campo vacío
 * de un cero cargado a propósito.
 */
export function aNumero(crudo: string): number {
  const s = crudo.replace(/[^\d,.-]/g, "").trim();
  if (!s) return NaN;
  const coma = s.includes(",");
  const punto = s.includes(".");
  let normal = s;
  if (coma && punto) normal = s.replace(/\./g, "").replace(",", ".");
  else if (coma) normal = s.replace(",", ".");
  // Un punto solo es ambiguo: en "17.872" separa miles, en "17.87" son
  // centavos. Si los grupos son de tres dígitos gana la lectura de miles,
  // que es como se escribe la plata acá.
  else if (punto && /^-?\d{1,3}(\.\d{3})+$/.test(s)) normal = s.replace(/\./g, "");
  const n = Number(normal);
  return Number.isFinite(n) ? n : NaN;
}

/** "50" -> "50%", "33.5" -> "33,5%" */
const comoPct = (n: number) => pct(n / 100, Number.isInteger(n) ? 0 : 1);

interface Borrador {
  tipo: TipoGasto;
  periodo: string;
  monto: string;
  propiedad_id: string;
  fecha: string;
  nota: string;
}

function borradorDe(g?: Gasto): Borrador {
  if (!g) {
    // El caso de todos los meses es la boleta del agua, así que el formulario
    // abre ahí y no en el gasto más raro.
    return {
      tipo: "agua", periodo: periodoActual(),
      monto: "", propiedad_id: "", fecha: "", nota: "",
    };
  }
  return {
    tipo: g.tipo,
    periodo: g.periodo,
    monto: aCampo(g.monto),
    propiedad_id: g.propiedad_id,
    fecha: g.fecha,
    nota: g.nota,
  };
}

/**
 * El panel se desmonta al cerrarse y se remonta con `key` distinta cuando cambia
 * lo que se edita.
 *
 * Asi el estado del formulario nace de las props una sola vez, en el
 * useState, y no hace falta un efecto que lo resincronice: un efecto que
 * llama a setState dispara un render extra y, peor, si se equivoca de
 * dependencias te borra lo que estas tipeando cuando SWR revalida.
 */
export function FormGasto(props: {
  abierto: boolean;
  cerrar: () => void;
  gasto?: Gasto;
  propiedades: Propiedad[];
  alDeGuardar: () => void;
}) {
  if (!props.abierto) return null;
  return <FormGastoAbierto key={props.gasto?.id ?? "nuevo"} {...props} />;
}

function FormGastoAbierto({
  abierto,
  cerrar,
  gasto,
  propiedades,
  alDeGuardar,
}: {
  abierto: boolean;
  cerrar: () => void;
  gasto?: Gasto;
  propiedades: Propiedad[];
  alDeGuardar: () => void;
}) {
  const { data } = useData();
  const [b, setB] = useState<Borrador>(() => borradorDe(gasto));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);


  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) =>
    setB((p) => ({ ...p, [k]: v }));

  function cambiarTipo(tipo: TipoGasto) {
    set("tipo", tipo);
  }

  const vigentes = (data?.calculados ?? []).filter((c) => c.vigente);
  const monto = aNumero(b.monto);

  const hintImporte = vigentes.length === 0
      ? "Cargá el total de la boleta. No hay contratos vigentes: por ahora la estás poniendo entera."
      : `Cargá el total de la boleta. Cada inquilino paga su parte: ${vigentes
          .map((c) => {
            const parte = c.contrato.prorrateo_pct / 100;
            return `${c.contrato.inquilino} ${
              Number.isFinite(monto) ? plata(monto * parte) : comoPct(c.contrato.prorrateo_pct)
            }`;
          })
          .join(" · ")}`;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    if (!Number.isFinite(monto)) {
      setError("Poné el importe de la boleta.");
      return;
    }
    if (monto < 0) {
      setError("El importe no puede ser negativo.");
      return;
    }
    setError("");
    setGuardando(true);
    const cuerpo = {
      tipo: b.tipo,
      periodo: b.periodo,
      fecha: b.fecha,
      propiedad_id: b.propiedad_id,
      monto: redondear(monto, 2),
      nota: b.nota.trim(),
    };
    const r = gasto
      ? await enviar("/api/boletas", "PATCH", { ...cuerpo, id: gasto.id })
      : await enviar("/api/boletas", "POST", cuerpo);
    setGuardando(false);
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
      titulo={gasto ? "Editar gasto" : "Cargar gasto"}
      pie={
        <div className="flex flex-col gap-2">
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="flex gap-2">
            <Boton variante="secundario" className="flex-1" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Boton>
            {/* El botón vive en el pie del panel, fuera del <form>: `form` lo
                vuelve a atar, así se dispara la validación del navegador. */}
            <Boton type="submit" form={ID_FORM} className="flex-[2]" disabled={guardando}>
              {guardando ? "Guardando…" : gasto ? "Guardar cambios" : "Cargar gasto"}
            </Boton>
          </div>
        </div>
      }
    >
      <form id={ID_FORM} onSubmit={guardar} className="flex flex-col gap-4">
        <Campo label="Tipo">
          <Select
            value={b.tipo}
            onChange={(e) => cambiarTipo(e.target.value as TipoGasto)}
            required
          >
            {TIPOS_GASTO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_GASTO[t]}
              </option>
            ))}
          </Select>
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Período" hint="El mes al que corresponde la boleta.">
            <Input
              type="month"
              value={b.periodo}
              onChange={(e) => set("periodo", e.target.value)}
              required
            />
          </Campo>

          <Campo label="Importe total" hint={hintImporte}>
            <InputPlata
              value={b.monto}
              onChange={(e) => set("monto", e.target.value)}
              placeholder="0"
              required
            />
          </Campo>
        </div>

        <Campo
          label="Propiedad"
          hint="Dejalo en 'todas' si es una sola boleta para todo, como un único medidor de agua."
        >
          <Select value={b.propiedad_id} onChange={(e) => set("propiedad_id", e.target.value)}>
            <option value="">Todas las propiedades</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo label="Fecha de pago" hint="Opcional. Cuándo la pagaste.">
          <Input type="date" value={b.fecha} onChange={(e) => set("fecha", e.target.value)} />
        </Campo>

        <Campo label="Nota" hint="Opcional.">
          <Textarea
            value={b.nota}
            onChange={(e) => set("nota", e.target.value)}
            placeholder="Vencimiento, número de boleta, lo que sirva después."
            maxLength={500}
          />
        </Campo>
      </form>
    </Panel>
  );
}
