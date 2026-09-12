import type { Metadata, Viewport } from "next";
import { RegistrarSW } from "@/components/PWA";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rentifay",
  description: "Control de alquileres: cobros, aumentos, servicios y rentabilidad.",
  applicationName: "Rentifay",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Rentifay",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icono-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icono-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1f4b6e",
  width: "device-width",
  initialScale: 1,
  // Sin maximumScale: bloquear el zoom rompe la accesibilidad.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
