"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Emoji } from "@/components/Emoji";
import { Toasts, avisar } from "@/components/Toast";
import { Aviso, Boton, Cargando, Input, InputPct } from "@/components/ui";
import { sugerirEmoji } from "@/lib/emoji";
import { plata } from "@/lib/format";
import { preferencias } from "@/lib/finanzas";
import { enviar, nombreVisible, useData, type DataResponse } from "@/lib/useData";

// La primera vez: cuatro preguntas fáciles para que la app arranque armada a
// tu medida. Una por pantalla, todas con respuesta de un toque, y cada paso se
// guarda al seguir: si cerrás a la mitad, lo contestado no se pierde.
//
// Al final se marca `onboarding` en ajustes y el Shell deja de mandar acá.

const FUENTES = [
  { nombre: "Sueldo", emoji: "maletin" },
  { nombre: "Freelance", emoji: "laptop" },
  { nombre: "Alquileres", emoji: "llave" },
  { nombre: "Redes", emoji: "camara" },
  { nombre: "Inversiones", emoji: "grafico" },
  { nombre: "Jubilación", emoji: "bolsa-plata" },
] as const;

/** Para arrancar a cargar sin tener que inventar categorías. */
const CATEGORIAS_BASE = ["Súper", "Comida", "Transporte", "Casa", "Servicios", "Salidas", "Salud", "Otros"];
const EMOJI_BASE: Record<string, string> = { Servicios: "luz", Otros: "moneda", Transporte: "colectivo", Salidas: "cerveza" };

const PASOS = ["nombre", "ingresos", "ahorro", "division", "listo"] as const;
type Paso = (typeof PASOS)[number];

type Moneda = "ARS" | "USD";

export default function Bienvenida() {
  const { data, error } = useData();
  if (error) {
    return (
      <main className="mx-auto max-w-md px-5 py-12">
        <Aviso tipo="error">{error.message}</Aviso>
      </main>
    );
  }
  if (!data) return <Cargando />;
  return <Pasos data={data} />;
}

