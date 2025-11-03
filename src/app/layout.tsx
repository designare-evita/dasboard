import type { Metadata } from "next";
// ✅ KORREKTUR: Wir importieren Poppins, wie von dir gewünscht.
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
// ✅ KORREKTUR: Wir importieren die neue MainLayout-Komponente.
import MainLayout from '@/components/MainLayout';

// Konfiguriert den Poppins-Font
const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: 'Data Peak | SEO & Analytics Dashboard',
  description:
    'Data Peak ist das zentrale Dashboard zur Analyse Ihrer Web-Performance. Verbinden Sie Google Search Console, Analytics & Semrush für einheitliches KPI-Reporting.',
  icons: {
    icon: '/favicon.ico',
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      {/* Wir wenden die Poppins-Font-Klasse an */}
      <body className={`${poppins.className} bg-gray-50`}>
        <Providers>
          {/* MainLayout kümmert sich jetzt um die Anzeige von Header/Footer
            und erhält die Kinder (die eigentlichen Seiteninhalte).
          */}
          <MainLayout>
            {children}
          </MainLayout>
        </Providers>
      </body>
    </html>
  );
}
