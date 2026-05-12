import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SmoothScroll } from "@/components/providers/smooth-scroll";

export const metadata: Metadata = {
  title: "Vértice · Red de financieras aliadas",
  description:
    "Vértice estructura los criterios crediticios de tu institución en una entrevista de doce minutos. Tu mesa recibe solicitudes preprocesadas que cumplen tu política. Reduces tiempo de screening y aumentas conversión.",
};

// Viewport meta — crítico para mobile. Sin `width=device-width` los browsers
// móviles renderizan en viewport virtual de 980px y aplican zoom-out → tipografía
// ilegible. `userScalable: true` + `maximumScale: 5` cumple WCAG 1.4.4 (zoom).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0a1f44",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f%5B%5D=satoshi@300,400,500,700,900&f%5B%5D=general-sans@300,400,500,600,700&display=swap"
        />
      </head>
      <body className="min-h-full bg-canvas text-foreground flex flex-col">
        {/* Smooth scroll global (Lenis 1.3.x). Cubre landing, encuesta y
            admin. Respeta prefers-reduced-motion: si está activo, devuelve
            children sin Lenis (scroll nativo). Resetea scroll a top en cada
            route change. */}
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
