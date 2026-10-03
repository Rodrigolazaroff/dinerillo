"use client";

import { useState } from "react";
import { Emoji } from "@/components/Emoji";
import { IconoMas } from "@/components/iconos";
import { emojiDe, sugerirEmoji } from "@/lib/emoji";
import type { Categoria } from "@/lib/types";
import { enviar } from "@/lib/useData";

// Las categorías las crea cada uno: no hay una lista de fábrica. Se eligen con
// un toque y, si falta una, se crea ahí mismo sin salir del formulario.

/** El color de una categoría: uno de los ocho de la paleta, o gris si no tiene. */
export const colorCategoria = (slot: number) =>
  slot >= 1 && slot <= 8 ? `var(--color-serie-${slot})` : "var(--color-tenue)";

export function PuntoCategoria({ color }: { color: number }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: colorCategoria(color) }}
      aria-hidden
    />
  );
}

/** El emoji de una categoría: el elegido, o uno sugerido por su nombre. */
export const emojiCategoria = (c?: Pick<Categoria, "emoji" | "nombre" | "deleted_at">) =>
  c && !c.deleted_at ? emojiDe(c.emoji, c.nombre) : "moneda";

/** El próximo color libre: así dos categorías nuevas no salen iguales. */
export function proximoColor(categorias: Categoria[]): number {
  const usados = new Set(categorias.filter((c) => !c.deleted_at).map((c) => c.color));
  for (let i = 1; i <= 8; i++) if (!usados.has(i)) return i;
  return (categorias.length % 8) + 1;
}

export function ElegirCategoria({
  categorias,
  valor,
  onCambio,
  alCrear,
}: {
  categorias: Categoria[];
  valor: string;
  onCambio: (id: string) => void;
  alCrear: () => Promise<unknown> | void;
}) {
  const vivas = categorias.filter((c) => !c.deleted_at);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    const n = nombre.trim();
    if (!n) return;
    const existe = vivas.find((c) => c.nombre.toLowerCase() === n.toLowerCase());
    if (existe) {
      onCambio(existe.id);
      setCreando(false);
      setNombre("");
      return;
    }
    setGuardando(true);
    const res = await fetch("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: n,
        color: proximoColor(categorias),
        emoji: sugerirEmoji(n),
        orden: vivas.length,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setGuardando(false);
    if (!res.ok) {
      setError(data?.error ?? "No pude crear la categoría");
      return;
    }
    await alCrear();
    onCambio(data.id);
    setCreando(false);
    setNombre("");
    setError("");
  }

  const chip = (activo: boolean) =>
    `inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-quart)] active:scale-95 ${
      activo ? "border-acento bg-acento text-white" : "border-borde bg-papel text-tinta hover:border-celeste hover:bg-celeste-claro"
    }`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Categoría">
        {vivas.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={valor === c.id}
            onClick={() => onCambio(valor === c.id ? "" : c.id)}
            className={chip(valor === c.id)}
          >
            <Emoji nombre={emojiCategoria(c)} tamano="sm" />
            {c.nombre}
          </button>
        ))}
        {!creando && (
          <button type="button" onClick={() => setCreando(true)} className={`${chip(false)} text-suave`}>
            <IconoMas className="h-3.5 w-3.5" />
            {vivas.length ? "Nueva" : "Crear categoría"}
          </button>
        )}
      </div>
      {creando && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                crear();
              }
              if (e.key === "Escape") setCreando(false);
            }}
            maxLength={40}
            placeholder="Ej: Super, Salidas, Auto"
            className="w-full rounded-lg border border-borde bg-papel px-3 py-2 text-sm focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/15"
          />
          <button
            type="button"
            onClick={crear}
            disabled={guardando || !nombre.trim()}
            className="shrink-0 rounded-lg bg-acento px-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {guardando ? "…" : "Crear"}
          </button>
        </div>
      )}
      {error && <p className="text-[11px] text-peligro">{error}</p>}
    </div>
  );
}

/** Borrar una categoría desde Ajustes. Los gastos que la usaban quedan "sin categoría". */
export async function borrarCategoria(id: string) {
  return enviar("/api/categorias", "DELETE", { id });
}
