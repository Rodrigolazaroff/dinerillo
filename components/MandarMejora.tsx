"use client";

import { useState } from "react";
import { avisar } from "@/components/Toast";
import { Aviso, Boton, Panel, Textarea } from "@/components/ui";
import { enviar } from "@/lib/useData";

// Una idea, una queja o un comentario sobre la app: se escribe, se manda y
// listo. No hay seguimiento: lo lee el admin en /admin y una vez por semana
// se analiza todo junto (tabla `mejoras`).

export function MandarMejora({ cerrar }: { cerrar: () => void }) {
  const [texto, setTexto] = useState("");
  const [mandando, setMandando] = useState(false);
  const [error, setError] = useState("");

  async function mandar(e: React.FormEvent) {
    e.preventDefault();
    setMandando(true);
    setError("");
    const r = await enviar("/api/mejoras", "POST", { texto });
    setMandando(false);
    if (!r.ok) return setError(r.error);
    cerrar();
    avisar("¡Gracias! Lo vamos a leer");
  }

  return (
    <Panel
      abierto
      cerrar={cerrar}
      titulo="Sugerir una mejora"
      pie={
        <div className="flex flex-col gap-2">
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={cerrar} disabled={mandando}>
              Cancelar
            </Boton>
            <Boton type="submit" form="mandar-mejora" className="flex-1" disabled={mandando || texto.trim().length < 3}>
              {mandando ? "Mandando…" : "Mandar"}
            </Boton>
          </div>
        </div>
      }
    >
      <form id="mandar-mejora" onSubmit={mandar} className="flex flex-col gap-2">
        <p className="text-sm text-suave">Una idea, algo que falla o lo que no te gusta.</p>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Contanos…"
          maxLength={1000}
          rows={5}
          aria-label="Tu sugerencia"
        />
      </form>
    </Panel>
  );
}
