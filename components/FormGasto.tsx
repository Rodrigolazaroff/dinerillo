"use client";

import { useState, type FormEvent } from "react";
import {
  Aviso, Boton, Campo, Input, InputPlata, Panel, Select, Textarea,
} from "@/components/ui";
import { aCampo, aNumero, pct, periodoActual, plata, redondear } from "@/lib/format";
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

/** Lo que puede venir precargado de la carga asistida. */
export type InicialBoleta = Partial<Pick<Gasto, "tipo" | "periodo" | "monto" | "fecha" | "nota">>;

function borradorDe(g?: Gasto, inicial?: InicialBoleta): Borrador {
  if (!g && inicial) {
    return {
      tipo: inicial.tipo ?? "agua",
      periodo: inicial.periodo ?? periodoActual(),
      monto: inicial.monto ? aCampo(inicial.monto) : "",
      propiedad_id: "",
      fecha: inicial.fecha ?? "",
      nota: inicial.nota ?? "",
    };
  }
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
  inicial?: InicialBoleta;
  aviso?: string;
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
  inicial,
  aviso,
  propiedades,
  alDeGuardar,
}: {
  abierto: boolean;
  cerrar: () => void;
  gasto?: Gasto;
  inicial?: InicialBoleta;
  aviso?: string;
  propiedades: Propiedad[];
  alDeGuardar: () => void;
}) {
  const { data } = useData();
  const [b, setB] = useState<Borrador>(() => borradorDe(gasto, inicial));
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
      ? "Sin contratos vigentes: la pagás entera vos."
      : vigentes
          .map((c) => {
            const parte = c.contrato.prorrateo_pct / 100;
            return `${c.contrato.inquilino} ${
              Number.isFinite(monto) ? plata(monto * parte) : comoPct(c.contrato.prorrateo_pct)
            }`;
          })
          .join(" · ");

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    if (!Number.isFinite(monto)) {
      setError("Poné el importe.");
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
      titulo={gasto ? "Editar boleta" : "Nueva boleta"}
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
              {guardando ? "Guardando…" : gasto ? "Guardar cambios" : "Cargar boleta"}
            </Boton>
          </div>
        </div>
      }
    >
      <form id={ID_FORM} onSubmit={guardar} className="flex flex-col gap-4">
        {aviso && <Aviso tipo="info">Revisá: {aviso}</Aviso>}
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
          <Campo label="Mes">
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

        <Campo label="Propiedad">
          <Select value={b.propiedad_id} onChange={(e) => set("propiedad_id", e.target.value)}>
            <option value="">Todas las propiedades</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo label="La pagaste el (opcional)">
          <Input type="date" value={b.fecha} onChange={(e) => set("fecha", e.target.value)} />
        </Campo>

        <Campo label="Nota (opcional)">
          <Textarea
            value={b.nota}
            onChange={(e) => set("nota", e.target.value)}
            placeholder="Ej: vencimiento, n.º de boleta"
            maxLength={500}
          />
        </Campo>
      </form>
    </Panel>
  );
}
