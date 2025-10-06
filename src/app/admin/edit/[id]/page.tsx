import Header from '@/components/layout/Header';
import EditUserForm from './EditUserForm';
import type { User } from '@/types';
import { headers } from 'next/headers';


// Hilfsfunktion: Origin zur Laufzeit ermitteln (funktioniert lokal & auf Vercel)
async function getBaseUrl() {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

async function getUser(id: string): Promise<Partial<User> | null> {
  try {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/api/users/${id}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ⚠️ Kein lokaler Typname "PageProps" – direkt inline typisieren
export default async function EditUserPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const user = await getUser(id);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Header />
        <main className="mt-6">
          {!user ? (
            <div className="p-8 text-center bg-white rounded-lg shadow-md">
              <h2 className="text-xl font-bold text-red-600">Benutzer nicht gefunden</h2>
              <p className="mt-2 text-gray-600">Bitte zurück zur Übersicht.</p>
              <a
                href="/admin"
                className="mt-4 inline-block bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
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
