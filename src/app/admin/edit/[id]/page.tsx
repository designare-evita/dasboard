// @/app/admin/users/[id]/edit/page.tsx

import Header from '@/components/layout/Header';
import EditUserForm from './EditUserForm';
import type { User } from '@/types';

// HINZUGEFÜGT: Ein Platzhalter-Benutzerobjekt
const mockUser: Partial<User> = {
  email: 'test@beispiel.com',
  name: 'Max Mustermann',
};

// 👇 ANPASSUNG HIER: Der Typ für die Props wird direkt hier definiert.
// Die explizite "PageProps" Definition ist nicht mehr nötig.
export default function EditUserPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const user = mockUser;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Header />
        <main className="mt-6">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6">
              Benutzer <span className="text-indigo-600">{user.email}</span> bearbeiten
            </h2>
            <EditUserForm id={id} user={user} />
          </div>
        </main>
      </div>
    </div>
  );
}
