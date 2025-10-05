// src/components/layout/Header.tsx
'use client';

import { useSession, signOut } from 'next-auth/react';

export default function Header() {
  const { data: session } = useSession();
  
  // @ts-ignore
  const userRole = session?.user?.role;

  return (
    <header className="flex justify-between items-center mb-8">
      <div className="flex items-center gap-4">
        <a href="/" className="text-3xl font-bold">Dashboard</a>
        {userRole === 'ADMIN' || userRole === 'SUPERADMIN' ? (
          <a href="/admin" className="text-blue-500 hover:underline">
            Admin Bereich
          </a>
        ) : null}
      </div>
      <button 
        onClick={() => signOut({ callbackUrl: '/login' })} 
        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
      >
        Abmelden
      </button>
    </header>
  );
}
