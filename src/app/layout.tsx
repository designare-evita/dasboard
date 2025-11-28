import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import MainLayout from '@/components/MainLayout';
import { Toaster } from 'sonner';
import * as Sentry from '@sentry/nextjs'; // ✅ NEU: Sentry Import

// Konfiguriert den Poppins-Font
const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

// ✅ ÄNDERUNG: Von "const metadata" zu "function generateMetadata"
export function generateMetadata(): Metadata {
  return {
    title: 'Data Peak | SEO & Analytics Dashboard',
    description:
      'Data Peak ist das zentrale Dashboard zur Analyse Ihrer Web-Performance. Verbinden Sie Google Search Console, Analytics & Semrush für einheitliches KPI-Reporting.',
    icons: {
      icon: '/favicon.ico',
    },
    // Hier werden die Sentry Trace Daten für das Backend-Frontend-Tracing injiziert
    other: {
      ...Sentry.getTraceData()
    }
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${poppins.className} bg-gray-50`}>
        <Providers>
          {/* Toaster für Benachrichtigungen */}
          <Toaster position="top-right" richColors closeButton />
          
          <MainLayout>
            {children}
          </MainLayout>
        </Providers>
      </body>
    </html>
  );
}
