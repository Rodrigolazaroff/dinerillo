"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Aviso, Boton, Campo, Input, InputPct, InputPlata, Panel, Segmentado, Select, Textarea,
} from "@/components/ui";
import { alquilerDeCuota } from "@/lib/calc";
import { hoyISO, periodoCorto, plata, redondear, sumarMeses } from "@/lib/format";
import { AJUSTES } from "@/lib/schemas";
import type { AjusteTipo, CondicionesDefault, Contrato, Propiedad } from "@/lib/types";
import { enviar } from "@/lib/useData";

/**
 * Texto a número con las comas y los puntos de acá.
 *
 * Importa porque el server usa `z.coerce.number()`: si le llegara "600.000"
 * tal cual lo escribís, lo leería como seiscientos. Así que la conversión se
 * hace en el cliente y viaja un número limpio.
 */
export function aNumero(valor: string): number {
  const s = String(valor ?? "").replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  let limpio: string;
  if (s.includes(",")) {
    // Con coma no hay duda: la coma es el decimal y los puntos son miles.
    limpio = s.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = s.split(".");
    // "600.000" son seiscientos mil, pero "15.5" son quince y medio.
    const sonMiles = partes.length > 1 && partes.slice(1).every((p) => p.length === 3);
    limpio = sonMiles ? partes.join("") : s;
  }
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

const LABEL_AJUSTE: Record<AjusteTipo, string> = {
  porcentaje: "Por porcentaje",
  ninguno: "Sin aumentos",
};

const OPCIONES_AJUSTE = AJUSTES.map((v) => ({ valor: v, label: LABEL_AJUSTE[v] }));

const FORM_ID = "form-contrato";

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

type Campos = {
  propiedad_id: string;
  inquilino: string;
  telefono: string;
  email: string;
  fecha_inicio: string;
  meses: string;
  alquiler_inicial: string;
  ajuste_tipo: AjusteTipo;
  aumento_pct: string;
  aumento_meses: string;
  comision_pct: string;
  dia_vencimiento: string;
  mora_pct_diario: string;
  prorrateo_pct: string;
  deposito: string;
  nota: string;
};

function inicial(
  contrato: Contrato | undefined,
  cond: CondicionesDefault,
  propiedades: Propiedad[]
): Campos {
  if (contrato) {
    return {
      propiedad_id: contrato.propiedad_id,
      inquilino: contrato.inquilino,
      telefono: contrato.telefono,
      email: contrato.email,
      fecha_inicio: contrato.fecha_inicio,
      meses: String(contrato.meses),
      alquiler_inicial: String(contrato.alquiler_inicial),
      ajuste_tipo: contrato.ajuste_tipo,
      aumento_pct: String(contrato.aumento_pct),
      aumento_meses: String(contrato.aumento_meses),
      comision_pct: String(contrato.comision_pct),
      dia_vencimiento: String(contrato.dia_vencimiento),
      mora_pct_diario: String(contrato.mora_pct_diario),
      prorrateo_pct: String(contrato.prorrateo_pct),
      deposito: String(contrato.deposito),
      nota: contrato.nota,
    };
  }
  return {
    // Con una sola propiedad no tiene sentido hacerla elegir.
    propiedad_id: propiedades.length === 1 ? propiedades[0].id : "",
    inquilino: "",
    telefono: "",
    email: "",
    // Un contrato se firma antes de que empiece: arranca el mes que viene.
    fecha_inicio: `${sumarMeses(hoyISO().slice(0, 7), 1)}-01`,
    meses: String(cond.meses),
    alquiler_inicial: "",
    ajuste_tipo: "porcentaje",
    aumento_pct: String(cond.aumento_pct),
    aumento_meses: String(cond.aumento_meses),
    comision_pct: String(cond.comision_pct),
    dia_vencimiento: String(cond.dia_vencimiento),
    mora_pct_diario: String(cond.mora_pct_diario),
    prorrateo_pct: String(cond.prorrateo_pct),
    deposito: "",
    nota: "",
  };
}

function Subtitulo({ children }: { children: string }) {
  return (
    <h4 className="mt-2 border-b border-linea pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-tenue">
      {children}
    </h4>
  );
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
export function FormContrato(props: {
  abierto: boolean;
  cerrar: () => void;
  contrato?: Contrato;
  propiedades: Propiedad[];
  condiciones: CondicionesDefault;
  alDeGuardar: () => void;
}) {
  if (!props.abierto) return null;
  return <FormContratoAbierto key={props.contrato?.id ?? "nuevo"} {...props} />;
}

function FormContratoAbierto({
  abierto,
  cerrar,
  contrato,
  propiedades,
  condiciones,
  alDeGuardar,
}: {
  abierto: boolean;
  cerrar: () => void;
  contrato?: Contrato;
  propiedades: Propiedad[];
  condiciones: CondicionesDefault;
  alDeGuardar: () => void;
}) {
  const [campos, setCampos] = useState<Campos>(() => inicial(contrato, condiciones, propiedades));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);


  const set = <K extends keyof Campos>(k: K, v: Campos[K]) =>
    setCampos((c) => ({ ...c, [k]: v }));

  /** El contrato tal como quedaría, para proyectar con la misma función que el server. */
  const armado = useMemo<Contrato>(
    () => ({
      id: contrato?.id ?? "",
      propiedad_id: campos.propiedad_id,
      inquilino: campos.inquilino,
      telefono: campos.telefono,
      email: campos.email,
      fecha_inicio: campos.fecha_inicio,
      meses: Math.round(aNumero(campos.meses)),
      ajuste_tipo: campos.ajuste_tipo,
      alquiler_inicial: aNumero(campos.alquiler_inicial),
      aumento_pct: aNumero(campos.aumento_pct),
      aumento_meses: Math.max(1, Math.round(aNumero(campos.aumento_meses))),
      comision_pct: aNumero(campos.comision_pct),
      mora_pct_diario: aNumero(campos.mora_pct_diario),
      dia_vencimiento: Math.round(aNumero(campos.dia_vencimiento)),
      prorrateo_pct: aNumero(campos.prorrateo_pct),
      deposito: aNumero(campos.deposito),
      nota: campos.nota,
      created_at: contrato?.created_at ?? "",
      deleted_at: "",
    }),
    [campos, contrato]
  );

  /**
   * La escalera antes de firmar. Los meses con el mismo importe se juntan en un
   * renglón: con 15% cada 3 meses, doce cuotas son cuatro escalones, no doce.
   */
  const previa = useMemo(() => {
    const meses = Math.min(Math.max(0, armado.meses), 600);
    if (!meses || armado.alquiler_inicial <= 0 || !ES_FECHA.test(armado.fecha_inicio)) return null;

    const inicio = armado.fecha_inicio.slice(0, 7);
    const tramos: {
      desde: string; hasta: string; meses: number;
      bruto: number; comision: number; neto: number;
    }[] = [];
    let bruto = 0;
    let comision = 0;

    for (let i = 0; i < meses; i++) {
      const periodo = sumarMeses(inicio, i);
      const delMes = alquilerDeCuota(armado, i);
      const comMes = redondear(delMes * (armado.comision_pct / 100));
      bruto += delMes;
      comision += comMes;

      const ultimo = tramos[tramos.length - 1];
      if (ultimo && ultimo.bruto === delMes) {
        ultimo.hasta = periodo;
        ultimo.meses += 1;
      } else {
        tramos.push({
          desde: periodo, hasta: periodo, meses: 1,
          bruto: delMes, comision: comMes, neto: redondear(delMes - comMes),
        });
      }
    }

    return {
      tramos,
      fin: sumarMeses(inicio, meses - 1),
      total: {
        bruto: redondear(bruto),
        comision: redondear(comision),
        neto: redondear(bruto - comision),
      },
    };
  }, [armado]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!armado.propiedad_id) {
      setError("Elegí la propiedad.");
      return;
    }
    if (!armado.inquilino.trim()) {
      setError("Falta el nombre del inquilino.");
      return;
    }
    if (armado.alquiler_inicial <= 0) {
      setError("El alquiler inicial tiene que ser mayor a cero.");
      return;
    }
    if (armado.meses < 1) {
      setError("La duración tiene que ser de un mes o más.");
      return;
    }

    setError("");
    setGuardando(true);
    const body = {
      propiedad_id: armado.propiedad_id,
      inquilino: armado.inquilino.trim(),
      telefono: armado.telefono.trim(),
      email: armado.email.trim(),
      fecha_inicio: armado.fecha_inicio,
      meses: armado.meses,
      ajuste_tipo: armado.ajuste_tipo,
      alquiler_inicial: armado.alquiler_inicial,
      aumento_pct: armado.aumento_pct,
      aumento_meses: armado.aumento_meses,
      comision_pct: armado.comision_pct,
      mora_pct_diario: armado.mora_pct_diario,
      dia_vencimiento: armado.dia_vencimiento,
      prorrateo_pct: armado.prorrateo_pct,
      deposito: armado.deposito,
      nota: armado.nota.trim(),
    };
    const r = await enviar(
      "/api/contratos",
      contrato ? "PATCH" : "POST",
      contrato ? { ...body, id: contrato.id } : body
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
      titulo={contrato ? "Editar contrato" : "Contrato nuevo"}
      pie={
        <div className="flex items-center justify-end gap-2">
          <Boton variante="secundario" className="min-h-11 sm:min-h-9" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" form={FORM_ID} className="min-h-11 sm:min-h-9" disabled={guardando}>
            {guardando ? "Guardando…" : contrato ? "Guardar cambios" : "Crear contrato"}
          </Boton>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={guardar} className="flex flex-col gap-3">
        <Subtitulo>Quién y dónde</Subtitulo>

        <Campo label="Propiedad">
          <Select
            value={campos.propiedad_id}
            onChange={(e) => set("propiedad_id", e.target.value)}
            required
          >
            <option value="">Elegí una…</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo label="Inquilino">
          <Input
            value={campos.inquilino}
            onChange={(e) => set("inquilino", e.target.value)}
            placeholder="Nombre y apellido"
            autoComplete="off"
            required
          />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Teléfono">
            <Input
              type="tel"
              inputMode="tel"
              value={campos.telefono}
              onChange={(e) => set("telefono", e.target.value)}
              placeholder="11 5555 5555"
              autoComplete="off"
            />
          </Campo>
          <Campo label="Email">
            <Input
              type="email"
              value={campos.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="nombre@correo.com"
              autoComplete="off"
            />
          </Campo>
        </div>

        <Subtitulo>El alquiler</Subtitulo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Fecha de inicio">
            <Input
              type="date"
              value={campos.fecha_inicio}
              onChange={(e) => set("fecha_inicio", e.target.value)}
              required
            />
          </Campo>
          <Campo label="Duración" hint="En meses.">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              value={campos.meses}
              onChange={(e) => set("meses", e.target.value)}
              className="tabular"
              required
            />
          </Campo>
        </div>

        <Campo label="Alquiler inicial" hint="Lo que paga el primer mes, antes de comisión.">
          <InputPlata
            value={campos.alquiler_inicial}
            onChange={(e) => set("alquiler_inicial", e.target.value)}
            placeholder="600000"
          />
        </Campo>

        <Subtitulo>Cómo aumenta</Subtitulo>

        <Segmentado<AjusteTipo>
          valor={campos.ajuste_tipo}
          opciones={OPCIONES_AJUSTE}
          onCambio={(v) => set("ajuste_tipo", v)}
        />

        {campos.ajuste_tipo === "porcentaje" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Aumento">
              <InputPct
                value={campos.aumento_pct}
                onChange={(e) => set("aumento_pct", e.target.value)}
                placeholder="15"
              />
            </Campo>
            <Campo label="Cada cuántos meses">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                value={campos.aumento_meses}
                onChange={(e) => set("aumento_meses", e.target.value)}
                className="tabular"
              />
            </Campo>
          </div>
        )}

        <p className="text-[11px] leading-snug text-tenue">
          Esto es una proyección para ver el año entero de una. Si el aumento real termina
          siendo otro, después fijás a mano el importe de cualquier mes y le gana a esto.
        </p>

        <Subtitulo>Lo que te descuentan y lo que cobrás</Subtitulo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Comisión inmobiliaria" hint="Lo que retiene la inmobiliaria antes de transferirte.">
            <InputPct
              value={campos.comision_pct}
              onChange={(e) => set("comision_pct", e.target.value)}
              placeholder="7"
            />
          </Campo>
          <Campo label="Día de vencimiento" hint="De cada mes.">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={campos.dia_vencimiento}
              onChange={(e) => set("dia_vencimiento", e.target.value)}
              className="tabular"
            />
          </Campo>
        </div>

        <Campo label="Mora por día" hint="0 si no cobrás recargo.">
          <InputPct
            value={campos.mora_pct_diario}
            onChange={(e) => set("mora_pct_diario", e.target.value)}
            placeholder="2"
          />
        </Campo>

        <Campo
          label="Servicios que paga este inquilino"
          hint="El agua y el impuesto se cargan una vez y cada contrato se lleva su parte. Con dos inquilinos al 50% cada uno, el total queda cubierto."
        >
          <InputPct
            value={campos.prorrateo_pct}
            onChange={(e) => set("prorrateo_pct", e.target.value)}
            placeholder="50"
          />
        </Campo>

        <Subtitulo>Opcionales</Subtitulo>

        <Campo label="Depósito">
          <InputPlata
            value={campos.deposito}
            onChange={(e) => set("deposito", e.target.value)}
            placeholder="0"
          />
        </Campo>

        <Campo label="Nota">
          <Textarea
            value={campos.nota}
            onChange={(e) => set("nota", e.target.value)}
            placeholder="Garantía, quién firmó, lo que convenga acordarse."
          />
        </Campo>

        {previa && (
          <div className="mt-2 rounded-xl border border-borde bg-fondo">
            <header className="flex items-baseline justify-between gap-3 px-3 py-2">
              <h4 className="text-xs font-semibold">Así queda el contrato</h4>
              <span className="text-[11px] text-tenue">
                hasta {periodoCorto(previa.fin)}
              </span>
            </header>
            <div className="scroll-x border-t border-linea">
              <table className="w-full min-w-[22rem] text-xs">
                <thead>
                  <tr className="text-left text-[11px] text-tenue">
                    <th className="px-3 py-1.5 font-medium">Período</th>
                    <th className="px-2 py-1.5 text-right font-medium">Bruto</th>
                    <th className="px-2 py-1.5 text-right font-medium">Comisión</th>
                    <th className="px-3 py-1.5 text-right font-medium">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.tramos.map((t) => (
                    <tr key={t.desde} className="border-t border-linea">
                      <td className="px-3 py-1.5">
                        {t.desde === t.hasta
                          ? periodoCorto(t.desde)
                          : `${periodoCorto(t.desde)} – ${periodoCorto(t.hasta)}`}
                        <span className="ml-1.5 text-[11px] text-tenue">
                          {t.meses === 1 ? "1 mes" : `${t.meses} meses`}
                        </span>
                      </td>
                      <td className="tabular px-2 py-1.5 text-right">{plata(t.bruto)}</td>
                      <td className="tabular px-2 py-1.5 text-right text-tenue">
                        −{plata(t.comision)}
                      </td>
                      <td className="tabular px-3 py-1.5 text-right font-medium">
                        {plata(t.neto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-borde font-semibold">
                    <td className="px-3 py-2">Todo el contrato</td>
                    <td className="tabular px-2 py-2 text-right">{plata(previa.total.bruto)}</td>
                    <td className="tabular px-2 py-2 text-right text-tenue">
                      −{plata(previa.total.comision)}
                    </td>
                    <td className="tabular px-3 py-2 text-right">{plata(previa.total.neto)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="px-3 pb-2 pt-1 text-[11px] leading-snug text-tenue">
              Los importes de cada mes, sin contar servicios ni recargos por mora.
            </p>
          </div>
        )}

        <Aviso tipo="error">{error}</Aviso>
      </form>
    </Panel>
  );
}
