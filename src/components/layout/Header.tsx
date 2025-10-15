// src/components/layout/Header.tsx
'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

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
        <div className="flex items-center space-x-4">
          <Link href="/" className="text-xl font-bold text-gray-800">
            Dashboard
          </Link>
          {/* ✨ KORREKTUR: Die Begrüßung ist jetzt hier */}
          {status === 'authenticated' && (
            <span className="text-gray-700">
              Hallo, {session.user?.name ?? session.user?.email}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {status === 'authenticated' && (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-100"
                >
                  Admin-Bereich
                </Link>
              )}
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
