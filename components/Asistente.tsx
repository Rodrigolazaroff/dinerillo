"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormCobroIngreso } from "@/components/FormCobroIngreso";
import { FormGasto } from "@/components/FormGasto";
import { FormMovimiento } from "@/components/FormMovimiento";
import { avisar } from "@/components/Toast";
import { Boton, Panel, Textarea } from "@/components/ui";
import { enPesos, preferencias } from "@/lib/finanzas";
import { TIPOS_GASTO } from "@/lib/schemas";
import type { TipoGasto } from "@/lib/types";
import { useData } from "@/lib/useData";
import { useMes } from "@/lib/useMes";

// La carga asistida: dictar ("luz 40 mil compartido") o subir una factura, y
// que se abra el formulario ya completo. Nunca guarda solo: la persona revisa
// y toca "Cargar". El archivo viaja al server, se lee y se descarta.
//
// En una pantalla puntual (Gastos, División, Boletas) el destino es el de esa
// pantalla. En el Inicio decide lo que se entendió.

type Modo = "libre" | "gasto" | "compartido" | "boleta";

/** Lo que devuelve /api/ia. Espejo del schema del server. */
interface Interpretacion {
  destino: "gasto" | "compartido" | "boleta" | "cobro_ingreso";
  monto: number | null;
  descripcion: string;
  fecha: string | null;
  periodo: string | null;
  vencimiento: string | null;
  categoria: string | null;
  pago: "yo" | "pareja" | null;
  mi_pct: number | null;
  tipo_boleta: TipoGasto | null;
  ingreso: string | null;
  duda: string | null;
}

/** Si el asistente no contesta en este tiempo, se corta y el botón vuelve. */
const LIMITE_MS = 35_000;
/** Lado más largo de una foto antes de mandarla: alcanza para leer y pesa poco. */
const LADO_MAXIMO = 1600;

// ── el navegador ────────────────────────────────────────────────────

interface Reconocedor {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

function crearReconocedor(): Reconocedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, new () => Reconocedor>;
  const Clase = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Clase ? new Clase() : null;
}

const aBase64 = (blob: Blob) =>
  new Promise<string>((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => mal(new Error("No pude leer el archivo"));
    r.readAsDataURL(blob);
  });

/** Una foto del celular pesa varios MB: se achica a JPEG antes de mandarla. */
async function prepararArchivo(f: File): Promise<{ tipo: string; base64: string }> {
  if (f.type === "application/pdf") {
    if (f.size > 3_000_000) throw new Error("El PDF es muy pesado. Probá con uno de menos de 3 MB.");
    return { tipo: f.type, base64: await aBase64(f) };
  }
  if (!f.type.startsWith("image/")) throw new Error("Subí un PDF o una foto.");
  const img = await createImageBitmap(f);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(img.width * escala);
  lienzo.height = Math.round(img.height * escala);
  lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) throw new Error("No pude leer la foto");
  return { tipo: "image/jpeg", base64: await aBase64(blob) };
}

