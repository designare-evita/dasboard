// src/components/layout/Header.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button'; // Wird jetzt für alle 3 Buttons genutzt

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
          
          {/* Logo */}
          <Link href="/">
            <Image
              src="/logo-data-peak.webp"
              alt="Data Peak Logo"
              width={180}
              height={45}
              priority
            />
          </Link>

          {/* "Hallo"-Nachricht */}
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
              {/* GEÄNDERT: "Projekten"-Button. 
                variant="outline" und size="sm" entfernt, 
                damit er den neuen default-Stil aus button.tsx verwendet.
              */}
              <Link href="/" passHref>
                <Button>Projekte</Button>
              </Link>

              {/* GEÄNDERT: Admin-Bereich Link.
                Verwendet jetzt die <Button> Komponente für Konsistenz.
              */}
              {isAdmin && (
                <Link href="/admin" passHref>
                  <Button>Admin-Bereich</Button>
                </Link>
              )}

              {/* GEÄNDERT: Abmelde-Button.
                Verwendet jetzt die <Button> Komponente für Konsistenz.
              */}
              <Button onClick={() => signOut({ callbackUrl: '/login' })}>
                Abmelden
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