function Pasos({ data }: { data: DataResponse }) {
  const router = useRouter();
  const { recargar } = useData();
  const prefs = preferencias(data.config);

  const [paso, setPaso] = useState<Paso>("nombre");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState(nombreVisible(data));
  const [fuentes, setFuentes] = useState<Record<string, Moneda>>({});
  const [otra, setOtra] = useState("");
  const [ahorro, setAhorro] = useState(String(prefs.ahorroPct));
  const [divide, setDivide] = useState<boolean | null>(data.config.divide ? prefs.divide : null);
  const [pareja, setPareja] = useState(prefs.pareja);
  const [miPct, setMiPct] = useState(String(prefs.divMiPct));

  const i = PASOS.indexOf(paso);
  const ir = (p: Paso) => {
    setError("");
    setPaso(p);
    window.scrollTo({ top: 0 });
  };

  async function guardar(cuerpo: Record<string, string>) {
    const r = await enviar("/api/config", "POST", cuerpo);
    if (!r.ok) throw new Error(r.error);
  }

  /** Corre un paso: guarda y pasa al siguiente. Un error deja todo como estaba. */
  async function seguir(accion: () => Promise<void>, siguiente: Paso) {
    if (guardando) return;
    setGuardando(true);
    setError("");
    try {
      await accion();
      ir(siguiente);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function crearIngresos() {
    const existentes = new Set(data.ingresos.filter((x) => !x.deleted_at).map((x) => x.nombre.toLowerCase()));
    const elegidas = Object.entries(fuentes).filter(([n]) => n !== "Alquileres");
    if (otra.trim()) elegidas.push([otra.trim(), "ARS"]);
    const nuevas = elegidas.filter(([n]) => !existentes.has(n.toLowerCase()));
    await guardar({ alquileres: "Alquileres" in fuentes || prefs.alquileres ? "si" : "no" });
    for (const [n, moneda] of nuevas) {
      const def = FUENTES.find((f) => f.nombre === n);
      const r = await enviar("/api/ingresos", "POST", {
        nombre: n,
        moneda,
        emoji: def?.emoji ?? sugerirEmoji(n, "bolsa-plata"),
        orden: data.ingresos.length + nuevas.findIndex(([x]) => x === n),
      });
      if (!r.ok) throw new Error(r.error);
    }
  }

  async function terminar(estado: "1" | "salteado") {
    if (guardando) return;
    setGuardando(true);
    try {
      // Categorías de base solo si no tiene ninguna: nunca pisa las suyas.
      if (data.categorias.length === 0) {
        await Promise.all(
          CATEGORIAS_BASE.map((n, k) =>
            enviar("/api/categorias", "POST", {
              nombre: n,
              color: (k % 8) + 1,
              emoji: EMOJI_BASE[n] ?? sugerirEmoji(n),
              orden: k,
            })
          )
        );
      }
      await guardar({ onboarding: estado });
      await recargar();
      return true;
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No pude guardar. Probá de nuevo.");
      return false;
    } finally {
      setGuardando(false);
    }
  }

  const pct = Number(ahorro.replace(",", "."));
  const pctOk = Number.isFinite(pct) && pct >= 0 && pct <= 100;
  const parte = Number(miPct.replace(",", "."));
  const parteOk = Number.isFinite(parte) && parte >= 0 && parte <= 100;

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
    >
      {/* Progreso y saltear */}
      <div className="flex h-12 items-center justify-between">
        <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={PASOS.length} aria-valuenow={i + 1} aria-label="Paso">
          {PASOS.map((p, k) => (
            <span
              key={p}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-[var(--ease-quart)] ${
                k === i ? "w-6 bg-acento" : k < i ? "w-1.5 bg-acento" : "w-1.5 bg-pista"
              }`}
            />
          ))}
        </div>
        {paso !== "nombre" && paso !== "listo" && (
          <button
            type="button"
            onClick={async () => {
              if (await terminar("salteado")) router.replace("/");
            }}
            className="min-h-11 px-2 text-sm font-semibold text-tenue hover:text-tinta"
          >
            Saltear
          </button>
        )}
      </div>

      <div key={paso} className="aparece flex flex-1 flex-col pb-6 pt-6">
        {paso === "nombre" && (
          <Pregunta emoji="cara-feliz" titulo="¡Hola! ¿Cómo te llamamos?">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              autoComplete="given-name"
              maxLength={40}
              className="text-lg"
            />
          </Pregunta>
        )}

        {paso === "ingresos" && (
          <Pregunta emoji="bolsa-plata" titulo="¿De dónde te entra la plata?" bajada="Elegí todas las que quieras.">
            <div className="flex flex-wrap gap-2">
              {FUENTES.map((f) => {
                const activa = f.nombre in fuentes;
                return (
                  <button
                    key={f.nombre}
                    type="button"
                    aria-pressed={activa}
                    onClick={() =>
                      setFuentes((xs) => {
                        const { [f.nombre]: fuera, ...resto } = xs;
                        return fuera ? resto : { ...xs, [f.nombre]: "ARS" };
                      })
                    }
                    className={`flex min-h-12 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-quart)] active:scale-[0.96] ${
                      activa ? "border-acento bg-acento text-white" : "border-borde bg-papel text-tinta hover:border-celeste"
                    }`}
                  >
                    <Emoji nombre={f.emoji} tamano="sm" />
                    {f.nombre}
                  </button>
                );
              })}
            </div>
            <Input
              value={otra}
              onChange={(e) => setOtra(e.target.value)}
              placeholder="Otra (ej: Changas)"
              maxLength={60}
              className="mt-3"
            />

            {/* La moneda, solo de las que cobran en otra moneda posible. */}
            {Object.keys(fuentes).some((n) => n !== "Alquileres") && (
              <ul className="mt-5 flex flex-col divide-y divide-linea rounded-2xl border border-borde bg-papel">
                {Object.entries(fuentes)
                  .filter(([n]) => n !== "Alquileres")
                  .map(([n, m]) => (
                    <li key={n} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="text-sm font-medium">{n}</span>
                      <div className="flex rounded-full bg-celeste-claro p-1" role="radiogroup" aria-label={`Moneda de ${n}`}>
                        {(["ARS", "USD"] as const).map((x) => (
                          <button
                            key={x}
                            type="button"
                            role="radio"
                            aria-checked={m === x}
                            onClick={() => setFuentes((xs) => ({ ...xs, [n]: x }))}
                            className={`min-h-9 rounded-full px-3 text-xs font-bold transition-colors ${
                              m === x ? "bg-papel text-acento shadow-[0_1px_3px_oklch(0.24_0.06_264/0.12)]" : "text-suave"
                            }`}
                          >
                            {x === "ARS" ? "$" : "US$"}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </Pregunta>
        )}

        {paso === "ahorro" && (
          <Pregunta emoji="brote" titulo="¿Cuánto querés ahorrar por mes?">
            <div className="flex flex-wrap gap-2">
              {[10, 15, 20, 30].map((v) => (
                <Chip key={v} activo={pct === v} onClick={() => setAhorro(String(v))}>
                  {v}%
                </Chip>
              ))}
              <div className="w-28">
                <InputPct value={ahorro} onChange={(e) => setAhorro(e.target.value)} aria-label="Otro porcentaje" />
              </div>
            </div>
            {pctOk && pct > 0 && (
              <p className="mt-4 text-sm text-suave">
                De cada {plata(100000)}, guardás <span className="font-semibold text-tinta">{plata(1000 * pct)}</span>.
              </p>
            )}
          </Pregunta>
        )}

        {paso === "division" && (
          <Pregunta emoji="corazones" titulo="¿Dividís gastos con alguien?" bajada="Tu pareja, un roomie, quien sea.">
            <div className="grid grid-cols-2 gap-2.5">
              <Opcion activo={divide === true} onClick={() => setDivide(true)} emoji="corazones">
                Sí
              </Opcion>
              <Opcion activo={divide === false} onClick={() => setDivide(false)} emoji="cara-feliz">
                No, solo yo
              </Opcion>
            </div>
            {divide && (
              <div className="aparece mt-5 flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-suave">¿Cómo se llama?</span>
                  <Input value={pareja} onChange={(e) => setPareja(e.target.value)} placeholder="Su nombre" maxLength={40} />
                </label>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-suave">¿Qué parte ponés vos?</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { v: 50, label: "Mitad" },
                      { v: 60, label: "60%" },
                      { v: 40, label: "40%" },
                    ].map((o) => (
                      <Chip key={o.v} activo={parte === o.v} onClick={() => setMiPct(String(o.v))}>
                        {o.label}
                      </Chip>
                    ))}
                    <div className="w-28">
                      <InputPct value={miPct} onChange={(e) => setMiPct(e.target.value)} aria-label="Tu parte en porcentaje" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Pregunta>
        )}

        {paso === "listo" && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Emoji nombre="fiesta" tamano="xxl" className="pop h-24 w-24" />
            <h1 className="titulo mt-5 text-3xl font-extrabold">¡Listo, {nombre.trim() || "che"}!</h1>
            <p className="mt-2 text-sm text-suave">Ya podés cargar tu primer gasto.</p>
          </div>
        )}
      </div>

      {/* La acción, abajo y a lo ancho: donde llega el pulgar. */}
      <div
        className="sticky bottom-0 -mx-5 flex flex-col gap-2 bg-fondo/95 px-5 pt-3 backdrop-blur-sm"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <Aviso tipo="error">{error}</Aviso>
        {paso === "nombre" && (
          <Boton
            className="min-h-12 w-full text-base"
            disabled={guardando || !nombre.trim()}
            onClick={() => seguir(() => guardar({ nombre: nombre.trim() }), "ingresos")}
          >
            Seguir
          </Boton>
        )}
        {paso === "ingresos" && (
          <Boton className="min-h-12 w-full text-base" disabled={guardando} onClick={() => seguir(crearIngresos, "ahorro")}>
            {guardando ? "Guardando…" : Object.keys(fuentes).length || otra.trim() ? "Seguir" : "Después lo cargo"}
          </Boton>
        )}
        {paso === "ahorro" && (
          <Boton
            className="min-h-12 w-full text-base"
            disabled={guardando || !pctOk}
            onClick={() => seguir(() => guardar({ ahorro_pct: String(pct) }), "division")}
          >
            Seguir
          </Boton>
        )}
        {paso === "division" && (
          <Boton
            className="min-h-12 w-full text-base"
            disabled={guardando || divide === null || (divide && !parteOk)}
            onClick={() =>
              seguir(async () => {
                await guardar(
                  divide
                    ? { divide: "si", pareja_nombre: pareja.trim(), div_mi_pct: String(parte) }
                    : { divide: "no" }
                );
                if (!(await terminar("1"))) throw new Error("No pude guardar. Probá de nuevo.");
              }, "listo")
            }
          >
            {guardando ? "Guardando…" : "Terminar"}
          </Boton>
        )}
        {paso === "listo" && (
          <>
            <Boton className="min-h-12 w-full text-base" onClick={() => router.replace("/gastos?nuevo=1")}>
              Cargar un gasto
            </Boton>
            <Boton variante="fantasma" className="min-h-11 w-full" onClick={() => router.replace("/")}>
              Ir al inicio
            </Boton>
          </>
        )}
        {i > 0 && paso !== "listo" && (
          <Boton variante="fantasma" className="min-h-11 w-full" disabled={guardando} onClick={() => ir(PASOS[i - 1])}>
            Atrás
          </Boton>
        )}
      </div>
      <Toasts />
    </main>
  );
}

function Pregunta({
  emoji,
  titulo,
  bajada,
  children,
}: {
  emoji: string;
  titulo: string;
  bajada?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col">
      <Emoji nombre={emoji} tamano="xl" className="pop" />
      <h1 className="titulo mt-4 text-[1.9rem] font-extrabold leading-tight">{titulo}</h1>
      {bajada && <p className="mt-1.5 text-sm text-suave">{bajada}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`min-h-12 min-w-16 rounded-full border px-4 text-sm font-bold transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-quart)] active:scale-[0.96] ${
        activo ? "border-acento bg-acento text-white" : "border-borde bg-papel text-tinta hover:border-celeste"
      }`}
    >
      {children}
    </button>
  );
}

function Opcion({
  activo,
  onClick,
  emoji,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  emoji: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-5 text-sm font-bold transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-quart)] active:scale-[0.97] ${
        activo ? "border-acento bg-acento-claro text-acento" : "border-borde bg-papel text-tinta hover:border-celeste"
      }`}
    >
      <Emoji nombre={emoji} tamano="lg" />
      {children}
    </button>
  );
}
