// src/components/layout/Header.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell'; // Importiere die Glocken-Komponente

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
  <span className="text-gray-600 underline underline-offset-6">
    Hallo, {session.user?.name ?? session.user?.email}
  </span>
)}
        </div>

{/* Rechte Seite: Links, Buttons und Glocke */}
        <div className="flex items-center space-x-4">
          {status === 'authenticated' && (
            <>
  {/* NEU: Benachrichtigungs-Glocke */}
              <NotificationBell />

                  {/* NEU: Redaktionsplan Button (nur für Admins, Standard-Stil) */}
              {isAdmin && (
                <Link href="/admin/redaktionsplan" passHref>
                  <Button>Redaktionsplan</Button> {/* Nutzt den Standard-Button-Stil */}
                </Link>
              )}
  
              {/* Projekte-Button (Standard-Stil) */}
              <Link href="/" passHref>
                <Button variant="ghost" className="hidden sm:inline-flex">Projekte</Button>
              </Link>

              {/* Admin-Bereich Button (nur für Admins, Standard-Stil) */}
              {isAdmin && (
                <Link href="/admin" passHref>
                  <Button variant="ghost" className="hidden sm:inline-flex">Admin-Bereich</Button>
                </Link>
              )}


              {/* Abmelden-Button (Ghost-Stil für weniger Betonung) */}
              <Button variant="ghost" onClick={() => signOut({ callbackUrl: '/login' })}>
                Abmelden
              </Button>
            </>
          )}
          {status === 'unauthenticated' && (
             <Link href="/login" passHref>
               <Button>Anmelden</Button>
             </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
