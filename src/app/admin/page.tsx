// src/app/admin/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return <div>Lade...</div>;
  }

  // @ts-expect-error // Wir erwarten hier einen Fehler, da 'role' nicht im Standard-Typ enthalten ist
  if (status === 'unauthenticated' || (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN')) {
    // Wenn nicht eingeloggt oder keine Admin-Rechte, zur Startseite umleiten
    router.push('/');
    return null;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Admin Bereich</h1>
      <p className="mt-4">Willkommen im Admin-Bereich. Hier können Sie neue Kunden anlegen und verwalten.</p>

      {/* Hier kommt als Nächstes das Formular zum Anlegen neuer Kunden hin */}
    </div>
  );
}
