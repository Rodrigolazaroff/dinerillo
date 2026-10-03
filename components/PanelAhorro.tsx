"use client";

import { useState, type FormEvent } from "react";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, Campo, Input, InputPlata, Panel, Segmentado } from "@/components/ui";
import {
  aCampo, aNumero, enMoneda, fechaDia, hoyISO, periodoActual, periodoLargo, plata, redondear,
} from "@/lib/format";
import type { Ahorro } from "@/lib/types";
import { actualizarLocal, conFila, enviar, sinFila } from "@/lib/useData";

// "Ya ahorré": lo que apartaste a propósito sale de lo que te quedó, y lo
// demás queda disponible. Se puede apartar en dólares, con el tipo de cambio
// del día, como cualquier argentino.

const ID_FORM = "form-ahorro";
const URL = "/api/ahorros";

/** Dónde lo pusiste: un toque y queda como nota. */
const DESTINOS = ["Plazo fijo", "Dólares", "FCI", "Cuenta remunerada"];

type Moneda = "ARS" | "USD";

export function PanelAhorro({
  cerrar,
  mes,
  falta,
  ahorros,
  inicial,
  aviso,
  ultimoTipoCambio,
  recargar,
}: {
  cerrar: () => void;
  mes: string;
  /** Lo que falta para la meta, en pesos: con eso arranca el importe. */
  falta: number;
  /** Los ahorros de este mes, para verlos y borrarlos. */
  ahorros: Ahorro[];
  /** Precarga de la carga asistida ("ahorré 200 dólares"). */
  inicial?: { monto?: number; moneda?: string; fecha?: string; nota?: string };
  aviso?: string;
  ultimoTipoCambio: number | null;
  recargar: () => Promise<unknown>;
}) {
  const [moneda, setMoneda] = useState<Moneda>(inicial?.moneda === "USD" ? "USD" : "ARS");
  const [monto, setMonto] = useState(
    inicial?.monto ? aCampo(inicial.monto) : falta > 0 && moneda === "ARS" ? aCampo(Math.round(falta)) : ""
  );
  const [tc, setTc] = useState(ultimoTipoCambio ? aCampo(ultimoTipoCambio, 4) : "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? (mes === periodoActual() ? hoyISO() : `${mes}-01`));
  const [nota, setNota] = useState(inicial?.nota ?? "");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const n = aNumero(monto);
  const t = moneda === "ARS" ? 1 : aNumero(tc);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    if (!Number.isFinite(n) || n <= 0) return setError("Poné cuánto apartaste.");
    if (!Number.isFinite(t) || t <= 0) return setError("Poné a cuánto estaba el dólar.");
    setError("");
    setGuardando(true);
    const cuerpo = {
      fecha,
      // Sale del mes que estás mirando, aunque lo hayas apartado el 1° del siguiente.
      periodo: mes,
      monto: redondear(n, 2),
      moneda,
      tipo_cambio: moneda === "ARS" ? 1 : redondear(t, 4),
      nota: nota.trim(),
    };
    const r = await enviar(URL, "POST", cuerpo);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    if (r.id) {
      const fila = { id: r.id, created_at: new Date().toISOString(), deleted_at: "", ...cuerpo };
      void actualizarLocal((d) => ({ ...d, ahorros: conFila(d.ahorros ?? [], fila) }));
    } else {
      void recargar();
    }
    cerrar();
    avisar("Ahorro cargado");
  }

  async function borrar(a: Ahorro) {
    const r = await enviar(URL, "DELETE", { id: a.id });
    if (!r.ok) return avisar(r.error);
    void actualizarLocal((d) => ({ ...d, ahorros: sinFila(d.ahorros ?? [], a.id) }));
    avisar("Ahorro borrado", async () => {
      await enviar(URL, "PATCH", { id: a.id, restaurar: true });
      recargar();
    });
  }

  return (
    <Panel
      abierto
      cerrar={cerrar}
      titulo={`Ahorro de ${periodoLargo(mes).split(" ")[0]}`}
      pie={
        <div className="flex flex-col gap-2">
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton type="submit" form={ID_FORM} className="flex-1" disabled={guardando}>
              {guardando ? "Guardando…" : "Ya lo aparté"}
            </Boton>
          </div>
        </div>
      }
    >
      <form id={ID_FORM} onSubmit={guardar} className="flex flex-col gap-4">
        {aviso && <Aviso tipo="info">Revisá: {aviso}</Aviso>}

        <Segmentado
          valor={moneda}
          opciones={[
            { valor: "ARS", label: "Pesos" },
            { valor: "USD", label: "Dólares" },
          ]}
          onCambio={(m) => {
            setMoneda(m);
            if (m === "USD" && !inicial?.monto) setMonto("");
          }}
          className="w-full [&>*]:flex-1 [&>*]:py-2 [&>*]:text-sm"
        />

        <Campo label="¿Cuánto apartaste?">
          <InputPlata
            simbolo={moneda === "USD" ? "US$" : "$"}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            grande
            required
          />
        </Campo>

        {moneda === "USD" && (
          <Campo
            label="1 USD en pesos"
            hint={Number.isFinite(n) && Number.isFinite(t) && n > 0 && t > 0 ? `Son ${plata(n * t)}.` : undefined}
          >
            <InputPlata value={tc} onChange={(e) => setTc(e.target.value)} decimales={4} placeholder="0" required />
          </Campo>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-suave">¿Dónde? (opcional)</span>
          <div className="flex flex-wrap gap-1.5">
            {DESTINOS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={nota === d}
                onClick={() => setNota(nota === d ? "" : d)}
                className={`min-h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
                  nota === d ? "border-acento bg-acento text-white" : "border-borde bg-papel hover:bg-fondo"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <Input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Otro" />
        </div>

        <Campo label="Fecha">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </Campo>

        {ahorros.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-linea pt-3">
            <span className="text-xs font-medium text-suave">Ya apartaste este mes</span>
            <ul className="divide-y divide-linea">
              {ahorros.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="tabular text-sm font-semibold">{enMoneda(a.monto, a.moneda)}</p>
                    <p className="truncate text-[11px] text-tenue">
                      {fechaDia(a.fecha)}
                      {a.nota && ` · ${a.nota}`}
                    </p>
                  </div>
                  <Boton variante="peligro" tamano="sm" onClick={() => borrar(a)}>
                    Borrar
                  </Boton>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Panel>
  );
}
