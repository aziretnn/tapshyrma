import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Тапшырма — конструктор технических заданий",
  description:
    "Подготовка технических заданий на информационные системы по структуре ГОСТ 34.602 для государственных органов Кыргызской Республики.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Literata:opsz,wght@7..72,400;7..72,600;7..72,700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
