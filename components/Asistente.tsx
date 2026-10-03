"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Emoji } from "@/components/Emoji";
import { FormCobroIngreso } from "@/components/FormCobroIngreso";
import { ETIQUETA_GASTO, FormGasto } from "@/components/FormGasto";
import { FormMovimiento } from "@/components/FormMovimiento";
import { PanelAhorro } from "@/components/PanelAhorro";
import { avisar } from "@/components/Toast";
import { Boton, Panel, Textarea } from "@/components/ui";
import { enPesos, preferencias } from "@/lib/finanzas";
import { TIPOS_GASTO } from "@/lib/schemas";
import { emojiDe, sugerirEmoji } from "@/lib/emoji";
import type { Ingreso, TipoGasto } from "@/lib/types";
import { useData, usaAlquileres, usaDivision } from "@/lib/useData";
import { useMes } from "@/lib/useMes";

// La carga asistida: dictar ("luz 40 mil compartido") o subir una factura, y
// que se abra el formulario ya completo. Nunca guarda solo: la persona revisa
// y toca "Cargar". El archivo viaja al server, se lee y se descarta.
//
// En una pantalla puntual (Gastos, División, Boletas, Ingresos) el destino es
// el de esa pantalla. En el Inicio decide lo que se entendió: un gasto, un
// cobro ("cobré el sueldo") o un ahorro ("aparté 200 dólares").

type Modo = "libre" | "gasto" | "compartido" | "boleta" | "ingreso";

