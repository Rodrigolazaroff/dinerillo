"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Boton } from "@/components/ui";

/** El evento que dispara Chrome cuando la app cumple los requisitos de instalable. */
type EventoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const PASOS_IOS = [
  "Tocá el botón Compartir de Safari, abajo en el medio de la pantalla.",
  "Bajá en la lista y elegí «Agregar a pantalla de inicio».",
  "Tocá «Agregar» arriba a la derecha y ya te queda el icono.",
];

/** No renderiza nada: sólo engancha (o saca) el service worker. */
export function RegistrarSW() {
  useEffect(() => {
    try {
      if (!("serviceWorker" in navigator)) return;

      if (process.env.NODE_ENV !== "production") {
        /*
         * En dev el service worker no va: cachea el shell y después pasás media
         * hora debuggeando un cambio que sí está en el código. De paso sacamos
         * el que haya quedado de una sesión anterior o de una build local.
         */
        navigator.serviceWorker
          .getRegistrations()
          .then((registros) => registros.forEach((r) => void r.unregister()))
          .catch(() => {});
        return;
      }

      // Sin await: si el registro falla la app anda igual, sólo pierde el offline.
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    } catch {
      // Contexto no seguro, modo incógnito con storage bloqueado, etc.
    }
  }, []);

  return null;
}

function estaStandalone() {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/** Se suscribe a los dos avisos del navegador sobre el modo de visualizacion. */
function suscribirModo(avisar: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", avisar);
  window.addEventListener("appinstalled", avisar);
  return () => {
    mq.removeEventListener("change", avisar);
    window.removeEventListener("appinstalled", avisar);
  };
}

const sinCambios = () => () => {};

/** iPadOS 13+ se hace pasar por Mac: se delata por el touch. */
function detectarIOS() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export function useInstalable() {
  // El evento vive en un ref: guardarlo en estado lo haria parte del render.
  const evento = useRef<EventoInstalar | null>(null);
  const [sePuedeInstalar, setSePuedeInstalar] = useState(false);

  // Si esta instalada lo dice el navegador, no React. En el server no hay
  // ventana, asi que el snapshot de servidor es false y no hay mismatch.
  const yaInstalada = useSyncExternalStore(suscribirModo, estaStandalone, () => false);
  const esIOSNativo = useSyncExternalStore(sinCambios, detectarIOS, () => false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Sin preventDefault Chrome muestra su propio cartel y nos come el boton.
      e.preventDefault();
      evento.current = e as EventoInstalar;
      setSePuedeInstalar(true);
    };
    const onInstalada = () => {
      evento.current = null;
      setSePuedeInstalar(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalada);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalada);
    };
  }, []);

  const instalar = useCallback(async () => {
    const e = evento.current;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    evento.current = null;
    setSePuedeInstalar(false);
    return outcome === "accepted";
  }, []);

  return {
    sePuedeInstalar: sePuedeInstalar && !yaInstalada,
    yaInstalada,
    // En iPhone no existe beforeinstallprompt: se instala a mano desde Compartir.
    esIOS: esIOSNativo && !yaInstalada,
    instalar,
  };
}

export function BotonInstalar({ className = "" }: { className?: string }) {
  const { sePuedeInstalar, yaInstalada, esIOS, instalar } = useInstalable();
  const [pidiendo, setPidiendo] = useState(false);

  if (yaInstalada) {
    return (
      <p className={`flex items-center gap-2 text-xs font-medium text-ok ${className}`}>
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 10.5l4 4 8-9" />
        </svg>
        Ya está instalada en este dispositivo
      </p>
    );
  }

  if (sePuedeInstalar) {
    return (
      <Boton
        variante="primario"
        className={`min-h-11 w-full sm:w-auto ${className}`}
        disabled={pidiendo}
        onClick={async () => {
          setPidiendo(true);
          try {
            await instalar();
          } finally {
            setPidiendo(false);
          }
        }}
      >
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M10 3v9m0 0l3.5-3.5M10 12L6.5 8.5" />
          <path d="M4 14v1.5A1.5 1.5 0 005.5 17h9a1.5 1.5 0 001.5-1.5V14" />
        </svg>
        Instalar en el celular
      </Boton>
    );
  }

  if (esIOS) {
    return (
      <div className={`rounded-lg border border-borde bg-papel p-3 ${className}`}>
        <p className="text-xs font-semibold tracking-tight text-tinta">
          Para tenerla como app en el iPhone
        </p>
        <ol className="mt-2.5 flex flex-col gap-2">
          {PASOS_IOS.map((paso, i) => (
            <li key={paso} className="flex items-start gap-2 text-xs leading-relaxed text-suave">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-acento-claro text-[11px] font-semibold text-acento">
                {i + 1}
              </span>
              {paso}
            </li>
          ))}
        </ol>
        <p className="mt-2.5 text-[11px] leading-snug text-tenue">
          En iPhone esto sólo anda desde Safari. Si estás en Chrome no te va a aparecer la
          opción: abrí Dinerillo en Safari y recién ahí seguí los pasos.
        </p>
      </div>
    );
  }

  return (
    <p className={`text-xs leading-relaxed text-tenue ${className}`}>
      Desde este navegador no se puede instalar. Abrí Dinerillo en el celular, con Chrome en
      Android o Safari en iPhone, y ahí te va a aparecer la opción.
    </p>
  );
}
