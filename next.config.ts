import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las pantallas de alquileres vivian en la raiz cuando la app era solo eso.
  // Un acceso guardado o un atajo del celular a la ruta vieja sigue andando.
  async redirects() {
    return [
      { source: "/cobros", destination: "/alquileres/cobros", permanent: true },
      { source: "/contratos", destination: "/alquileres/contratos", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // El service worker tiene que poder tomar control de todo el origen y
        // no quedar cacheado por el CDN, si no una version vieja se queda pegada.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
