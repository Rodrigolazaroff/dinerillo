import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dinerillo",
    short_name: "Dinerillo",
    description: "Tu plata del mes en un solo lugar: lo que entra, lo que sale y lo que dividís.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f8fc",
    theme_color: "#1d52de",
    lang: "es-AR",
    dir: "ltr",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icono-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icono-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      /*
       * Android recorta el icono con la forma que tenga el launcher (círculo,
       * squircle, gota). Sin una entrada maskable con aire de sobra usa la de
       * "any" y le come los bordes a la marca.
       */
      { src: "/icons/maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Cargar gasto",
        short_name: "Gasto",
        description: "Anotar un gasto tuyo.",
        url: "/gastos?nuevo=1",
        icons: [{ src: "/icons/icono-192.png?v=2", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
