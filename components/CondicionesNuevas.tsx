"use client";

import { useState } from "react";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, Campo, Input, InputPct } from "@/components/ui";
import { aNumero } from "@/lib/format";
import { CONDICIONES_FABRICA } from "@/lib/schemas";
import type { CondicionesDefault } from "@/lib/types";
import { enviar } from "@/lib/useData";

// Con qué arranca el formulario de un contrato nuevo. Vive en Contratos, que
// es donde se usa: no cambia ningún contrato ya cargado.

type Condiciones = Record<keyof CondicionesDefault, string>;

const aTexto = (c: CondicionesDefault): Condiciones =>
  Object.fromEntries(Object.entries(c).map(([k, v]) => [k, String(v).replace(".", ",")])) as Condiciones;

/** Los campos, en el orden en que se leen. */
const CAMPOS: { clave: keyof CondicionesDefault; label: string; pct?: boolean }[] = [
  { clave: "aumento_pct", label: "Aumento", pct: true },
  { clave: "aumento_meses", label: "Cada cuántos meses" },
  { clave: "meses", label: "Duración (meses)" },
  { clave: "comision_pct", label: "Comisión", pct: true },
  { clave: "dia_vencimiento", label: "Vence el día" },
  { clave: "mora_pct_diario", label: "Mora por día", pct: true },
  { clave: "prorrateo_pct", label: "Parte de los servicios", pct: true },
];

export function CondicionesNuevas({
  condiciones,
  recargar,
}: {
  condiciones: CondicionesDefault;
  recargar: () => Promise<unknown>;
}) {
  // El borrador solo existe mientras editás: espejar la respuesta de SWR en
  // estado te borraría lo que estás tipeando en cuanto revalida.
  const [borrador, setBorrador] = useState<Condiciones | null>(null);
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);
  const cond = borrador ?? aTexto(condiciones);

  async function guardar() {
    const valores = Object.fromEntries(CAMPOS.map(({ clave }) => [clave, aNumero(cond[clave])]));
    if (Object.values(valores).some((v) => !Number.isFinite(v) || v < 0)) return setErr("Revisá los números.");
    setErr("");
    setGuardando(true);
    const r = await enviar(
      "/api/config",
      "POST",
      Object.fromEntries(Object.entries(valores).map(([k, v]) => [`def_${k}`, String(v)]))
    );
    setGuardando(false);
    if (!r.ok) return setErr(r.error);
    setBorrador(null);
    avisar("Guardado");
    void recargar();
  }

  return (
    <details className="rounded-2xl border border-borde bg-papel">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-medium text-suave sm:px-5">
        Valores para contratos nuevos
      </summary>
      <div className="border-t border-borde">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-3 sm:px-5">
          {CAMPOS.map(({ clave, label, pct }) => (
            <Campo key={clave} label={label}>
              {pct ? (
                <InputPct value={cond[clave]} onChange={(e) => setBorrador({ ...cond, [clave]: e.target.value })} />
              ) : (
                <Input
                  inputMode="numeric"
                  value={cond[clave]}
                  onChange={(e) => setBorrador({ ...cond, [clave]: e.target.value.replace(/\D/g, "") })}
                />
              )}
            </Campo>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-borde px-4 py-3 sm:px-5">
          <Aviso tipo="error">{err}</Aviso>
          <div className="flex gap-2">
            <Boton onClick={guardar} disabled={guardando || !borrador} className="flex-1 sm:flex-none">
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
            <Boton variante="secundario" onClick={() => setBorrador(aTexto({ ...CONDICIONES_FABRICA }))}>
              Valores de fábrica
            </Boton>
          </div>
        </div>
      </div>
    </details>
  );
}
