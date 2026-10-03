"use client";

import { useState, type FormEvent } from "react";
import { ElegirCategoria } from "@/components/Categorias";
import { aCampo, aNumero } from "@/components/FormGasto";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, Campo, Input, InputPct, InputPlata, Panel, Segmentado } from "@/components/ui";
import { hoyISO, periodoActual, plata, redondear } from "@/lib/format";
import type { Categoria, DivGasto, MiGasto, QuienPago } from "@/lib/types";
import { enviar } from "@/lib/useData";

// Un solo formulario para los dos tipos de gasto: el tuyo y el compartido.
// Lo que cambia en el compartido es quién pagó y qué parte es tuya.
//
// El orden es el de la caja del súper: primero el monto, después en qué fue.
// La fecha arranca en hoy y la categoría en la última que usaste.

const ID_FORM = "form-movimiento";
const CLAVE_ULTIMA = "dinerillo:ultima-categoria";

type Modo = "propio" | "compartido";

const PARTES = [
  { pct: 50, label: "Mitad" },
  { pct: 100, label: "Todo mío" },
  { pct: 0, label: "Todo suyo" },
];

function ultimaCategoria(): string {
  try {
    return localStorage.getItem(CLAVE_ULTIMA) ?? "";
  } catch {
    return "";
  }
}

