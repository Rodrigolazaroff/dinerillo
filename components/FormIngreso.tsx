"use client";

import { useState, type FormEvent } from "react";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, Campo, Input, Panel, Select } from "@/components/ui";
import { MONEDAS } from "@/lib/schemas";
import type { Ingreso } from "@/lib/types";
import { enviar } from "@/lib/useData";

// Crear o editar una fuente de ingreso. Nada viene cargado de fábrica: el
// nombre lo ponés vos ("Consultoría ciudadanía búlgara", "Sueldo") y la
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
}: {
  abierto: boolean;
  cerrar: () => void;
  ingreso?: Ingreso;
  cantidad: number;
  recargar: () => Promise<unknown>;
  alCrear?: (id: string) => void;
}) {
  const [nombre, setNombre] = useState(ingreso?.nombre ?? "");
  const [moneda, setMoneda] = useState(ingreso?.moneda ?? "ARS");
  const [nota, setNota] = useState(ingreso?.nota ?? "");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    if (!nombre.trim()) return setError("Ponele un nombre.");
    setError("");
    setGuardando(true);
    const cuerpo = { nombre: nombre.trim(), moneda, nota: nota.trim() };
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
        <Campo label="Nombre" hint="Como lo reconozcas: “Sueldo”, “Consultoría”, “Redes”.">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={60}
            autoFocus={!ingreso}
            required
          />
        </Campo>
        <Campo
          label="Moneda en la que cobrás"
          hint={
            ingreso
              ? "Si la cambiás, los cobros ya cargados conservan su importe y su tipo de cambio."
              : "En otra moneda, cada cobro guarda el tipo de cambio del día para pasarlo a pesos."
          }
        >
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
      </form>
    </Panel>
  );
}
