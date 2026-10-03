import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/*
 * El ícono de la app instalada: la moneda 3D (Fluent Emoji, MIT) sobre el azul
 * de la marca. Sale de acá y no son PNG sueltos en /public para que, si cambia
 * el azul, no haya que reexportar nada a mano.
 * Se prerenderizan en build: no hay nada dinámico que mirar en el request.
 */
export const dynamic = "force-static";

/** El azul eléctrico de la marca (--color-acento, oklch(0.5 0.22 264)). */
const AZUL = "#1d52de";

/** `marca`: fracción del lienzo que ocupa la moneda. El resto es aire. */
const ICONOS: Record<string, { lado: number; marca: number }> = {
  "icono-192.png": { lado: 192, marca: 0.72 },
  "icono-512.png": { lado: 512, marca: 0.72 },
  // El maskable deja 20% de cada lado como descarte: Android recorta un
  // círculo y lo que quede afuera se pierde.
  "maskable-512.png": { lado: 512, marca: 0.56 },
  "apple-180.png": { lado: 180, marca: 0.68 },
};

export function generateStaticParams() {
  return Object.keys(ICONOS).map((icono) => ({ icono }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ icono: string }> }) {
  const { icono } = await params;
  const spec = ICONOS[icono];
  if (!spec) return new Response("No existe", { status: 404 });

  // El original es de 256 px: en el ícono más grande se agranda apenas 1,4x.
  const png = await readFile(join(process.cwd(), "assets", "moneda-3d.png"));
  const moneda = `data:image/png;base64,${png.toString("base64")}`;

  const { lado } = spec;
  const m = Math.round(lado * spec.marca);

  return new ImageResponse(
    (
      <div
        style={{
          width: lado,
          height: lado,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: AZUL,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse solo entiende <img> */}
        <img src={moneda} width={m} height={m} alt="" />
      </div>
    ),
    {
      width: lado,
      height: lado,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
