// src/app/admin/edit/[id]/page.tsx

import Header from '@/components/layout/Header';
import EditUserForm from './EditUserForm';
import type { User } from '@/types';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export type PageProps = { params: Promise<{ id: string }> };

async function getUser(id: string): Promise<Partial<User> | null> {
  try {
    // Authentifizierung prüfen
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return null;
    }

    // Direkt aus der Datenbank lesen statt fetch
    const { rows } = await sql<User>`
      SELECT id, email, role, domain, gsc_site_url, ga4_property_id 
      FROM users 
      WHERE id = ${id}
    `;
    
    if (rows.length === 0) {
      return null;
    }
    
    return rows[0];
  } catch (error) {
    console.error('Fehler beim Laden des Benutzers:', error);
    return null;
  }
}

export default async function EditUserPage({ params }: PageProps) {
  // Session prüfen
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    redirect('/');
  }

  const { id } = await params;
  const user = await getUser(id);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <main className="mt-6">
          {!user ? (
            <div className="p-8 text-center bg-white rounded-lg shadow-md">
              <h2 className="text-xl font-bold text-red-600">Benutzer nicht gefunden</h2>
              <a href="/admin" className="mt-4 inline-block bg-blue-600 text-white py-2 px-4 rounded-md">
                Zurück zur Übersicht
              </a>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold mb-6">
                Benutzer <span className="text-indigo-600">{user.email}</span> bearbeiten
              </h2>
              <EditUserForm id={id} user={user} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