/** Lo que devuelve /api/ia. Espejo del schema del server. */
interface Interpretacion {
  destino: "gasto" | "compartido" | "boleta" | "cobro_ingreso" | "ahorro";
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
  /** Cómo llamó al ingreso, aunque todavía no exista ("Sueldo"). */
  nombre_ingreso: string | null;
  moneda: "ARS" | "USD" | null;
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
    // Un PDF largo son muchos tokens: una factura entra holgada en 2 MB.
    if (f.size > 2_000_000) throw new Error("El PDF es muy pesado. Probá con uno de menos de 2 MB o con una foto.");
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
  cuerpo: { texto?: string; archivo?: { tipo: string; base64: string }; pantalla?: Modo },
  senal: AbortSignal
): Promise<Interpretacion> {
  const res = await fetch("/api/ia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: senal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "No lo entendí. Probá de nuevo.");
  return data.datos as Interpretacion;
}

// ── la pieza ────────────────────────────────────────────────────────

/**
 * Una tarjetita de acción con su emoji 3D: los atajos del Inicio. Exportada
 * para que la pantalla sume los suyos ("+ Gasto") con el mismo formato.
 */
export function Atajo({
  emoji,
  children,
  onClick,
  disabled,
  etiqueta,
  suave = false,
}: {
  emoji: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  etiqueta?: string;
  /** Las formas de cargar (dictar, factura) se ven distintas de lo que se carga. */
  suave?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      className={`flex flex-col items-center gap-1.5 rounded-2xl px-1 pb-2.5 pt-3 text-xs font-semibold text-tinta transition-[transform,background-color,box-shadow] duration-150 ease-[var(--ease-quart)] active:scale-[0.95] disabled:opacity-60 ${
        suave
          ? "bg-celeste-claro hover:bg-celeste/50"
          : "bg-papel ring-1 ring-borde hover:bg-celeste-claro hover:ring-celeste"
      }`}
    >
      <Emoji nombre={emoji} tamano="lg" className="transition-transform duration-200 ease-[var(--ease-quart)] [button:hover>&]:-rotate-6 [button:hover>&]:scale-110" />
      {children}
    </button>
  );
}

export function Asistente({
  modo,
  className = "",
  variante = "botones",
  antes,
}: {
  modo: Modo;
  className?: string;
  /** "atajos": tarjetitas con emoji, en grilla (el Inicio). */
  variante?: "botones" | "atajos";
  /** Atajos propios de la pantalla, que van antes de Dictar y Factura. */
  antes?: ReactNode;
}) {
  const { data, recargar } = useData();
  const [mes] = useMes();
  const archivoRef = useRef<HTMLInputElement>(null);

  const [dictando, setDictando] = useState(false);
  const [pensando, setPensando] = useState<"" | "audio" | "factura">("");
  const [resultado, setResultado] = useState<Interpretacion | null>(null);
  // Un cobro dictado de un ingreso que no se reconoció: lo elige la persona.
  const [elegido, setElegido] = useState<Ingreso | null>(null);
  const [creando, setCreando] = useState(false);
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
      const datos = await interpretar({ ...cuerpo, pantalla: modo }, ctrl.signal);
      setElegido(null);
      setResultado(datos);
    } catch (e) {
      const cortado = e instanceof DOMException && e.name === "AbortError";
      avisar(cortado ? "Tardó demasiado. Probá de nuevo." : e instanceof Error ? e.message : "No lo entendí. Probá de nuevo.");
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

  // El destino: el de la pantalla, o el que se entendió si es el Inicio. Lo
  // que la persona no usa (dividir, alquileres) cae en un gasto común.
  const divide = data ? usaDivision(data) : true;
  const conAlquileres = data ? usaAlquileres(data) : false;
  // En Gastos o División, si dijo "compartido" (o al revés) se le hace caso:
  // el formulario muestra arriba a cuál va y se cambia de un toque.
  const mioOCompartido = (d: string) => d === "gasto" || d === "compartido";
  const entendido = resultado
    ? modo === "libre" || (mioOCompartido(modo) && mioOCompartido(resultado.destino))
      ? resultado.destino
      : modo === "ingreso"
        ? "cobro_ingreso"
        : modo
    : null;
  const destino =
    (entendido === "compartido" && !divide) || (entendido === "boleta" && modo === "libre" && !conAlquileres)
      ? "gasto"
      : entendido;
  // Una boleta que terminó como gasto se describe por su tipo: "Luz", "Agua".
  const descripcionDe = (r: Interpretacion) =>
    r.descripcion || (r.tipo_boleta ? ETIQUETA_GASTO[r.tipo_boleta] : "");

  const categorias = data?.categorias ?? [];
  const prefs = preferencias(data?.config ?? {});
  const idCategoria = (nombre: string | null) =>
    (nombre && categorias.find((c) => !c.deleted_at && c.nombre === nombre)?.id) || "";
  const activos = (data?.ingresos ?? []).filter((i) => !i.deleted_at && !i.archivado_at);
  const ingreso =
    elegido ??
    (resultado?.ingreso ? activos.find((i) => i.nombre === resultado.ingreso) : undefined);
  const cerrar = () => {
    setResultado(null);
    setElegido(null);
  };

  /** "Cobré el sueldo" sin un ingreso Sueldo: se crea ahí mismo, en su moneda. */
  async function crearIngreso(nombre: string) {
    if (creando) return;
    setCreando(true);
    const moneda = resultado?.moneda === "USD" ? "USD" : "ARS";
    const emoji = sugerirEmoji(nombre, "bolsa-plata");
    try {
      const res = await fetch("/api/ingresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, moneda, emoji, orden: activos.length }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok || !r.id) return avisar(r.error ?? "No pude crear el ingreso");
      setElegido({
        id: r.id, nombre, moneda, emoji, nota: "", orden: activos.length,
        archivado_at: "", created_at: "", deleted_at: "",
      });
      void recargar();
    } catch {
      avisar("No hay conexión. Probá de nuevo.");
    } finally {
      setCreando(false);
    }
  }

  const aviso = resultado?.duda ?? undefined;
  const fecha = resultado?.fecha ?? undefined;
  const ocupado = pensando !== "";

  return (
    <>
      {variante === "atajos" ? (
        <div className={`grid auto-cols-fr grid-flow-col gap-2 ${className}`}>
          {antes}
          <Atajo emoji="microfono" onClick={() => setDictando(true)} disabled={ocupado} etiqueta="Cargar dictando" suave>
            {pensando === "audio" ? "Entendiendo…" : "Dictar"}
          </Atajo>
          <Atajo emoji="recibo" onClick={() => archivoRef.current?.click()} disabled={ocupado} etiqueta="Cargar desde una factura" suave>
            {pensando === "factura" ? "Leyendo…" : "Factura"}
          </Atajo>
        </div>
      ) : (
      <div className={`flex gap-2 ${className}`}>
        <Boton variante="secundario" onClick={() => setDictando(true)} disabled={ocupado} aria-label="Cargar dictando">
          <Emoji nombre="microfono" tamano="sm" />
          {pensando === "audio" ? "Entendiendo…" : "Dictar"}
        </Boton>
        <Boton
          variante="secundario"
          onClick={() => archivoRef.current?.click()}
          disabled={ocupado}
          aria-label="Cargar desde una factura"
        >
          <Emoji nombre="recibo" tamano="sm" />
          {pensando === "factura" ? "Leyendo…" : "Factura"}
        </Boton>
      </div>
      )}
      <input
        ref={archivoRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => alElegirArchivo(e.target.files?.[0])}
      />

      {dictando && (
        <PanelDictado
          ejemplo={`Ej: ayer el súper 85 lucas${divide && prefs.pareja ? `, lo pagó ${prefs.pareja}` : ""}`}
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
          puedeCompartir={divide}
          abierto
          cerrar={cerrar}
          inicial={{
            monto: resultado.monto ?? undefined,
            descripcion: descripcionDe(resultado),
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

      {resultado && destino === "cobro_ingreso" && !ingreso && data && (
        <Panel abierto cerrar={cerrar} titulo="¿De qué ingreso?">
          <div className="flex flex-col gap-2">
            {resultado.monto && (
              <p className="text-sm text-suave">
                Entendí <span className="tabular font-semibold text-tinta">{resultado.monto.toLocaleString("es-AR")}</span>
                {resultado.moneda === "USD" ? " dólares" : " pesos"}.
              </p>
            )}
            {activos.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setElegido(i)}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-borde px-3 text-left text-sm font-medium transition-colors hover:bg-celeste-claro"
              >
                <Emoji nombre={emojiDe(i.emoji, i.nombre, "bolsa-plata")} tamano="md" />
                <span className="flex-1">{i.nombre}</span>
                <span className="text-xs text-tenue">{i.moneda === "ARS" ? "$" : i.moneda}</span>
              </button>
            ))}
            {resultado.nombre_ingreso &&
              !activos.some((i) => i.nombre.toLowerCase() === resultado.nombre_ingreso!.toLowerCase()) && (
                <Boton
                  className="min-h-12"
                  disabled={creando}
                  onClick={() => crearIngreso(resultado.nombre_ingreso!)}
                >
                  {creando ? "Creando…" : `Crear «${resultado.nombre_ingreso}»`}
                </Boton>
              )}
          </div>
        </Panel>
      )}

      {resultado && destino === "ahorro" && data && (
        <PanelAhorro
          cerrar={cerrar}
          mes={mes}
          falta={0}
          ahorros={(data.ahorros ?? []).filter((a) => !a.deleted_at && a.periodo === mes)}
          inicial={{
            monto: resultado.monto ?? undefined,
            moneda: resultado.moneda ?? "ARS",
            fecha,
            nota: resultado.descripcion,
          }}
          aviso={aviso}
          ultimoTipoCambio={
            [...(data.ahorros ?? [])].reverse().find((a) => !a.deleted_at && a.moneda === "USD")?.tipo_cambio ?? null
          }
          recargar={recargar}
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

function PanelDictado({
  ejemplo,
  cerrar,
  alListo,
}: {
  ejemplo: string;
  cerrar: () => void;
  alListo: (texto: string) => void;
}) {
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
      titulo="¿Qué cargamos?"
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
              : "Tocá el micrófono o corregí el texto."}
        </p>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={ejemplo}
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
