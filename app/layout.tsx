import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { RegistrarSW } from "@/components/PWA";
import "./globals.css";

// Las dos se sirven desde la app (next/font): sin pedido a Google al abrir,
// y la PWA las tiene aunque no haya conexión.
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  axes: ["opsz", "wdth"],
});

export const metadata: Metadata = {
  title: "Dinerillo",
  description: "Tu plata del mes: ingresos, gastos, alquileres y lo que dividís en pareja.",
  applicationName: "Dinerillo",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Dinerillo",
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
  themeColor: "#1d52de",
  width: "device-width",
  initialScale: 1,
  // Sin maximumScale: bloquear el zoom rompe la accesibilidad.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${figtree.variable} ${bricolage.variable}`}>
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
