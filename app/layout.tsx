import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vértice · Red de financieras aliadas",
  description:
    "Vértice estructura los criterios crediticios de tu institución en una entrevista de doce minutos. Tu mesa recibe solicitudes preprocesadas que cumplen tu política. Reduces tiempo de screening y aumentas conversión.",
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
        {children}
      </body>
    </html>
  );
}
