// src/components/layout/Header.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell';
// ✅ NEU: useState für den Toggle-Status und Icons importieren
import { useState } from 'react';
import { List, X } from 'react-bootstrap-icons';

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname(); 
  
  // ✅ NEU: State für das mobile Menü
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN'; 
  const isUser = session?.user?.role === 'BENUTZER'; 

  if (pathname === '/login') { 
    return null;
  }

  // ✅ NEU: Funktion, um das Menü bei Link-Klick zu schließen
  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    // ✅ 'relative' hinzugefügt, damit das Dropdown-Menü sich daran ausrichtet
    <header className="bg-white shadow-md relative">
      <nav className="container mx-auto px-6 py-3 flex justify-between items-center">

        {/* Linke Seite: Logo und Begrüßung */}
        <div className="flex items-center space-x-4">
          <Link href="/" onClick={handleLinkClick}>
            <Image
              src="/logo-data-peak.webp"
              alt="Data Peak Logo"
              width={180}
              height={45}
              priority
            />
          </Link>

          {status === 'authenticated' && (
            <>
              {/* ✅ 'hidden md:block' hinzugefügt, um auf Mobilgeräten Platz zu sparen */}
              <span className="text-gray-600 underline underline-offset-6 hidden md:block">
                Hallo, {session.user?.name ?? session.user?.email}
              </span>
              <span className="text-gray-500 text-sm hidden lg:block">
                💡 GOOGLE Datenaktualisierung alle 48 Stunden | SEMRUSH Datenaktualisierung alle 14 Tage.
              </span>
            </>
          )}
        </div>

        {/* ✅ Rechte Seite (Desktop) - wird auf Mobilgeräten versteckt */}
        <div className="hidden md:flex items-center space-x-4">
          {status === 'authenticated' && (
            <>
              {/* Benachrichtigungs-Glocke */}
              <NotificationBell />

              {/* Projekte Button (nur für Admins) */}
              {isAdmin && (
                <Link href="/" passHref>
                  <Button variant={pathname === '/' ? 'default' : 'outline'}>
                    Projekte
                  </Button>
                </Link>
              )}

              {/* Redaktionsplan Button (nur für Admins) */}
              {isAdmin && (
                <Link href="/admin/redaktionsplan" passHref>
                  <Button variant={pathname === '/admin/redaktionsplan' ? 'default' : 'outline'}>
                    Redaktionspläne
                  </Button>
                </Link>
              )}

              {/* Admin-Bereich Button (nur für Admins) */}
              {isAdmin && (
                <Link href="/admin" passHref>
                  <Button variant={pathname === '/admin' ? 'default' : 'outline'}>
                    Admin-Bereich
                  </Button>
                </Link>
              )}

              {/* Dashboard Button (nur für BENUTZER) */}
              {isUser && (
                <Link href="/" passHref>
                  <Button variant={pathname === '/' ? 'default' : 'outline'}>
                    Dashboard
                  </Button>
                </Link>
              )}

              {/* Redaktionsplan Button (nur für BENUTZER) */}
              {isUser && (
                <Link href="/dashboard/freigabe" passHref>
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
               <Button variant="default">Anmelden</Button>
             </Link>
          )}
        </div>

        {/* ✅ NEU: Hamburger-Button (Mobilgeräte) */}
        <div className="md:hidden flex items-center">
          {/* Zeige die Glocke auch auf Mobilgeräten an */}
          {status === 'authenticated' && <NotificationBell />}
          
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-600 hover:text-gray-900 p-2 ml-2"
            aria-label="Menü umschalten"
          >
            {isMobileMenuOpen ? <X size={28} /> : <List size={28} />}
          </button>
        </div>
      </nav>

      {/* ✅ NEU: Mobiles Dropdown-Menü */}
      {isMobileMenuOpen && status === 'authenticated' && (
        <div 
          className="md:hidden absolute top-full left-0 w-full bg-white shadow-lg border-t border-gray-100 z-50"
          onClick={handleLinkClick} // Schließt das Menü, wenn auf einen Link geklickt wird
        >
          <div className="flex flex-col space-y-2 p-4">
            
            {/* Links für Admins */}
            {isAdmin && (
              <>
                <Link href="/" passHref>
                  <Button variant={pathname === '/' ? 'default' : 'outline'} className="w-full justify-start">
                    Projekte
                  </Button>
                </Link>
                <Link href="/admin/redaktionsplan" passHref>
                  <Button variant={pathname === '/admin/redaktionsplan' ? 'default' : 'outline'} className="w-full justify-start">
                    Redaktionspläne
                  </Button>
                </Link>
                <Link href="/admin" passHref>
                  <Button variant={pathname === '/admin' ? 'default' : 'outline'} className="w-full justify-start">
                    Admin-Bereich
                  </Button>
                </Link>
              </>
            )}

            {/* Links für Benutzer */}
            {isUser && (
              <>
                <Link href="/" passHref>
                  <Button variant={pathname === '/' ? 'default' : 'outline'} className="w-full justify-start">
                    Dashboard
                  </Button>
                </Link>
                <Link href="/dashboard/freigabe" passHref>
                  <Button variant={pathname === '/dashboard/freigabe' ? 'default' : 'outline'} className="w-full justify-start">
                    Redaktionsplan
                  </Button>
                </Link>
              </>
            )}
            
            <hr className="my-2" />

            {/* Abmelden-Button */}
            <Button variant="outline" className="w-full justify-start" onClick={() => signOut({ callbackUrl: '/login' })}>
              Abmelden
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
