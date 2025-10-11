// src/app/layout.tsx

import type { Metadata } from "next";
// HIER IST DIE ÄNDERUNG: Wir importieren Poppins anstelle von Inter
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer"; // Annahme: Footer existiert bereits

// Konfiguriert den Poppins-Font mit den gewünschten Schriftschnitten
const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"] // Regular, Medium, Semi-Bold, Bold
});

export const metadata: Metadata = {
  title: "SEO Dashboard",
  description: "Ihr persönliches SEO Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      {/* HIER IST DIE ÄNDERUNG: Wir wenden die poppins-Klasse an */}
      <body className={`${poppins.className} bg-gray-50`}>
        <Providers>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow p-8">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
