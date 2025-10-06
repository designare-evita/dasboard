import Header from '@/components/layout/Header';
import EditUserForm from './EditUserForm';
import type { User } from '@/types';
import { headers } from 'next/headers';

// ✅ KORRIGIERT: params muss ein Promise sein in Next.js 15
export type PageProps = { params: Promise<{ id: string }> };

async function getBaseUrl() {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

async function getUser(id: string): Promise<Partial<User> | null> {
  try {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/api/users/${id}`, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function EditUserPage({ params }: PageProps) {
  // ✅ KORRIGIERT: params muss mit await aufgelöst werden
  const { id } = await params;
  const user = await getUser(id);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Header />
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
