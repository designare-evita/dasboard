// @/app/admin/users/[id]/edit/page.tsx

import Header from '@/components/layout/Header';
import EditUserForm from './EditUserForm';
import type { User } from '@/types';

// ✅ Der PageProps-Typ bleibt unverändert
export type PageProps = { params: { id: string } };

// HINZUGEFÜGT: Ein Platzhalter-Benutzerobjekt
// Dieses Objekt simuliert die Daten, die normalerweise von der API kommen würden.
// Du kannst die Werte hier anpassen, um verschiedene Szenarien zu testen.
const mockUser: Partial<User> = {
  email: 'test@beispiel.com',
  name: 'Max Mustermann',
  // Füge hier weitere Benutzereigenschaften hinzu, die dein Formular benötigt
};

// Die Komponente ist nicht mehr "async", da wir nicht auf eine Datenabfrage warten.
export default function EditUserPage({ params }: PageProps) {
  const { id } = params;
  
  // Wir verwenden direkt unser Platzhalter-Objekt anstatt "await getUser(id)".
  const user = mockUser;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Header />
        <main className="mt-6">
          {/* Die Logik zur Anzeige des Formulars bleibt fast gleich.
            Anstatt zu prüfen, ob der Benutzer nicht gefunden wurde, zeigen wir
            das Formular direkt mit den Platzhalterdaten an.
          */}
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6">
              Benutzer <span className="text-indigo-600">{user.email}</span> bearbeiten
            </h2>
            {/* Das Formular erhält den Platzhalter-Benutzer als Prop */}
            <EditUserForm id={id} user={user} />
          </div>
        </main>
      </div>
    </div>
  );
}
