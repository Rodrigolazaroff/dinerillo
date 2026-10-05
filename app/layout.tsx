import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { RegistrarSW } from "@/components/PWA";
import { ReportarErrores } from "@/components/ReportarErrores";
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
  description: "Tu plata del mes en un solo lugar: lo que entra, lo que sale y lo que dividís.",
  applicationName: "Dinerillo",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Dinerillo",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  // La tarjeta del link al compartirlo (WhatsApp, LinkedIn). El dominio va
  // fijo: sin él, Next arma la URL de la imagen con el dominio que elige Vercel
  // (rentifay.vercel.app, el nombre viejo) y no con el que se comparte. La
  // imagen va en /public, PNG y sin `?hash` en la URL, como la de un sitio que
  // WhatsApp sí muestra grande.
  // WhatsApp pide og:title, og:description, og:url y og:image; si falta alguna
  // "relaja los requisitos" y muestra la tarjeta chica. La descripción, de
  // unos 80 caracteres como máximo.
  metadataBase: new URL("https://dinerillo-app.vercel.app"),
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Dinerillo",
    url: "/",
    title: "Dinerillo · Tu plata del mes en un solo lugar",
    description: "Mirá si el mes fue bueno, cuánto gastaste y si cumplís tu meta de ahorro.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Dinerillo: tu plata del mes en un solo lugar. Ingresos, gastos, ahorro y gastos en pareja.",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: [
      { url: "/icons/icono-192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/icons/icono-512.png?v=2", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-180.png?v=2", sizes: "180x180", type: "image/png" }],
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
        <ReportarErrores />
      </body>
    </html>
  );
}
