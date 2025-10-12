// src/app/(auth)/login/page.tsx

// ✅ KORREKTUR: Wir importieren Suspense
import { Suspense } from 'react';
import LoginForm from './LoginForm'; // Wir erstellen eine neue Komponente für das Formular

// Die Hauptseitenkomponente ist jetzt sehr einfach.
// Sie rendert die Suspense-Grenze und darin unsere neue Formular-Komponente.
export default function LoginPage() {
  return (
    // Suspense sorgt dafür, dass der Inhalt client-seitig gerendert wird,
    // ohne den serverseitigen Build-Prozess zu blockieren.
    <Suspense fallback={<div>Wird geladen...</div>}>
      <LoginForm />
    </Suspense>
  );
}
