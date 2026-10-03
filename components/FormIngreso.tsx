"use client";

import { useState, type FormEvent } from "react";
import { Emoji } from "@/components/Emoji";
import { ElegirEmoji } from "@/components/ElegirEmoji";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, Campo, Input, Panel, Select } from "@/components/ui";
import { emojiDe } from "@/lib/emoji";
import { MONEDAS } from "@/lib/schemas";
import type { Ingreso } from "@/lib/types";
import { enviar } from "@/lib/useData";

// Crear o editar una fuente de ingreso. Nada viene cargado de fábrica: el
// nombre lo ponés vos ("Consultoría", "Sueldo") y la
// moneda es la que te pagan.

const ID_FORM = "form-ingreso";

const NOMBRE_MONEDA: Record<string, string> = {
  ARS: "Pesos",
  USD: "Dólares",
  EUR: "Euros",
  BRL: "Reales",
  BGN: "Levas búlgaras",
};

export function FormIngreso({
  abierto,
  cerrar,
  ingreso,
  cantidad,
  recargar,
  alCrear,
  ofrecerAlquileres,
}: {
  abierto: boolean;
  cerrar: () => void;
  ingreso?: Ingreso;
  cantidad: number;
  recargar: () => Promise<unknown>;
  alCrear?: (id: string) => void;
  /** Si no usa Alquileres, se lo ofrece acá: es un ingreso más, con contratos. */
  ofrecerAlquileres?: () => void;
}) {
  const [nombre, setNombre] = useState(ingreso?.nombre ?? "");
  const [moneda, setMoneda] = useState(ingreso?.moneda ?? "ARS");
  const [nota, setNota] = useState(ingreso?.nota ?? "");
  // Vacío = se sugiere por el nombre mientras lo escribís.
  const [emoji, setEmoji] = useState(ingreso?.emoji ?? "");
  const [eligiendo, setEligiendo] = useState(false);
  const emojiVisible = emojiDe(emoji, nombre, "bolsa-plata");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    if (!nombre.trim()) return setError("Ponele un nombre.");
    setError("");
    setGuardando(true);
    const cuerpo = { nombre: nombre.trim(), moneda, nota: nota.trim(), emoji: emojiVisible };
    let idNuevo = "";
    if (ingreso) {
      const r = await enviar("/api/ingresos", "PATCH", { ...cuerpo, id: ingreso.id });
      if (!r.ok) {
        setGuardando(false);
        return setError(r.error);
      }
    } else {
      const res = await fetch("/api/ingresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cuerpo, orden: cantidad }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGuardando(false);
        return setError(data?.error ?? "No pude guardar");
      }
      idNuevo = data.id;
    }
    await recargar();
    setGuardando(false);
    cerrar();
    avisar(ingreso ? "Cambios guardados" : `Listo: ${cuerpo.nombre}`);
    if (idNuevo) alCrear?.(idNuevo);
  }

  return (
    <Panel
      abierto={abierto}
      cerrar={cerrar}
      titulo={ingreso ? "Editar ingreso" : "Nuevo ingreso"}
      pie={
        <div className="flex flex-col gap-2">
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton type="submit" form={ID_FORM} className="flex-1" disabled={guardando}>
              {guardando ? "Guardando…" : ingreso ? "Guardar cambios" : "Crear ingreso"}
            </Boton>
          </div>
        </div>
      }
    >
      <form id={ID_FORM} onSubmit={guardar} className="flex flex-col gap-4">
        <div className="flex items-end gap-3">
          <button
            type="button"
            onClick={() => setEligiendo(true)}
            aria-label="Cambiar el emoji"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-celeste-claro transition-transform active:scale-90"
          >
            <Emoji nombre={emojiVisible} tamano="lg" />
          </button>
          <Campo label="Nombre" className="flex-1">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              placeholder="Sueldo, Consultoría, Redes…"
              required
            />
          </Campo>
        </div>
        <Campo label="Moneda" hint={ingreso ? "Los cobros cargados no cambian." : undefined}>
          <Select value={moneda} onChange={(e) => setMoneda(e.target.value)}>
            {MONEDAS.map((m) => (
              <option key={m} value={m}>
                {NOMBRE_MONEDA[m] ?? m} ({m})
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="Nota (opcional)">
          <Input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} />
        </Campo>
        {!ingreso && ofrecerAlquileres && (
          <button
            type="button"
            onClick={ofrecerAlquileres}
            className="flex min-h-12 items-center gap-3 rounded-xl bg-celeste-claro px-3 text-left text-sm transition-colors hover:bg-celeste/50"
          >
            <Emoji nombre="llave" tamano="md" />
            <span className="flex-1">
              <span className="font-semibold">¿Alquilás propiedades?</span>
              <span className="block text-xs text-suave">Contratos, aumentos y cobros</span>
            </span>
          </button>
        )}
      </form>
      {eligiendo && (
        <ElegirEmoji
          abierto
          cerrar={() => setEligiendo(false)}
          actual={emojiVisible}
          titulo="Emoji del ingreso"
          alElegir={setEmoji}
        />
      )}
    </Panel>
  );
}
