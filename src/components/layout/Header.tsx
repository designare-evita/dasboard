'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link'; // Importieren Sie die Link-Komponente

export default function Header() {
  const { data: session } = useSession();
  
  // Der @ts-ignore-Kommentar wurde entfernt, da er nicht mehr benötigt wird
  const userRole = session?.user?.role;

  return (
    <header className="flex justify-between items-center mb-8">
      <div className="flex items-center gap-4">
        {/* Der <a>-Tag wurde durch die <Link>-Komponente ersetzt */}
        <Link href="/" className="text-3xl font-bold">Dashboard</Link>
        
        {userRole === 'ADMIN' || userRole === 'SUPERADMIN' ? (
           <Link href="/admin" className="text-blue-500 hover:underline">
            Admin Bereich
          </Link>
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

