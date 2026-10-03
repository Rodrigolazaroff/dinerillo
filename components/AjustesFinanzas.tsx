"use client";

import { useState } from "react";
import { emojiCategoria, PuntoCategoria, proximoColor } from "@/components/Categorias";
import { Emoji } from "@/components/Emoji";
import { ElegirEmoji } from "@/components/ElegirEmoji";
import { sugerirEmoji } from "@/lib/emoji";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, Campo, Card, Input, InputPct, Interruptor } from "@/components/ui";
import { aNumero } from "@/lib/format";
import { preferencias } from "@/lib/finanzas";
import type { Categoria, Config } from "@/lib/types";
import { enviar } from "@/lib/useData";

// Lo tuyo: cómo te llamamos, cuánto querés ahorrar y si dividís gastos con
// alguien. Lo mismo que se contesta en la Bienvenida, para cambiarlo después.

export function AjustesFinanzas({
  config,
  categorias,
  nombreCuenta,
  email,
  recargar,
}: {
  config: Config;
  categorias: Categoria[];
  /** El nombre que trae la cuenta, para cuando no eligió otro. */
  nombreCuenta: string;
  email: string;
  recargar: () => Promise<unknown>;
}) {
  const prefs = preferencias(config);
  const [nombre, setNombre] = useState(prefs.nombre || nombreCuenta);
  const [ahorro, setAhorro] = useState(String(prefs.ahorroPct));
  const [divide, setDivide] = useState(prefs.divide);
  const [pareja, setPareja] = useState(prefs.pareja);
  const [miPct, setMiPct] = useState(String(prefs.divMiPct));
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const a = aNumero(ahorro);
    const m = aNumero(miPct);
    if (!nombre.trim()) return setErr("Poné tu nombre.");
    if (!Number.isFinite(a) || a < 0 || a > 100) return setErr("El ahorro va de 0 a 100%.");
    if (divide && (!Number.isFinite(m) || m < 0 || m > 100)) return setErr("Tu parte va de 0 a 100%.");
    setErr("");
    setGuardando(true);
    const r = await enviar("/api/config", "POST", {
      nombre: nombre.trim(),
      ahorro_pct: String(a),
      divide: divide ? "si" : "no",
      ...(divide ? { div_mi_pct: String(m), pareja_nombre: pareja.trim() } : {}),
    });
    setGuardando(false);
    if (!r.ok) return setErr(r.error);
    await recargar();
    avisar("Guardado");
  }

  return (
    <>
      <Card titulo="Vos">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Tu nombre" hint={email} className="col-span-2 sm:col-span-1">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} autoComplete="given-name" />
            </Campo>
            <Campo label="Meta de ahorro" className="col-span-2 sm:col-span-1">
              <InputPct value={ahorro} onChange={(e) => setAhorro(e.target.value)} />
            </Campo>
          </div>

          <div className="flex flex-col gap-3 border-t border-linea pt-3">
            <Interruptor activo={divide} onCambio={setDivide}>
              Divido gastos con alguien
            </Interruptor>
            {divide && (
              <div className="aparece grid grid-cols-2 gap-3">
                <Campo label="Con quién" className="col-span-2 sm:col-span-1">
                  <Input value={pareja} onChange={(e) => setPareja(e.target.value)} maxLength={40} placeholder="Su nombre" />
                </Campo>
                <Campo label="Tu parte" hint="Se cambia en cada gasto." className="col-span-2 sm:col-span-1">
                  <InputPct value={miPct} onChange={(e) => setMiPct(e.target.value)} />
                </Campo>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-borde px-4 py-3 sm:px-5">
          <Aviso tipo="error">{err}</Aviso>
          <Boton onClick={guardar} disabled={guardando} className="w-full sm:w-auto sm:self-start">
            {guardando ? "Guardando…" : "Guardar"}
          </Boton>
        </div>
      </Card>

      <Categorias categorias={categorias.filter((c) => !c.deleted_at)} todas={categorias} recargar={recargar} />
    </>
  );
}

function Categorias({
  categorias,
  todas,
  recargar,
}: {
  categorias: Categoria[];
  todas: Categoria[];
  recargar: () => Promise<unknown>;
}) {
  const [nueva, setNueva] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [eligiendoEmoji, setEligiendoEmoji] = useState<Categoria | null>(null);
  const [nombre, setNombre] = useState("");

  async function crear() {
    const n = nueva.trim();
    if (!n) return;
    const r = await enviar("/api/categorias", "POST", {
      nombre: n,
      color: proximoColor(todas),
      emoji: sugerirEmoji(n),
      orden: categorias.length,
    });
    if (!r.ok) return avisar(r.error);
    setNueva("");
    await recargar();
  }

  async function renombrar(c: Categoria) {
    const n = nombre.trim();
    setEditando(null);
    if (!n || n === c.nombre) return;
    const r = await enviar("/api/categorias", "PATCH", { id: c.id, nombre: n });
    if (!r.ok) return avisar(r.error);
    await recargar();
  }

  async function cambiarEmoji(c: Categoria, emoji: string) {
    const r = await enviar("/api/categorias", "PATCH", { id: c.id, emoji });
    if (!r.ok) return avisar(r.error);
    await recargar();
  }

  async function cambiarColor(c: Categoria) {
    const r = await enviar("/api/categorias", "PATCH", { id: c.id, color: (c.color % 8) + 1 });
    if (!r.ok) return avisar(r.error);
    await recargar();
  }

  async function borrar(c: Categoria) {
    const r = await enviar("/api/categorias", "DELETE", { id: c.id });
    if (!r.ok) return avisar(r.error);
    await recargar();
    avisar(`Borraste ${c.nombre}. Sus gastos quedan sin categoría.`, async () => {
      await enviar("/api/categorias", "PATCH", { id: c.id, restaurar: true });
      recargar();
    });
  }

  return (
    <Card
      titulo="Categorías"
      nota="Tocá el emoji o el punto para cambiarlos."
    >
      {categorias.length > 0 && (
        <ul className="divide-y divide-linea">
          {categorias.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-4 py-2 sm:px-5">
              <button
                type="button"
                onClick={() => setEligiendoEmoji(c)}
                aria-label={`Cambiar el emoji de ${c.nombre}`}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-celeste-claro transition-transform active:scale-90"
              >
                <Emoji nombre={emojiCategoria(c)} tamano="md" />
              </button>
              {editando === c.id ? (
                <input
                  autoFocus
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onBlur={() => renombrar(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renombrar(c);
                    if (e.key === "Escape") setEditando(null);
                  }}
                  maxLength={40}
                  className="min-w-0 flex-1 rounded-md border border-acento bg-papel px-2 py-1 text-base focus:outline-none sm:text-sm"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditando(c.id);
                    setNombre(c.nombre);
                  }}
                  className="min-w-0 flex-1 truncate text-left text-sm"
                >
                  {c.nombre}
                </button>
              )}
              <button
                type="button"
                onClick={() => cambiarColor(c)}
                aria-label={`Cambiar el color de ${c.nombre}`}
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-fondo"
              >
                <PuntoCategoria color={c.color} />
              </button>
              <Boton variante="peligro" tamano="sm" onClick={() => borrar(c)}>
                Borrar
              </Boton>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 border-t border-borde px-4 py-3 sm:px-5">
        <Input
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && crear()}
          placeholder="Nueva categoría"
          maxLength={40}
        />
        <Boton onClick={crear} disabled={!nueva.trim()}>
          Crear
        </Boton>
      </div>
      {eligiendoEmoji && (
        <ElegirEmoji
          abierto
          cerrar={() => setEligiendoEmoji(null)}
          actual={emojiCategoria(eligiendoEmoji)}
          titulo={`Emoji de ${eligiendoEmoji.nombre}`}
          alElegir={(e) => cambiarEmoji(eligiendoEmoji, e)}
        />
      )}
    </Card>
  );
}
