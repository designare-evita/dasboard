// src/components/layout/Header.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell'; //

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname(); //

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN'; //
  const isUser = session?.user?.role === 'BENUTZER'; //

  // Header nicht auf der Login-Seite anzeigen
  if (pathname === '/login') { //
    return null;
  }

  return (
    <header className="bg-white shadow-md"> {/* */}
      <nav className="container mx-auto px-6 py-3 flex justify-between items-center"> {/* */}

        {/* Linke Seite: Logo und Begrüßung */}
        <div className="flex items-center space-x-4"> {/* */}

          {/* Logo */}
          <Link href="/"> {/* */}
            <Image
              src="/logo-data-peak.webp"
              alt="Data Peak Logo"
              width={180}
              height={45}
              priority
            /> {/* */}
          </Link>

          {/* "Hallo"-Nachricht (SYNTAX-FEHLER KORRIGIERT) */}
          {status === 'authenticated' && (
            <span className="text-gray-600 underline underline-offset-6">
              Hallo, {session.user?.name ?? session.user?.email}
            </span> //
          )}
        </div>

        {/* Rechte Seite: Links, Buttons und Glocke */}
        <div className="flex items-center space-x-4"> {/* */}
          {status === 'authenticated' && (
            <>
              {/* Benachrichtigungs-Glocke */}
              <NotificationBell /> {/* */}

              {/* Projekte Button (nur für Admins) */}
              {isAdmin && (
                <Link href="/" passHref>
                  {/* KORRIGIERT: 'variant' prüft den Pfad. 'default' ist blau. */}
                  <Button variant={pathname === '/' ? 'default' : 'outline'}>
                    Projekte
                  </Button>
                </Link>
              )}

              {/* Redaktionsplan Button (nur für Admins) */}
              {isAdmin && (
                <Link href="/admin/redaktionsplan" passHref>
                  {/* KORRIGIERT: 'variant' prüft den Pfad. */}
                  <Button variant={pathname === '/admin/redaktionsplan' ? 'default' : 'outline'}>
                    Redaktionspläne
                  </Button>
                </Link>
              )}

              {/* Admin-Bereich Button (nur für Admins) */}
              {isAdmin && (
                <Link href="/admin" passHref>
                  {/* KORRIGIERT: 'variant' prüft den Pfad. */}
                  <Button variant={pathname === '/admin' ? 'default' : 'outline'}>
                    Admin-Bereich
                  </Button>
                </Link>
              )}

              {/* Dashboard Button (nur für BENUTZER) */}
              {isUser && (
                <Link href="/" passHref>
                  {/* KORRIGIERT: 'variant' prüft den Pfad. */}
                  <Button variant={pathname === '/' ? 'default' : 'outline'}>
                    Dashboard
                  </Button>
                </Link>
              )}

              {/* Redaktionsplan Button (nur für BENUTZER) */}
              {isUser && (
                <Link href="/dashboard/freigabe" passHref>
                  {/* KORRIGIERT: 'variant' prüft den Pfad. */}
                  <Button variant={pathname === '/dashboard/freigabe' ? 'default' : 'outline'}>
                    Redaktionsplan
                  </Button>
                </Link>
              )}

              {/* Abmelden-Button (outline, da keine aktive Seite) */}
              <Button variant="outline" onClick={() => signOut({ callbackUrl: '/login' })}>
                Abmelden
              </Button>
            </>
          )}
          {status === 'unauthenticated' && (
             <Link href="/login" passHref>
               {/* 'default' (blau) ist hier korrekt als Call-to-Action */}
               <Button variant="default">Anmelden</Button>
             </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
