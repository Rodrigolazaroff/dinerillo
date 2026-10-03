import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dinerillo",
    short_name: "Dinerillo",
    description: "Tu plata del mes: ingresos, gastos, alquileres y lo que dividís en pareja.",
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
      { src: "/icons/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      /*
       * Android recorta el icono con la forma que tenga el launcher (círculo,
       * squircle, gota). Sin una entrada maskable con aire de sobra usa la de
       * "any" y le come los bordes a la marca.
       */
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Cargar gasto",
        short_name: "Gasto",
        description: "Anotar un gasto tuyo.",
        url: "/gastos?nuevo=1",
        icons: [{ src: "/icons/icono-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Gasto compartido",
        short_name: "Compartido",
        description: "Anotar un gasto para dividir.",
        url: "/division?nuevo=1",
        icons: [{ src: "/icons/icono-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
