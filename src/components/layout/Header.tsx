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
              width={400}
              height={102}
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

        {/* Rechte Seite: Links und Buttons */}
        <div className="flex items-center space-x-4">
          {status === 'authenticated' && (
            <>
              <Link href="/" passHref>
                <Button>Projekte</Button>
              </Link>

              {isAdmin && (
                <Link href="/admin" passHref>
                  <Button>Admin-Bereich</Button>
                </Link>
              )}

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
