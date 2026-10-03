"use client";

import { useState, type FormEvent } from "react";
import { ElegirCategoria } from "@/components/Categorias";
import { avisar } from "@/components/Toast";
import {
  Aviso, Boton, Campo, Input, InputPct, InputPlata, Interruptor, Panel, Segmentado,
} from "@/components/ui";
import { aCampo, aNumero, redondear } from "@/lib/format";
import type { SugerenciaFijo } from "@/lib/finanzas";
import type { Categoria, GastoFijo, QuienPago } from "@/lib/types";
import { actualizarLocal, conFila, enviar, sinFila } from "@/lib/useData";

// Un gasto que se repite todos los meses. Si el monto es siempre el mismo se
// carga solo el día que toca; si varía (la luz), la app pide confirmarlo.

const ID_FORM = "form-fijo";
const URL = "/api/gastos-fijos";

export function FormFijo({
  cerrar,
  fijo,
  sugerencia,
  categorias,
  puedeCompartir,
  pareja,
  miPctDefault,
  recargar,
}: {
  cerrar: () => void;
  fijo?: GastoFijo;
  /** Uno que parecía fijo: arranca con lo que se vio en el historial. */
  sugerencia?: SugerenciaFijo;
  categorias: Categoria[];
  puedeCompartir: boolean;
  pareja: string;
  miPctDefault: number;
  recargar: () => Promise<unknown>;
}) {
  const base = fijo ?? sugerencia;
  const [descripcion, setDescripcion] = useState(base?.descripcion ?? "");
  const [monto, setMonto] = useState(base ? aCampo(base.monto) : "");
  const [dia, setDia] = useState(String(base?.dia ?? 1));
  const [categoria, setCategoria] = useState(base?.categoria_id ?? "");
  const [automatico, setAutomatico] = useState(fijo?.automatico ?? true);
  const [compartido, setCompartido] = useState(base?.compartido ?? false);
  const [pago, setPago] = useState<QuienPago>(fijo?.pago ?? "yo");
  const [miPct, setMiPct] = useState(String(fijo?.mi_pct ?? miPctDefault));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    const n = aNumero(monto);
    const d = Number(dia);
    const p = aNumero(miPct);
    if (!descripcion.trim()) return setError("Contá qué es.");
    if (!Number.isFinite(n) || n <= 0) return setError(automatico ? "Poné el monto." : "Poné un monto aproximado.");
    if (!Number.isInteger(d) || d < 1 || d > 31) return setError("El día va del 1 al 31.");
    if (compartido && (!Number.isFinite(p) || p < 0 || p > 100)) return setError("Tu parte va de 0 a 100%.");
    setError("");
    setGuardando(true);
    const cuerpo = {
      descripcion: descripcion.trim(),
      monto: redondear(n, 2),
      categoria_id: categoria,
      dia: d,
      compartido,
      pago,
      mi_pct: compartido ? redondear(p, 2) : 100,
      automatico,
    };
    const r = fijo ? await enviar(URL, "PATCH", { ...cuerpo, id: fijo.id }) : await enviar(URL, "POST", cuerpo);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    const id = fijo?.id ?? r.id;
    if (id) {
      const fila: GastoFijo = { id, created_at: fijo?.created_at ?? new Date().toISOString(), deleted_at: "", ...cuerpo };
      void actualizarLocal((x) => ({ ...x, gastosFijos: conFila(x.gastosFijos ?? [], fila) }));
    } else void recargar();
    cerrar();
    avisar(fijo ? "Cambios guardados" : "Listo: se repite todos los meses");
  }

  async function borrar() {
    if (!fijo) return;
    const r = await enviar(URL, "DELETE", { id: fijo.id });
    if (!r.ok) return setError(r.error);
    void actualizarLocal((x) => ({ ...x, gastosFijos: sinFila(x.gastosFijos ?? [], fijo.id) }));
    cerrar();
    avisar("Ya no se repite", async () => {
      await enviar(URL, "PATCH", { id: fijo.id, restaurar: true });
      recargar();
    });
  }

  return (
    <Panel
      abierto
      cerrar={cerrar}
      titulo={fijo ? "Gasto fijo" : "Nuevo gasto fijo"}
      pie={
        <div className="flex flex-col gap-2">
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="flex gap-2">
            {fijo ? (
              <Boton variante="peligro" onClick={borrar} disabled={guardando}>
                Quitar
              </Boton>
            ) : (
              <Boton variante="secundario" onClick={cerrar} disabled={guardando}>
                Cancelar
              </Boton>
            )}
            <Boton type="submit" form={ID_FORM} className="flex-1" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
          </div>
        </div>
      }
    >
      <form id={ID_FORM} onSubmit={guardar} className="flex flex-col gap-4">
        <Campo label="Qué es">
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Netflix, alquiler, luz" maxLength={80} />
        </Campo>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Campo label={automatico ? "Monto" : "Monto aproximado"}>
            <InputPlata value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
          </Campo>
          <Campo label="Día">
            <Input inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </Campo>
        </div>
        <Interruptor
          activo={automatico}
          onCambio={setAutomatico}
          detalle={automatico ? "Se carga solo ese día." : "Te avisa para que confirmes el monto."}
        >
          Siempre el mismo monto
        </Interruptor>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-suave">Categoría</span>
          <ElegirCategoria categorias={categorias} valor={categoria} onCambio={setCategoria} alCrear={recargar} />
        </div>
        {(puedeCompartir || compartido) && (
          <div className="flex flex-col gap-3 border-t border-linea pt-3">
            <Interruptor activo={compartido} onCambio={setCompartido}>
              Compartido con {pareja || "tu pareja"}
            </Interruptor>
            {compartido && (
              <div className="grid grid-cols-[1fr_6rem] items-end gap-3">
                <Segmentado
                  valor={pago}
                  opciones={[
                    { valor: "yo", label: "Pagás vos" },
                    { valor: "pareja", label: `Paga ${pareja || "tu pareja"}` },
                  ]}
                  onCambio={setPago}
                  className="w-full [&>*]:flex-1"
                />
                <InputPct value={miPct} onChange={(e) => setMiPct(e.target.value)} aria-label="Tu parte en porcentaje" />
              </div>
            )}
          </div>
        )}
      </form>
    </Panel>
  );
}