async function interpretar(
  cuerpo: { texto?: string; archivo?: { tipo: string; base64: string } },
  senal: AbortSignal
): Promise<Interpretacion> {
  const res = await fetch("/api/ia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: senal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "No pude interpretarlo");
  return data.datos as Interpretacion;
}

// ── la pieza ────────────────────────────────────────────────────────

export function Asistente({ modo, className = "" }: { modo: Modo; className?: string }) {
  const { data, recargar } = useData();
  const [mes] = useMes();
  const router = useRouter();
  const archivoRef = useRef<HTMLInputElement>(null);

  const [dictando, setDictando] = useState(false);
  const [pensando, setPensando] = useState<"" | "audio" | "factura">("");
  const [resultado, setResultado] = useState<Interpretacion | null>(null);
  const cancelar = useRef<AbortController | null>(null);

  // Si la pantalla se va mientras espera, se corta el pedido.
  useEffect(() => () => cancelar.current?.abort(), []);

  async function enviar(cuerpo: Parameters<typeof interpretar>[0], tipo: "audio" | "factura") {
    cancelar.current?.abort();
    const ctrl = new AbortController();
    cancelar.current = ctrl;
    // Si se traba, se corta solo y el botón vuelve a quedar disponible.
    const reloj = setTimeout(() => ctrl.abort(), LIMITE_MS);
    setPensando(tipo);
    try {
      const datos = await interpretar(cuerpo, ctrl.signal);
      // Un cobro de ingreso sin saber de qué fuente no se puede precargar.
      const esCobro = modo === "libre" && datos.destino === "cobro_ingreso";
      if (esCobro && !data?.ingresos.some((i) => !i.deleted_at && i.nombre === datos.ingreso)) {
        avisar("No supe de qué ingreso es. Elegilo y cargá el cobro.");
        router.push("/ingresos");
      } else {
        setResultado(datos);
      }
    } catch (e) {
      const cortado = e instanceof DOMException && e.name === "AbortError";
      avisar(cortado ? "Tardó demasiado. Probá de nuevo." : e instanceof Error ? e.message : "No pude interpretarlo");
    } finally {
      clearTimeout(reloj);
      setPensando("");
      if (cancelar.current === ctrl) cancelar.current = null;
    }
  }

  async function alElegirArchivo(f: File | undefined) {
    if (!f) return;
    try {
      enviar({ archivo: await prepararArchivo(f) }, "factura");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No pude leer el archivo");
    }
    if (archivoRef.current) archivoRef.current.value = "";
  }

  // El destino: el de la pantalla, o el que se entendió si es el Inicio.
  const destino = resultado
    ? modo === "libre"
      ? resultado.destino
      : modo === "boleta" ? "boleta" : modo
    : null;

  const categorias = data?.categorias ?? [];
  const prefs = preferencias(data?.config ?? {});
  const idCategoria = (nombre: string | null) =>
    (nombre && categorias.find((c) => !c.deleted_at && c.nombre === nombre)?.id) || "";
  const ingreso =
    resultado?.ingreso
      ? data?.ingresos.find((i) => !i.deleted_at && i.nombre === resultado.ingreso)
      : undefined;
  const cerrar = () => setResultado(null);

  const aviso = resultado?.duda ?? undefined;
  const fecha = resultado?.fecha ?? undefined;
  const ocupado = pensando !== "";

  return (
    <>
      <div className={`flex gap-2 ${className}`}>
        <Boton variante="secundario" onClick={() => setDictando(true)} disabled={ocupado} aria-label="Cargar dictando">
          <IconoMicrofono />
          {pensando === "audio" ? "Entendiendo…" : "Dictar"}
        </Boton>
        <Boton
          variante="secundario"
          onClick={() => archivoRef.current?.click()}
          disabled={ocupado}
          aria-label="Cargar desde una factura"
        >
          <IconoFactura />
          {pensando === "factura" ? "Leyendo…" : "Factura"}
        </Boton>
        <input
          ref={archivoRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => alElegirArchivo(e.target.files?.[0])}
        />
      </div>

      {dictando && (
        <PanelDictado
          cerrar={() => setDictando(false)}
          alListo={(texto) => {
            setDictando(false);
            enviar({ texto }, "audio");
          }}
        />
      )}

      {resultado && (destino === "gasto" || destino === "compartido") && data && (
        <FormMovimiento
          modo={destino === "compartido" ? "compartido" : "propio"}
          abierto
          cerrar={cerrar}
          inicial={{
            monto: resultado.monto ?? undefined,
            descripcion: resultado.descripcion,
            categoria_id: idCategoria(resultado.categoria),
            fecha,
            pago: resultado.pago ?? "yo",
            mi_pct: resultado.mi_pct ?? prefs.divMiPct,
            nota: resultado.vencimiento ? `Vence el ${resultado.vencimiento.split("-").reverse().join("/")}` : "",
          }}
          aviso={aviso}
          mes={mes}
          categorias={categorias}
          pareja={prefs.pareja}
          miPctDefault={prefs.divMiPct}
          recargar={recargar}
        />
      )}

      {resultado && destino === "boleta" && data && (
        <FormGasto
          abierto
          cerrar={cerrar}
          inicial={{
            tipo: resultado.tipo_boleta && (TIPOS_GASTO as readonly string[]).includes(resultado.tipo_boleta)
              ? resultado.tipo_boleta
              : "otro",
            periodo: resultado.periodo ?? mes,
            monto: resultado.monto ?? undefined,
            fecha: fecha ?? "",
          }}
          aviso={aviso}
          propiedades={data.propiedades}
          alDeGuardar={() => {
            recargar();
            cerrar();
            avisar("Boleta cargada");
          }}
        />
      )}

      {resultado && destino === "cobro_ingreso" && ingreso && data && (
        <FormCobroIngreso
          abierto
          cerrar={cerrar}
          ingreso={ingreso}
          inicial={{
            monto: resultado.monto ?? undefined,
            fecha,
            periodo: resultado.periodo ?? undefined,
          }}
          aviso={aviso}
          ultimoTipoCambio={
            ingreso.moneda === "ARS"
              ? null
              : data.ingresoCobros.find((c) => c.ingreso_id === ingreso.id && !c.deleted_at && enPesos(c) > 0)
                  ?.tipo_cambio ?? null
          }
          mes={mes}
          recargar={recargar}
        />
      )}
    </>
  );
}

// ── dictado ─────────────────────────────────────────────────────────

function PanelDictado({ cerrar, alListo }: { cerrar: () => void; alListo: (texto: string) => void }) {
  const [texto, setTexto] = useState("");
  const [escuchando, setEscuchando] = useState(false);
  const [sinVoz] = useState(() => crearReconocedor() === null);
  const rec = useRef<Reconocedor | null>(null);
  const base = useRef("");

  function escuchar() {
    const r = crearReconocedor();
    if (!r) return;
    rec.current = r;
    base.current = texto ? `${texto} ` : "";
    r.lang = "es-AR";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let dicho = "";
      for (let i = 0; i < e.results.length; i++) dicho += e.results[i][0].transcript;
      setTexto(base.current + dicho);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") avisar("Dale permiso al micrófono para dictar.");
      setEscuchando(false);
    };
    // El estado cambia cuando el navegador confirma, no antes: si no hay
    // permiso de micrófono, nunca dice "te escucho".
    r.onstart = () => setEscuchando(true);
    r.onend = () => setEscuchando(false);
    r.start();
  }

  function parar() {
    rec.current?.stop();
    setEscuchando(false);
  }

  // Al abrir, arranca a escuchar: es lo que la persona fue a hacer.
  useEffect(() => {
    if (!sinVoz) escuchar();
    return () => rec.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Panel
      abierto
      cerrar={cerrar}
      titulo="Dictá lo que querés cargar"
      pie={
        <div className="flex gap-2">
          <Boton variante="secundario" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton className="flex-1" onClick={() => alListo(texto.trim())} disabled={!texto.trim()}>
            Listo
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4">
        {!sinVoz && (
          <button
            type="button"
            onClick={escuchando ? parar : escuchar}
            aria-label={escuchando ? "Dejar de escuchar" : "Escuchar"}
            className={`flex h-20 w-20 items-center justify-center rounded-full text-white transition-transform active:scale-95 ${
              escuchando ? "animate-pulse bg-peligro" : "bg-acento"
            }`}
          >
            <IconoMicrofono className="h-8 w-8" />
          </button>
        )}
        <p className="text-center text-xs text-suave">
          {sinVoz
            ? "Este navegador no reconoce la voz: escribilo como lo dirías."
            : escuchando
              ? "Te escucho…"
              : "Tocá el micrófono para seguir, o corregí el texto."}
        </p>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej: luz 40 mil compartido · almuerzo 12.500 · ayer el super 85 lucas, lo pagó Nahi"
          className="w-full"
          maxLength={2000}
        />
      </div>
    </Panel>
  );
}

function IconoMicrofono({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" strokeLinecap="round" />
    </svg>
  );
}

function IconoFactura({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" strokeLinejoin="round" />
      <path d="M9 8.5h6M9 12h6" strokeLinecap="round" />
    </svg>
  );
}
