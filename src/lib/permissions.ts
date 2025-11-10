// src/lib/permissions.ts

import { sql } from '@vercel/postgres';
import type { Session } from 'next-auth';
import { User } from '@/types';

/**
 * Prüft, ob ein eingeloggter Benutzer (Admin oder Kunde) 
 * Zugriff auf ein bestimmtes Projekt (Kunde) hat.
 * * @param session Das NextAuth-Session-Objekt des eingeloggten Benutzers.
 * @param projectId Die UUID des Ziel-Projekts (Kunden), auf das zugegriffen wird.
 * @returns boolean
 */
export async function canAccessProject(session: Session | null, projectId: string): Promise<boolean> {
  if (!session?.user?.id || !projectId) {
    return false;
  }

  const { role, id: userId } = session.user;

  // 1. Superadmins dürfen alles sehen
  if (role === 'SUPERADMIN') {
    return true;
  }

  // 2. Benutzer (Kunde) dürfen nur ihr eigenes "Projekt" sehen
  if (role === 'BENUTZER') {
    return userId === projectId;
  }

  // 3. Admins dürfen nur Projekte sehen, denen sie zugewiesen sind
  if (role === 'ADMIN') {
    try {
      const { rows } = await sql`
        SELECT 1 
        FROM project_assignments
        WHERE user_id::text = ${userId} AND project_id::text = ${projectId}
        LIMIT 1;
      `;
      // Zugriff gewährt, wenn ein Eintrag gefunden wurde
      return rows.length > 0;
    } catch (error) {
      console.error("[Permissions] Fehler bei 'project_assignments' Abfrage:", error);
      return false; // Im Fehlerfall Zugriff verweigern
    }
  }

  // Fallback
  return false;
}

/**
 * Prüft, ob ein Benutzer die Berechtigung hat, Admin-Zuweisungen
 * oder andere Admins zu verwalten.
 * * @param session Das NextAuth-Session-Objekt des eingeloggten Benutzers.
 * @returns boolean
 */
export function canManageAdmins(session: Session | null): boolean {
  if (!session?.user) {
    return false;
  }

  // 1. Superadmins dürfen immer
  if (session.user.role === 'SUPERADMIN') {
    return true;
  }

  // 2. Admins nur mit der entsprechenden Berechtigung (Klasse 1)
  if (session.user.role === 'ADMIN' && session.user.permissions?.includes('kann_admins_verwalten')) {
    return true;
  }

  return false;
}

/**
 * Prüft, ob ein eingeloggter Benutzer (sessionUser) einen Zielbenutzer (targetUser)
 * bearbeiten oder löschen darf, basierend auf Rollen und Mandanten.
 * * @param sessionUser Der eingeloggte Benutzer (aus der Session).
 * @param targetUser Der Benutzer, der bearbeitet/gelöscht werden soll (aus der DB).
 * @returns boolean
 */
export function canEditUser(
  sessionUser: Session['user'],
  targetUser: Pick<User, 'id' | 'role' | 'mandant_id'>
): boolean {
  if (!sessionUser || !targetUser) return false;

  const isOwnProfile = sessionUser.id === targetUser.id;

  // --- SUPERADMIN Regeln ---
  if (sessionUser.role === 'SUPERADMIN') {
    // Superadmins dürfen sich nicht selbst oder andere Superadmins bearbeiten/löschen
    if (isOwnProfile || targetUser.role === 'SUPERADMIN') {
      return false;
    }
    return true; // Darf alle anderen (Admins, Benutzer) bearbeiten
  }

  // --- ADMIN Regeln ---
  if (sessionUser.role === 'ADMIN') {
    // Admins dürfen keine Superadmins bearbeiten
    if (targetUser.role === 'SUPERADMIN') {
      return false;
    }
    // Admins dürfen sich nicht selbst löschen (wird oft in DELETE geprüft, aber hier sicherheitshalber auch)
    // if (isOwnProfile) return false; // (Hängt von der API-Route ab, PUT ist ok, DELETE nicht)
    
    // Admins dürfen NUR Benutzer im EIGENEN Mandanten bearbeiten
    if (targetUser.mandant_id !== sessionUser.mandant_id) {
      return false;
    }
    
    // Wenn das Ziel ein anderer Admin ist...
    if (targetUser.role === 'ADMIN' && !isOwnProfile) {
      // ...benötigt der eingeloggte Admin 'kann_admins_verwalten'
      return sessionUser.permissions?.includes('kann_admins_verwalten') ?? false;
    }
    
    // Admins dürfen Kunden (BENUTZER) in ihrem Mandanten bearbeiten
    if (targetUser.role === 'BENUTZER') {
      return true;
    }
    
    // Admins dürfen ihr EIGENES Profil bearbeiten (PUT)
    if (isOwnProfile) {
      return true;
    }
  }
  
  return false;
}
