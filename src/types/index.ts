// Definiert die Struktur eines Benutzer-Objekts, wie es in der Datenbank gespeichert wird.
export interface User {
  id: string;
  email: string;
  password?: string; // Das Passwort sollte nie an das Frontend gesendet werden
  role: 'SUPERADMIN' | 'ADMIN' | 'BENUTZER';
  domain?: string;
  createdByAdminId?: string;
  createdAt: Date;
}
