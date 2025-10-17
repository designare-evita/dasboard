// src/components/layout/Header.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image'; // NEU: Importiert für das Logo
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button'; // NEU: Importiert für den Button

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';

  // Header nicht auf der Login-Seite anzeigen
  if (pathname === '/login') {
    return null;
  }

  return (
    <header className="bg-white shadow-md">
      <nav className="container mx-auto px-6 py-3 flex justify-between items-center">
        
        {/* Linke Seite: Logo und Begrüßung */}
        <div className="flex items-center space-x-4">
          
          {/* GEÄNDERT: "Dashboard"-Text durch Logo ersetzt */}
          <Link href="/">
            <Image
              src="/logo-data-peak.webp"
              alt="Data Peak Logo"
              width={DEINE_LOGO_BREITE}  // z.B. 180 (Bitte ersetzen)
              height={DEINE_LOGO_HOEHE} // z.B. 45 (Bitte ersetzen)
              priority
              // Optional: Größe mit Tailwind steuern
              // className="h-10 w-auto" 
            />
          </Link>

          {/* BEIBEHALTEN: "Hallo"-Nachricht */}
          {status === 'authenticated' && (
            <span className="text-gray-700">
              Hallo, {session.user?.name ?? session.user?.email}
            </span>
          )}
        </div>

        {/* Rechte Seite: Links und Buttons */}
        <div className="flex items-center space-x-4">
          {status === 'authenticated' && (
            <>
              {/* NEU: "Projekten"-Button hinzugefügt */}
              <Link href="/" passHref>
                <Button variant="outline" size="sm">
                  Projekten
                </Button>
              </Link>

              {/* BEIBEHALTEN: Admin-Bereich Link */}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-100"
                >
                  Admin-Bereich
                </Link>
              )}

              {/* BEIBEHALTEN: Abmelde-Button */}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-100"
              >
                Abmelden
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
