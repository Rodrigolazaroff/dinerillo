"use client";

import {
  useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Emoji } from "@/components/Emoji";
import { Boton } from "@/components/ui";

// La primera vez que alguien entra, un recorrido corto: la app se oscurece y
// se ilumina una parte por vez, con una tarjetita que dice para qué sirve.
// Siguiente u Omitir, nada más. No explica cómo funciona por dentro: muestra
// dónde tocar.
//
// Cada paso apunta a un elemento marcado con data-recorrido="…". Si no está en
// pantalla (el ahorro de un mes sin ingresos, la barra de abajo en la compu),
// ese paso no se muestra.

export interface PasoRecorrido {
  /** El data-recorrido del elemento que se ilumina. */
  donde: string;
  emoji: string;
  titulo: string;
  texto: string;
}

/** Aire entre el elemento y el borde del hueco. */
const AIRE = 6;
/** Separación entre el hueco y la tarjeta. */
const SEP = 12;
/** Margen contra los bordes de la pantalla. */
const BORDE = 12;

interface Medidas {
  top: number;
  left: number;
  width: number;
  height: number;
  radio: number;
  vw: number;
  vh: number;
}

const nada = () => () => {};

/** El primero que se ve: la barra de pestañas existe dos veces (celu y compu). */
function buscar(donde: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-recorrido="${donde}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** La franja de la pantalla que no tapan el encabezado ni la barra de abajo. */
function franjaLibre() {
  const vh = window.innerHeight;
  const arriba = document.querySelector('[data-barra="arriba"]')?.getBoundingClientRect();
  const abajo = document.querySelector('[data-barra="abajo"]')?.getBoundingClientRect();
  return {
    desde: Math.max(0, arriba?.bottom ?? 0) + BORDE,
    hasta: (abajo && abajo.height > 0 ? Math.min(vh, abajo.top) : vh) - BORDE,
  };
}

/**
 * Corre la página para que el elemento y la tarjeta entren juntos. Si ya se
 * ven, no se mueve nada; lo que está en una barra fija siempre se ve.
 */
function encuadrar(el: HTMLElement, altoTarjeta: number) {
  if (el.closest("[data-barra]")) return;
  const r = el.getBoundingClientRect();
  const { desde, hasta } = franjaLibre();
  const entra = r.top - AIRE >= desde && r.bottom + AIRE <= hasta;
  const vh = window.innerHeight;
  const lugar = Math.max(vh - BORDE - (r.bottom + AIRE + SEP), r.top - AIRE - SEP - BORDE);
  if (entra && lugar >= altoTarjeta) return;
  const bloque = r.height + 2 * AIRE + SEP + altoTarjeta;
  // Entra todo junto: centrado. No entra: el elemento lo más arriba posible.
  const destino = bloque <= hasta - desde ? desde + (hasta - desde - bloque) / 2 : desde;
  window.scrollBy({ top: r.top - AIRE - destino, behavior: "instant" });
}

function medir(el: HTMLElement): Medidas {
  const r = el.getBoundingClientRect();
  const alto = r.height + 2 * AIRE;
  // El hueco copia la curva del elemento (redondo si es redondo).
  const curva = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12;
  return {
    top: r.top - AIRE,
    left: r.left - AIRE,
    width: r.width + 2 * AIRE,
    height: alto,
    radio: Math.min(curva + AIRE, alto / 2),
    vw: document.documentElement.clientWidth,
    vh: window.innerHeight,
  };
}

// "Ver el recorrido otra vez" (Preguntas frecuentes) lo pide y navega a Inicio,
// que lo lee al montarse. Va en memoria y no en la URL: al navegar por adentro,
// Inicio se dibuja antes de que cambie la dirección. Queda pedido un rato, por
// si React dibuja Inicio dos veces, y se olvida al terminar.
let pedidoEn = 0;
export function pedirRecorrido() {
  pedidoEn = Date.now();
}
export function recorridoPedido(): boolean {
  return Date.now() - pedidoEn < 30_000;
}
export function olvidarRecorridoPedido() {
  pedidoEn = 0;
}

const iguales = (a: Medidas | null, b: Medidas) =>
  !!a && (Object.keys(b) as (keyof Medidas)[]).every((k) => Math.abs(a[k] - b[k]) < 0.5);

export function Recorrido({
  pasos,
  terminar,
}: {
  pasos: PasoRecorrido[];
  /** "hecho" si llegó al final, "omitido" si lo cortó antes. */
  terminar: (como: "hecho" | "omitido") => void;
}) {
  const enNavegador = useSyncExternalStore(nada, () => true, () => false);
  const [lista, setLista] = useState<PasoRecorrido[] | null>(null);
  const [i, setI] = useState(0);
  const [m, setM] = useState<Medidas | null>(null);
  const [altoTarjeta, setAltoTarjeta] = useState(0);
  // Sin transición la primera vez: el hueco aparece en su lugar, no vuela desde la esquina.
  const [mover, setMover] = useState(false);
  const tarjeta = useRef<HTMLDivElement>(null);
  /** El último alto medido de la tarjeta: para encuadrar el paso sin esperar un render. */
  const ultimoAlto = useRef(0);
  const idTitulo = useId();
  const idTexto = useId();
  const alTerminar = useRef(terminar);
  useEffect(() => {
    alTerminar.current = terminar;
  });

  // Qué pasos tienen dónde pararse. Se mira una vez, en el cuadro siguiente, con
  // la pantalla ya armada; si después cambia, el recorrido no se rearma.
  const pasosAlAbrir = useRef(pasos);
  useEffect(() => {
    const cuadro = requestAnimationFrame(() => {
      const hay = pasosAlAbrir.current.filter((p) => buscar(p.donde));
      if (hay.length) setLista(hay);
      else alTerminar.current("omitido");
    });
    return () => cancelAnimationFrame(cuadro);
  }, []);

  const paso = lista?.[i];

  // Al cambiar de paso, correr la página si hace falta. Medir lo hace el seguimiento de abajo.
  useLayoutEffect(() => {
    if (!paso) return;
    const el = buscar(paso.donde);
    if (el) encuadrar(el, ultimoAlto.current || 190);
  }, [paso]);

  // Mientras está abierto, sigue al elemento: una fila que se carga arriba, girar
  // el celu o un número que crece lo mueven, y el hueco tiene que ir detrás.
  useEffect(() => {
    if (!paso || !lista) return;
    let cuadro = 0;
    const seguir = () => {
      const el = buscar(paso.donde);
      if (!el) {
        // Se fue de la pantalla mientras tanto: al siguiente, o se termina.
        if (i < lista.length - 1) setI(i + 1);
        else alTerminar.current("hecho");
        return;
      }
      const nuevas = medir(el);
      setM((viejas) => (iguales(viejas, nuevas) ? viejas : nuevas));
      const alto = tarjeta.current?.offsetHeight ?? 0;
      ultimoAlto.current = alto;
      setAltoTarjeta((a) => (Math.abs(a - alto) < 0.5 ? a : alto));
      cuadro = requestAnimationFrame(seguir);
    };
    cuadro = requestAnimationFrame(seguir);
    return () => cancelAnimationFrame(cuadro);
  }, [paso, i, lista]);

  useEffect(() => {
    if (!m || mover) return;
    const t = requestAnimationFrame(() => setMover(true));
    return () => cancelAnimationFrame(t);
  }, [m, mover]);

  // Abierto: la página quieta, Esc lo cierra y el foco en "Siguiente".
  const abierto = enNavegador && !!lista;
  useEffect(() => {
    if (!abierto) return;
    const antes = document.activeElement as HTMLElement | null;
    tarjeta.current?.querySelector<HTMLElement>("[data-siguiente]")?.focus({ preventScroll: true });
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alTerminar.current("omitido");
      if (e.key !== "Tab") return;
      // El Tab da vueltas entre Omitir y Siguiente: la app de atrás no se usa.
      const botones = [...(tarjeta.current?.querySelectorAll<HTMLElement>("button") ?? [])];
      if (!botones.length) return;
      e.preventDefault();
      const n = botones.indexOf(document.activeElement as HTMLElement);
      const salto = e.shiftKey ? -1 : 1;
      const destino = n === -1 ? (e.shiftKey ? botones.length - 1 : 0) : (n + salto + botones.length) % botones.length;
      botones[destino].focus();
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = previo;
      document.removeEventListener("keydown", tecla);
      antes?.focus?.({ preventScroll: true });
    };
  }, [abierto]);

  if (!abierto || !paso) return null;

  const total = lista.length;
  const ultimo = i === total - 1;

  function siguiente() {
    if (ultimo) alTerminar.current("hecho");
    else setI(i + 1);
  }

  // La tarjeta va abajo del hueco si entra; si no, arriba; si tampoco, abajo de
  // la pantalla, aunque tape un poco (pasa con un elemento muy alto en un celu chico).
  // Hasta medirla, invisible pero enfocable (con visibility: hidden el foco no entra).
  let estiloTarjeta: CSSProperties = { opacity: 0, pointerEvents: "none", top: 0, left: BORDE };
  if (m && altoTarjeta) {
    // El mismo ancho que pone la clase: 22rem, o la pantalla menos 1rem de cada lado.
    const ancho = Math.min(352, m.vw - 2 * 16);
    const left = Math.min(Math.max(m.left + m.width / 2 - ancho / 2, 16), m.vw - 16 - ancho);
    const abajo = m.top + m.height + SEP;
    const arriba = m.top - SEP - altoTarjeta;
    const top =
      abajo + altoTarjeta <= m.vh - BORDE ? abajo : arriba >= BORDE ? arriba : m.vh - BORDE - altoTarjeta;
    estiloTarjeta = { top, left };
  }

  const transicion = mover
    ? "transition-[top,left,width,height,border-radius] duration-300 ease-[var(--ease-quart)]"
    : "";

  return createPortal(
    <div className="no-print fixed inset-0 z-[70]">
      {/* Atrapa los toques: mientras dura el recorrido, la app de atrás no se usa. */}
      <div className="fondo-entra absolute inset-0" style={{ touchAction: "none" }} aria-hidden />

      {/* El hueco: la sombra gigante oscurece todo menos lo que importa. */}
      {m && (
        <div
          aria-hidden
          className={`fondo-entra pointer-events-none fixed ${transicion}`}
          style={{
            top: m.top,
            left: m.left,
            width: m.width,
            height: m.height,
            borderRadius: m.radio,
            boxShadow: "0 0 0 200vmax oklch(0.2 0.05 264 / 0.62)",
          }}
        />
      )}

      <div
        ref={tarjeta}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
        className={`panel-entra fixed w-[min(22rem,calc(100vw-2rem))] rounded-3xl bg-papel p-5 shadow-[0_24px_48px_-12px_oklch(0.24_0.06_264/0.45)] ${
          mover ? "transition-[top,left] duration-300 ease-[var(--ease-quart)]" : ""
        }`}
        style={estiloTarjeta}
      >
        <div className="flex items-start gap-3" aria-live="polite">
          <Emoji key={paso.donde} nombre={paso.emoji} tamano="lg" className="pop shrink-0" />
          <div className="min-w-0">
            <p className="sr-only">
              Paso {i + 1} de {total}.
            </p>
            <h2 id={idTitulo} className="titulo text-lg font-bold leading-tight">
              {paso.titulo}
            </h2>
            <p id={idTexto} className="mt-1 text-sm leading-relaxed text-suave">
              {paso.texto}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {/* Por dónde vas: el punto largo es el paso de ahora. */}
          <div className="flex flex-1 items-center gap-1.5" aria-hidden>
            {lista.map((p, n) => (
              <span
                key={p.donde}
                className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${
                  n === i ? "w-5 bg-acento" : "w-1.5 bg-borde"
                }`}
              />
            ))}
          </div>
          {!ultimo && (
            <Boton variante="fantasma" className="min-h-11" onClick={() => alTerminar.current("omitido")}>
              Omitir
            </Boton>
          )}
          <Boton data-siguiente className="min-h-11 px-5" onClick={siguiente}>
            {ultimo ? "¡Listo!" : "Siguiente"}
          </Boton>
        </div>
      </div>
    </div>,
    document.body
  );
}
