import Header from '@/components/layout/Header';
import EditUserForm from './EditUserForm'; // Client-Komponente (Schritt 2)
import { User } from '@/types';

type PageProps = {
  params: { id: string };
};

async function getUser(id: string): Promise<Partial<User> | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/users/${id}`, {
      method: 'GET',
      cache: 'no-store', // immer frische Daten
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function EditUserPage({ params }: PageProps) {
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

              {/* Client-Formular übernimmt Submit/State-Logik */}
              <EditUserForm id={id} user={user} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
