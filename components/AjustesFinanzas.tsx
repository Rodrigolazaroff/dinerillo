"use client";

import { useState } from "react";
import { emojiCategoria, PuntoCategoria, proximoColor } from "@/components/Categorias";
import { Emoji } from "@/components/Emoji";
import { ElegirEmoji } from "@/components/ElegirEmoji";
import { sugerirEmoji } from "@/lib/emoji";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, Campo, Card, Input, InputPct } from "@/components/ui";
import { preferencias } from "@/lib/finanzas";
import type { Categoria, Config } from "@/lib/types";
import { enviar } from "@/lib/useData";

// Las preferencias de los módulos de plata y las categorías. Los números que
// vienen de fábrica (15% de ahorro, mitad y mitad) son el punto de partida:
// cada uno pone los suyos.

export function AjustesFinanzas({
  config,
  categorias,
  recargar,
}: {
  config: Config;
  categorias: Categoria[];
  recargar: () => Promise<unknown>;
}) {
  const prefs = preferencias(config);
  const [ahorro, setAhorro] = useState(String(prefs.ahorroPct));
  const [pareja, setPareja] = useState(prefs.pareja);
  const [miPct, setMiPct] = useState(String(prefs.divMiPct));
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const a = Number(ahorro.replace(",", "."));
    const m = Number(miPct.replace(",", "."));
    if (!Number.isFinite(a) || a < 0 || a > 100) return setErr("El ahorro va de 0 a 100%.");
    if (!Number.isFinite(m) || m < 0 || m > 100) return setErr("Tu parte va de 0 a 100%.");
    setErr("");
    setGuardando(true);
    const r = await enviar("/api/config", "POST", {
      ahorro_pct: String(a),
      div_mi_pct: String(m),
      pareja_nombre: pareja.trim(),
    });
    setGuardando(false);
    if (!r.ok) return setErr(r.error);
    await recargar();
    avisar("Guardado");
  }

  return (
    <>
      <Card titulo="Tu plata" nota="Lo que se usa para sugerirte y para precargar los formularios.">
        <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:px-5">
          <Campo
            label="Ahorro sugerido"
            hint="Qué parte de lo que entra te gustaría guardar cada mes."
            className="col-span-2 sm:col-span-1"
          >
            <InputPct value={ahorro} onChange={(e) => setAhorro(e.target.value)} />
          </Campo>
          <Campo label="Tu pareja" hint="Para División: quién es el otro." className="col-span-2 sm:col-span-1">
            <Input value={pareja} onChange={(e) => setPareja(e.target.value)} maxLength={40} placeholder="Su nombre" />
          </Campo>
          <Campo
            label="Tu parte de un gasto compartido"
            hint="Con qué arranca el formulario. Cada gasto puede tener la suya."
            className="col-span-2"
          >
            <InputPct value={miPct} onChange={(e) => setMiPct(e.target.value)} />
          </Campo>
        </div>
        <div className="flex flex-col gap-2 border-t border-borde px-4 py-3 sm:px-5">
          <Aviso tipo="error">{err}</Aviso>
          <div>
            <Boton onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
          </div>
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
      nota="Las mismas para tus gastos y para los compartidos. Tocá el emoji para cambiarlo y el punto para cambiar el color."
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
                  className="min-w-0 flex-1 rounded-md border border-acento bg-papel px-2 py-1 text-sm focus:outline-none"
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
          Agregar
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
