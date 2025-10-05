'use client'; // Diese Seite ist interaktiv

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  // Der useSession-Hook ist der Weg, um an die Daten des eingeloggten Benutzers zu kommen.
  const { data: session, status } = useSession();
  const router = useRouter();

  // Während die Session geladen wird, zeigen wir einen Ladebildschirm an.
  if (status === "loading") {
    return <div>Lade...</div>;
  }

  // Wenn der Benutzer nicht eingeloggt ist (sollte durch die Middleware nicht passieren, aber ist eine gute Absicherung)
  if (status === "unauthenticated") {
    router.push('/login');
    return null;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Willkommen im Dashboard!</h1>
        <button 
          onClick={() => signOut({ callbackUrl: '/login' })} 
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        >
          Abmelden
        </button>
      </div>

      <div>
        <p>Sie sind eingeloggt als:</p>
        <pre className="bg-gray-100 p-4 rounded-md mt-2">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
    </div>
  );
}
