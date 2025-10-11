// src/app/admin/page.tsx

'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { User } from '@/types'; // Annahme: Du hast einen User-Typ in @/types

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State für das Formular
  const [email, setEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [role, setRole] = useState('USER');
  const [gscSiteUrl, setGscSiteUrl] = useState('');
  const [ga4PropertyId, setGa4PropertyId] = useState('');

  // State für die Benutzerliste
  const [userList, setUserList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Funktion zum Abrufen der Benutzer
  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      setUserList(data);
    } catch (error) {
      console.error('Fehler beim Abrufen der Benutzer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Benutzer beim Laden der Seite abrufen
  useEffect(() => {
    if (session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN') {
      fetchUsers();
    }
  }, [session]);

  // Authentifizierungs-Check
  if (status === 'loading') return <div className="p-8 text-center">Lade...</div>;
  if (status === 'unauthenticated' || (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN')) {
    router.push('/');
    return null;
  }

  // Handler für das Absenden des Formulars
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // ... (deine bestehende handleSubmit-Logik)
  };

  // Handler zum Löschen von Benutzern
  const handleDeleteUser = async (userId: number) => {
    // ... (deine bestehende handleDelete-Logik)
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>

      {/* Formular zum Erstellen von Benutzern */}
      <div className="mb-8">
        {/* ... (dein bestehendes Formular) */}
      </div>

      {/* Benutzerliste */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Benutzerliste</h2>
        {isLoading ? (
          <p>Lade Benutzer...</p>
        ) : (
          <ul className="space-y-2">
            {userList.map((user: User) => (
              <li key={user.id} className="p-2 border rounded flex justify-between items-center">
                <span>{user.email} - {user.role}</span>
                <button
                  onClick={() => handleDeleteUser(Number(user.id))}
                  className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
