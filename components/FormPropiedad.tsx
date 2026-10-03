"use client";

import { useState, type FormEvent } from "react";
import { Aviso, Boton, Campo, Input, Panel, Select, Textarea } from "@/components/ui";
import { TIPOS_PROPIEDAD } from "@/lib/schemas";
import type { Propiedad, TipoPropiedad } from "@/lib/types";
import { enviar } from "@/lib/useData";

/** Los tipos salen del schema; acá sólo se les pone el nombre que se lee. */
export const LABEL_TIPO: Record<TipoPropiedad, string> = {
  casa: "Casa",
  local: "Local",
  departamento: "Departamento",
  cochera: "Cochera",
  otro: "Otro",
};

const FORM_ID = "form-propiedad";

type Campos = {
  nombre: string;
  direccion: string;
  tipo: TipoPropiedad;
  nota: string;
  orden: string;
};

function inicial(p?: Propiedad): Campos {
  return {
    nombre: p?.nombre ?? "",
    direccion: p?.direccion ?? "",
    tipo: p?.tipo ?? "casa",
    nota: p?.nota ?? "",
    orden: String(p?.orden ?? 0),
  };
}

/**
 * El panel se desmonta al cerrarse y se remonta con `key` distinta cuando cambia
 * lo que se edita.
 *
 * Así el estado del formulario nace de las props una sola vez, en el
 * useState, y no hace falta un efecto que lo resincronice: un efecto que
 * llama a setState dispara un render extra y, peor, si se equivoca de
 * dependencias te borra lo que estás tipeando cuando SWR revalida.
 */
export function FormPropiedad(props: {
  abierto: boolean;
  cerrar: () => void;
  propiedad?: Propiedad;
  alDeGuardar: () => void;
}) {
  if (!props.abierto) return null;
  return <FormPropiedadAbierto key={props.propiedad?.id ?? "nueva"} {...props} />;
}

function FormPropiedadAbierto({
  abierto,
  cerrar,
  propiedad,
  alDeGuardar,
}: {
  abierto: boolean;
  cerrar: () => void;
  propiedad?: Propiedad;
  alDeGuardar: () => void;
}) {
  const [campos, setCampos] = useState<Campos>(() => inicial(propiedad));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const set = <K extends keyof Campos>(k: K, v: Campos[K]) =>
    setCampos((c) => ({ ...c, [k]: v }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!campos.nombre.trim()) {
      setError("Ponele un nombre a la propiedad.");
      return;
    }
    setError("");
    setGuardando(true);
    const body = {
      nombre: campos.nombre.trim(),
      direccion: campos.direccion.trim(),
      tipo: campos.tipo,
      nota: campos.nota.trim(),
      orden: Math.round(Number(campos.orden) || 0),
    };
    const r = await enviar(
      "/api/propiedades",
      propiedad ? "PATCH" : "POST",
      propiedad ? { ...body, id: propiedad.id } : body
    );
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
      titulo={propiedad ? "Editar propiedad" : "Nueva propiedad"}
      pie={
        <div className="flex flex-col gap-2">
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton type="submit" form={FORM_ID} className="flex-1" disabled={guardando}>
              {guardando ? "Guardando…" : propiedad ? "Guardar cambios" : "Cargar propiedad"}
            </Boton>
          </div>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={guardar} className="flex flex-col gap-3">
        <Campo label="Nombre">
          <Input
            value={campos.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder="Casa del fondo"
            autoComplete="off"
            required
          />
        </Campo>

        <Campo label="Dirección">
          <Input
            value={campos.direccion}
            onChange={(e) => set("direccion", e.target.value)}
            placeholder="Av. Siempreviva 742"
            autoComplete="off"
          />
        </Campo>

        <Campo label="Tipo">
          <Select value={campos.tipo} onChange={(e) => set("tipo", e.target.value as TipoPropiedad)}>
            {TIPOS_PROPIEDAD.map((t) => (
              <option key={t} value={t}>
                {LABEL_TIPO[t]}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo label="Nota (opcional)">
          <Textarea
            value={campos.nota}
            onChange={(e) => set("nota", e.target.value)}
            placeholder="Ej: medidor de agua compartido"
          />
        </Campo>

        {/* El orden también decide el color de la propiedad en los gráficos. */}
        <Campo label="Orden" hint="Menor = más arriba.">
          <Input
            type="text"
            inputMode="numeric"
            value={campos.orden}
            onChange={(e) => set("orden", e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="tabular"
          />
        </Campo>
      </form>
    </Panel>
  );
}