export function FormMovimiento({
  modo,
  abierto,
  cerrar,
  gasto,
  inicial,
  aviso,
  mes,
  categorias,
  pareja,
  miPctDefault,
  recargar,
}: {
  modo: Modo;
  abierto: boolean;
  cerrar: () => void;
  gasto?: MiGasto | DivGasto;
  /** Precarga de un gasto nuevo (la carga asistida). */
  inicial?: Partial<Pick<DivGasto, "monto" | "descripcion" | "categoria_id" | "fecha" | "pago" | "mi_pct" | "nota">>;
  /** Algo para revisar antes de guardar, arriba de todo. */
  aviso?: string;
  mes: string;
  categorias: Categoria[];
  pareja: string;
  miPctDefault: number;
  recargar: () => Promise<unknown>;
}) {
  const compartido = modo === "compartido";
  const div = gasto as DivGasto | undefined;
  const nombrePareja = pareja || "Tu pareja";

  const [monto, setMonto] = useState(
    gasto ? aCampo(gasto.monto) : inicial?.monto ? aCampo(inicial.monto) : ""
  );
  const [descripcion, setDescripcion] = useState(gasto?.descripcion ?? inicial?.descripcion ?? "");
  const [categoria, setCategoria] = useState(() => {
    if (gasto) return gasto.categoria_id;
    if (inicial?.categoria_id) return inicial.categoria_id;
    const u = ultimaCategoria();
    return categorias.some((c) => c.id === u && !c.deleted_at) ? u : "";
  });
  const [fecha, setFecha] = useState(
    gasto?.fecha ?? inicial?.fecha ?? (mes === periodoActual() ? hoyISO() : `${mes}-01`)
  );
  const [pago, setPago] = useState<QuienPago>(div?.pago ?? inicial?.pago ?? "yo");
  const [miPct, setMiPct] = useState(String(div?.mi_pct ?? inicial?.mi_pct ?? miPctDefault));
  const [nota, setNota] = useState(gasto?.nota ?? inicial?.nota ?? "");
  const [conNota, setConNota] = useState(Boolean(gasto?.nota || inicial?.nota));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const n = aNumero(monto);
  const pct = Number(miPct.replace(",", "."));
  const pctValido = Number.isFinite(pct) && pct >= 0 && pct <= 100;
  const url = compartido ? "/api/division" : "/api/mis-gastos";

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    if (!Number.isFinite(n) || n <= 0) return setError("Poné el importe.");
    if (!descripcion.trim()) return setError("Contá en qué fue.");
    if (compartido && !pctValido) return setError("Tu parte va de 0 a 100%.");
    setError("");
    setGuardando(true);
    const cuerpo = {
      fecha,
      periodo: fecha.slice(0, 7),
      descripcion: descripcion.trim(),
      monto: redondear(n, 2),
      categoria_id: categoria,
      nota: nota.trim(),
      ...(compartido ? { pago, mi_pct: redondear(pct, 2) } : {}),
    };
    const r = gasto
      ? await enviar(url, "PATCH", { ...cuerpo, id: gasto.id })
      : await enviar(url, "POST", cuerpo);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    try {
      if (categoria) localStorage.setItem(CLAVE_ULTIMA, categoria);
    } catch {
      // no pasa nada
    }
    await recargar();
    cerrar();
    avisar(gasto ? "Cambios guardados" : compartido ? "Gasto compartido cargado" : "Gasto cargado");
  }

  async function borrar() {
    if (!gasto) return;
    setGuardando(true);
    const r = await enviar(url, "DELETE", { id: gasto.id });
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    await recargar();
    cerrar();
    avisar("Gasto borrado", async () => {
      await enviar(url, "PATCH", { id: gasto.id, restaurar: true });
      recargar();
    });
  }

  const titulo = gasto
    ? "Editar gasto"
    : compartido
      ? "Gasto compartido"
      : "Nuevo gasto";

  return (
    <Panel
      abierto={abierto}
      cerrar={cerrar}
      titulo={titulo}
      pie={
        <div className="flex flex-col gap-2">
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="flex gap-2">
            {gasto ? (
              <Boton variante="peligro" onClick={borrar} disabled={guardando}>
                Borrar
              </Boton>
            ) : (
              <Boton variante="secundario" onClick={cerrar} disabled={guardando}>
                Cancelar
              </Boton>
            )}
            <Boton type="submit" form={ID_FORM} className="flex-1" disabled={guardando}>
              {guardando ? "Guardando…" : gasto ? "Guardar cambios" : "Cargar"}
            </Boton>
          </div>
        </div>
      }
    >
      <form id={ID_FORM} onSubmit={guardar} className="flex flex-col gap-4">
        {aviso && <Aviso tipo="info">Revisá: {aviso}</Aviso>}
        <Campo label="Importe">
          <InputPlata
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            autoFocus={!gasto}
            className="py-3 text-2xl font-semibold sm:py-2.5 sm:text-2xl"
            required
          />
        </Campo>

        <Campo label="En qué fue">
          <Input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={compartido ? "Ej: Super del finde" : "Ej: Almuerzo"}
            maxLength={80}
            required
          />
        </Campo>

        {compartido && (
          <div className="flex flex-col gap-3 rounded-xl border border-borde bg-fondo/60 p-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-suave">¿Quién pagó?</span>
              <Segmentado
                valor={pago}
                opciones={[
                  { valor: "yo", label: "Yo" },
                  { valor: "pareja", label: nombrePareja },
                ]}
                onCambio={setPago}
                className="w-full [&>*]:flex-1"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-suave">¿Cuánto es tuyo?</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {PARTES.map((p) => (
                  <button
                    key={p.pct}
                    type="button"
                    onClick={() => setMiPct(String(p.pct))}
                    className={`min-h-[36px] rounded-full border px-3 text-xs font-medium transition-colors ${
                      pct === p.pct ? "border-acento bg-acento text-white" : "border-borde bg-papel hover:bg-fondo"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <div className="w-24">
                  <InputPct value={miPct} onChange={(e) => setMiPct(e.target.value)} aria-label="Tu parte en porcentaje" />
                </div>
              </div>
              {Number.isFinite(n) && n > 0 && pctValido && (
                <p className="tabular text-[11px] text-suave">
                  Tu parte {plata((n * pct) / 100)} · {nombrePareja} {plata((n * (100 - pct)) / 100)}
                  {pago === "yo" && pct < 100 && ` · te debe ${plata((n * (100 - pct)) / 100)}`}
                  {pago === "pareja" && pct > 0 && ` · le debés ${plata((n * pct) / 100)}`}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-suave">Categoría</span>
          <ElegirCategoria categorias={categorias} valor={categoria} onCambio={setCategoria} alCrear={recargar} />
        </div>

        <Campo label="Fecha">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </Campo>

        {conNota ? (
          <Campo label="Nota">
            <Input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} />
          </Campo>
        ) : (
          <button type="button" onClick={() => setConNota(true)} className="self-start text-xs font-medium text-acento">
            + Agregar una nota
          </button>
        )}
      </form>
    </Panel>
  );
}
