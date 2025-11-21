// src/app/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ArrowRepeat } from 'react-bootstrap-icons';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      // Prüfen, ob Admin oder User
      if (session?.user?.role === 'admin' || session?.user?.role === 'superadmin') {
        router.push('/admin');
      } else {
        // Normale User zur Projekt-Seite weiterleiten (falls ID vorhanden)
        // Hier nehmen wir an, die ID ist in der Session oder wir leiten zu einer Auswahl weiter
        // Fallback:
        if (session?.user?.id) {
           router.push(`/projekt/${session.user.id}`);
        } else {
           // Sollte eigentlich nicht passieren bei eingeloggten Usern ohne ID
           console.error("User logged in but no ID found");
        }
      }
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, session, router]);

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <ArrowRepeat className="animate-spin text-indigo-600" size={40} />
    </div>
  );
}
