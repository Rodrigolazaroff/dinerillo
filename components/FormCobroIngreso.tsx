"use client";

import { useState, type FormEvent } from "react";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, Campo, Input, InputPlata, Panel, Select } from "@/components/ui";
import {
  aCampo, aNumero, hoyISO, periodoActual, periodoLargo, plata, redondear, simboloMoneda, sumarMeses,
} from "@/lib/format";
import type { Ingreso, IngresoCobro } from "@/lib/types";
import { actualizarLocal, conFila, enviar, sinFila } from "@/lib/useData";

// Cargar lo que entró de una fuente. Dos fechas porque no siempre coinciden:
// cuándo entró la plata y a qué mes corresponde (la consultoría de octubre que
// te pagan el 2 de noviembre es plata de octubre).

const ID_FORM = "form-cobro-ingreso";
const URL = "/api/ingreso-cobros";

export function FormCobroIngreso({
  abierto,
  cerrar,
  ingreso,
  cobro,
  inicial,
  aviso,
  ultimoTipoCambio,
  mes,
  recargar,
}: {
  abierto: boolean;
  cerrar: () => void;
  ingreso: Ingreso;
  cobro?: IngresoCobro;
  /** Precarga de un cobro nuevo (la carga asistida). */
  inicial?: Partial<Pick<IngresoCobro, "monto" | "fecha" | "periodo" | "nota">>;
  aviso?: string;
  ultimoTipoCambio: number | null;
  mes: string;
  recargar: () => Promise<unknown>;
}) {
  const enPesos = ingreso.moneda === "ARS";
  const [monto, setMonto] = useState(
    cobro ? aCampo(cobro.monto) : inicial?.monto ? aCampo(inicial.monto) : ""
  );
  const [fecha, setFecha] = useState(
    cobro?.fecha ?? inicial?.fecha ?? (mes === periodoActual() ? hoyISO() : `${mes}-01`)
  );
  const [periodo, setPeriodo] = useState(cobro?.periodo ?? inicial?.periodo ?? mes);
  const [tc, setTc] = useState(
    cobro && !enPesos ? aCampo(cobro.tipo_cambio, 4) : ultimoTipoCambio ? aCampo(ultimoTipoCambio, 4) : ""
  );
  const [nota, setNota] = useState(cobro?.nota ?? inicial?.nota ?? "");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const n = aNumero(monto);
  const t = enPesos ? 1 : aNumero(tc);

  // Los meses que se ofrecen: alrededor de la fecha en que entró.
  const base = fecha.slice(0, 7) || mes;
  const periodos = [...new Set([-2, -1, 0, 1].map((d) => sumarMeses(base, d)).concat(periodo))].sort();

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    if (!Number.isFinite(n) || n <= 0) return setError("Poné el importe.");
    if (!enPesos && (!Number.isFinite(t) || t <= 0)) {
      return setError(`Poné cuántos pesos valía 1 ${ingreso.moneda} ese día.`);
    }
    setError("");
    setGuardando(true);
    const cuerpo = {
      ingreso_id: ingreso.id,
      fecha,
      periodo,
      monto: redondear(n, 2),
      tipo_cambio: enPesos ? 1 : redondear(t, 4),
      nota: nota.trim(),
    };
    const r = cobro
      ? await enviar(URL, "PATCH", { ...cuerpo, id: cobro.id })
      : await enviar(URL, "POST", cuerpo);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    const id = cobro?.id ?? r.id;
    if (id) {
      const fila = { id, created_at: cobro?.created_at ?? new Date().toISOString(), deleted_at: "", ...cuerpo };
      void actualizarLocal((d) => ({ ...d, ingresoCobros: conFila(d.ingresoCobros, fila) }));
    } else {
      void recargar();
    }
    cerrar();
    avisar(cobro ? "Cambios guardados" : "Cobro cargado");
  }

  async function borrar() {
    if (!cobro) return;
    setGuardando(true);
    const r = await enviar(URL, "DELETE", { id: cobro.id });
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    void actualizarLocal((d) => ({ ...d, ingresoCobros: sinFila(d.ingresoCobros, cobro.id) }));
    cerrar();
    avisar("Cobro borrado", async () => {
      await enviar(URL, "PATCH", { id: cobro.id, restaurar: true });
      recargar();
    });
  }

  return (
    <Panel
      abierto={abierto}
      cerrar={cerrar}
      titulo={cobro ? `Editar cobro · ${ingreso.nombre}` : `Cobro · ${ingreso.nombre}`}
      pie={
        <div className="flex flex-col gap-2">
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="flex gap-2">
            {cobro ? (
              <Boton variante="peligro" onClick={borrar} disabled={guardando}>
                Borrar
              </Boton>
            ) : (
              <Boton variante="secundario" onClick={cerrar} disabled={guardando}>
                Cancelar
              </Boton>
            )}
            <Boton type="submit" form={ID_FORM} className="flex-1" disabled={guardando}>
              {guardando ? "Guardando…" : cobro ? "Guardar cambios" : "Cargar cobro"}
            </Boton>
          </div>
        </div>
      }
    >
      <form id={ID_FORM} onSubmit={guardar} className="flex flex-col gap-4">
        {aviso && <Aviso tipo="info">Revisá: {aviso}</Aviso>}
        <Campo label={enPesos ? "Importe" : `Importe en ${ingreso.moneda}`}>
          <InputPlata
            simbolo={simboloMoneda(ingreso.moneda)}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            grande
            required
          />
        </Campo>

        {!enPesos && (
          <Campo
            label={`1 ${ingreso.moneda} en pesos`}
            hint={
              Number.isFinite(n) && Number.isFinite(t) && n > 0 && t > 0
                ? `Son ${plata(n * t)}.`
                : ultimoTipoCambio
                  ? "El del último cobro."
                  : "El que te dieron al cambiar."
            }
          >
            <InputPlata value={tc} onChange={(e) => setTc(e.target.value)} decimales={4} placeholder="0" required />
          </Campo>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Entró el">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </Campo>
          <Campo label="Corresponde a">
            <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="capitalize">
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {periodoLargo(p)}
                </option>
              ))}
            </Select>
          </Campo>
        </div>

        <Campo label="Nota (opcional)">
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={500}
            placeholder="Ej: cliente, factura"
          />
        </Campo>
      </form>
    </Panel>
  );
}
