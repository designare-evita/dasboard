// src/components/layout/Header.tsx
'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
// Der fehlerhafte Import der Button-Komponente wurde entfernt.

const Header = () => {
  const { data: session, status } = useSession();

  // Lade-Platzhalter (unverändert)
  if (status === 'loading') {
    return (
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 animate-pulse">
          <div className="flex items-center justify-between h-full">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/6"></div>
          </div>
        </div>
      </header>
    );
  }

  const user = session?.user;
  const isAdminOrSuperAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Linker Bereich (unverändert) */}
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-blue-600 hover:text-blue-800">
              SEO-Dashboard
            </Link>
            {isAdminOrSuperAdmin && (
              <Link href="/admin" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Admin Bereich
              </Link>
            )}
          </div>

          {/* Rechter Bereich (angepasst) */}
          <div className="flex items-center gap-4">
            {user?.email && (
              <p className="text-sm text-gray-600 hidden sm:block">
                Hallo, <span className="font-medium">{user.email}</span>
              </p>
            )}
            {/* HIER IST DIE KORREKTUR:
              Die <Button>-Komponente wurde durch einen normalen <button>-Tag ersetzt
              und direkt mit Tailwind CSS Klassen gestylt.
            */}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-transparent border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Abmelden
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
