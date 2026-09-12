import { ImageResponse } from "next/og";

/*
 * Los iconos salen de acá en vez de ser PNG en /public para que el día que
 * cambie el azul de la marca no haya que reexportar nada a mano.
 * Se prerenderizan en build: no hay nada dinámico que mirar en el request.
 */
export const dynamic = "force-static";

const AZUL = "#1f4b6e";
const BLANCO = "#ffffff";

/** `marca`: fracción del lienzo que ocupa la llave. El resto es aire. */
const ICONOS: Record<string, { lado: number; marca: number }> = {
  "icono-192.png": { lado: 192, marca: 0.7 },
  "icono-512.png": { lado: 512, marca: 0.7 },
  // El maskable deja 20% de cada lado como descarte: Android recorta un
  // círculo y lo que quede afuera se pierde.
  "maskable-512.png": { lado: 512, marca: 0.6 },
  "apple-180.png": { lado: 180, marca: 0.66 },
};

export function generateStaticParams() {
  return Object.keys(ICONOS).map((icono) => ({ icono }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ icono: string }> }) {
  const { icono } = await params;
  const spec = ICONOS[icono];
  if (!spec) return new Response("No existe", { status: 404 });

  const { lado } = spec;
  const m = lado * spec.marca; // lado del cuadrado donde vive la marca

  /*
   * Llave de casa dibujada con círculos y rectángulos, sin una sola letra:
   * ImageResponse necesita una fuente cargada para renderizar glifos y una
   * fuente que falta en build deja el icono en blanco. Formas no fallan.
   */
  const aro = m * 0.48; // diámetro exterior del ojo de la llave
  const pared = m * 0.135; // grosor del aro
  const hueco = aro - pared * 2;
  const palo = m * 0.15; // ancho del cuerpo
  const dienteAncho = m * 0.19;
  const dienteAlto = m * 0.12;
  const paloX = m * 0.5 - palo / 2;
  const dienteX = m * 0.5 + palo / 2 - m * 0.015; // pisa un poco el cuerpo, sin costura

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
        <div style={{ position: "relative", display: "flex", width: m, height: m }}>
          <div
            style={{
              position: "absolute",
              left: (m - aro) / 2,
              top: 0,
              width: aro,
              height: aro,
              borderRadius: aro / 2,
              backgroundColor: BLANCO,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: (m - hueco) / 2,
              top: pared,
              width: hueco,
              height: hueco,
              borderRadius: hueco / 2,
              backgroundColor: AZUL,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: paloX,
              top: aro * 0.9,
              width: palo,
              height: m - aro * 0.9,
              borderRadius: palo / 2,
              backgroundColor: BLANCO,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: dienteX,
              top: m * 0.6,
              width: dienteAncho,
              height: dienteAlto,
              borderRadius: dienteAlto / 2,
              backgroundColor: BLANCO,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: dienteX,
              top: m * 0.79,
              width: dienteAncho,
              height: dienteAlto,
              borderRadius: dienteAlto / 2,
              backgroundColor: BLANCO,
            }}
          />
        </div>
      </div>
    ),
    {
      width: lado,
      height: lado,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
