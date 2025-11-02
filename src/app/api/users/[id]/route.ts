// src/app/api/users/[id]/route.ts - KORRIGIERT (Mandanten-Logik)

import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { User } from '@/types';

// Handler zum Abrufen eines einzelnen Benutzers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params; // Umbenannt zu targetUserId für Klarheit
  try {
    const session = await getServerSession(authOptions);
    
    // Berechtigungsprüfung: Admins ODER der Benutzer selbst
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { 
      role: sessionRole, 
      id: sessionId, 
      mandant_id: sessionMandantId, 
      permissions: sessionPermissions // KORREKTUR: Berechtigungen des Admins laden
    } = session.user;
    
    const isAdmin = sessionRole === 'ADMIN' || sessionRole === 'SUPERADMIN';
    const isOwnProfile = sessionId === targetUserId;

    if (!isAdmin && !isOwnProfile) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    console.log(`[GET /api/users/${targetUserId}] Benutzerdaten abrufen... (angefragt von: ${session.user.email})`);

    // Lade Zieldaten
    const { rows } = await sql<User>`
      SELECT
        id::text as id,
        email,
        role,
        domain,
        gsc_site_url,
        ga4_property_id,
        semrush_project_id,
        semrush_tracking_id,
        semrush_tracking_id_02,
        mandant_id,
        permissions
      FROM users
      WHERE id = ${targetUserId}::uuid;
    `;

    if (rows.length === 0) {
      console.warn(`[GET /api/users/${targetUserId}] Benutzer nicht gefunden`);
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }
    
    const userToGet = rows[0];

    // --- KORRIGIERTE BERECHTIGUNGSPRÜFUNG ---
    if (sessionRole === 'ADMIN') {
      // 1. Admin darf nur Benutzer des eigenen Mandanten sehen
      if (userToGet.mandant_id !== sessionMandantId) {
         return NextResponse.json({ message: 'Zugriff auf diesen Mandanten verweigert' }, { status: 403 });
      }
      
      // 2. Admin darf andere Admins nur mit Berechtigung sehen
      const kannAdminsVerwalten = sessionPermissions?.includes('kann_admins_verwalten');
      // Prüfen, ob das Ziel ein Admin ist UND es NICHT das eigene Profil ist UND die Berechtigung fehlt
      if (userToGet.role === 'ADMIN' && !isOwnProfile && !kannAdminsVerwalten) {
          console.warn(`[GET /api/users/${targetUserId}] Zugriff verweigert. Admin ${sessionId} hat keine Berechtigung für Admin ${targetUserId}.`);
          return NextResponse.json({ message: 'Sie haben keine Berechtigung, diesen Admin anzuzeigen' }, { status: 403 });
      }
    }
    // SUPERADMIN darf alles (außer GET/isOwnProfile, was bereits abgedeckt ist)

    console.log(`[GET /api/users/${targetUserId}] ✅ Benutzer gefunden:`, userToGet.email);
    
    return NextResponse.json(userToGet);
  } catch (error) {
    console.error(`[GET /api/users/${targetUserId}] Fehler:`, error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Aktualisieren eines Benutzers
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { 
      role: sessionRole, 
      id: sessionId, 
      mandant_id: sessionMandantId,
      permissions: sessionPermissions
    } = session.user;
    
    const isOwnProfile = sessionId === targetUserId;

    // Nur Admins/Superadmins dürfen Updates durchführen
    if (sessionRole !== 'ADMIN' && sessionRole !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }
    
    const body = await request.json();

    const {
        email,
        domain,
        gsc_site_url,
        ga4_property_id,
        semrush_project_id,
        semrush_tracking_id,
        semrush_tracking_id_02,
        password,
        mandant_id, // NEU
        permissions  // NEU (als string[])
    } = body;

    if (!email) {
      return NextResponse.json({ message: 'E-Mail ist erforderlich' }, { status: 400 });
    }

    // Benutzer-Existenzprüfung (Zielbenutzer)
    const { rows: existingUsers } = await sql`
      SELECT role, mandant_id FROM users WHERE id = ${targetUserId}::uuid
    `;
    if (existingUsers.length === 0) {
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }
    const targetUser = existingUsers[0];

    // --- KORRIGIERTE BERECHTIGUNGSPRÜFUNG (WER DARF WEN BEARBEITEN) ---
    if (sessionRole === 'ADMIN') {
      // 1. Admin darf keinen Superadmin bearbeiten
      if (targetUser.role === 'SUPERADMIN') {
        return NextResponse.json({ message: 'Admins dürfen keine Superadmins bearbeiten' }, { status: 403 });
      }
      
      // 2. Admin darf nur Benutzer im EIGENEN Mandanten bearbeiten
      if (targetUser.mandant_id !== sessionMandantId) {
        return NextResponse.json({ message: 'Sie dürfen nur Benutzer Ihres eigenen Mandanten bearbeiten' }, { status: 403 });
      }

      // 3. Admin (Klasse 1) darf andere Admins im Mandanten bearbeiten
      const kannAdminsVerwalten = sessionPermissions?.includes('kann_admins_verwalten');
      // Prüfen, ob das Ziel ein Admin ist UND es NICHT das eigene Profil ist UND die Berechtigung fehlt
      if (targetUser.role === 'ADMIN' && !isOwnProfile && !kannAdminsVerwalten) {
         console.warn(`[PUT /api/users/${targetUserId}] Zugriff verweigert. Admin ${sessionId} hat keine Berechtigung für Admin ${targetUserId}.`);
         return NextResponse.json({ message: 'Sie haben keine Berechtigung, andere Admins zu bearbeiten' }, { status: 403 });
      }

      // 4. Ein normaler Admin darf mandant_id oder permissions nicht ändern (außer er bearbeitet sich selbst, aber das Feld wird im UI ausgeblendet)
      if ((body.mandant_id !== targetUser.mandant_id || body.permissions) && !kannAdminsVerwalten) {
         // Wir lassen Admins ihre eigenen Profil-Details (z.B. Passwort) ändern,
         // aber verhindern, dass sie ihre eigenen Berechtigungen oder Mandanten ändern.
         if (body.mandant_id || body.permissions) {
            return NextResponse.json({ message: 'Nur Superadmins (oder Admins mit Sonderrechten) dürfen Mandanten und Berechtigungen ändern' }, { status: 403 });
         }
      }
    }
    
    if (sessionRole === 'SUPERADMIN') {
      // Superadmin darf Ziel nicht zu Superadmin machen (Sicherheit)
      if (targetUser.role !== 'SUPERADMIN' && body.role === 'SUPERADMIN') {
         return NextResponse.json({ message: 'Die Zuweisung der SUPERADMIN-Rolle ist über die API nicht gestattet.' }, { status: 403 });
      }
      // Superadmin darf sich nicht selbst bearbeiten (Sicherheit)
      if (isOwnProfile) {
         return NextResponse.json({ message: 'Superadmins können sich nicht selbst über die API bearbeiten.' }, { status: 403 });
      }
    }
    // --- ENDE BERECHTIGUNGSPRÜFUNG ---

    const normalizedEmail = email.toLowerCase().trim();

    // E-Mail-Konfliktprüfung
    const { rows: emailCheck } = await sql`
      SELECT id FROM users
      WHERE email = ${normalizedEmail} AND id::text != ${targetUserId};
    `;
    if (emailCheck.length > 0) {
      return NextResponse.json({
        message: 'Diese E-Mail-Adresse wird bereits von einem anderen Benutzer verwendet'
      }, { status: 409 });
    }
    
    console.log(`[PUT /api/users/${targetUserId}] Update-Anfrage...`);
    
    // Konvertiere JS-Array ['label1'] in Postgres-Array-String '{label1}'
    const permissionsArray = Array.isArray(permissions) ? permissions : [];
    const permissionsPgString = `{${permissionsArray.join(',')}}`;

    const { rows } = password && password.trim().length > 0
      ? // Query MIT Passwort
        await sql<User>`
          UPDATE users
          SET 
            email = ${normalizedEmail},
            domain = ${domain || null},
            gsc_site_url = ${gsc_site_url || null},
            ga4_property_id = ${ga4_property_id || null},
            semrush_project_id = ${semrush_project_id || null},
            semrush_tracking_id = ${semrush_tracking_id || null},
            semrush_tracking_id_02 = ${semrush_tracking_id_02 || null},
            mandant_id = ${mandant_id || null},
            permissions = ${permissionsPgString},
            password = ${await bcrypt.hash(password, 10)}
          WHERE id = ${targetUserId}::uuid
          RETURNING
            id::text as id, email, role, domain, 
            gsc_site_url, ga4_property_id, 
            semrush_project_id, semrush_tracking_id, semrush_tracking_id_02,
            mandant_id, permissions;
        `
      : // Query OHNE Passwort (password bleibt unverändert!)
        await sql<User>`
          UPDATE users
          SET 
            email = ${normalizedEmail},
            domain = ${domain || null},
            gsc_site_url = ${gsc_site_url || null},
            ga4_property_id = ${ga4_property_id || null},
            semrush_project_id = ${semrush_project_id || null},
            semrush_tracking_id = ${semrush_tracking_id || null},
            semrush_tracking_id_02 = ${semrush_tracking_id_02 || null},
            mandant_id = ${mandant_id || null},
            permissions = ${permissionsPgString}
          WHERE id = ${targetUserId}::uuid
          RETURNING
            id::text as id, email, role, domain, 
            gsc_site_url, ga4_property_id, 
            semrush_project_id, semrush_tracking_id, semrush_tracking_id_02,
            mandant_id, permissions;
        `;

    if (rows.length === 0) {
      return NextResponse.json({ message: "Update fehlgeschlagen. Benutzer nicht gefunden." }, { status: 404 });
    }

    console.log(`✅ [PUT /api/users/${targetUserId}] Benutzer erfolgreich aktualisiert:`, rows[0].email);
    
    return NextResponse.json({
      ...rows[0],
      message: 'Benutzer erfolgreich aktualisiert'
    });

  } catch (error) {
    console.error(`[PUT /api/users/${targetUserId}] Fehler:`, error);
    return NextResponse.json({
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}

// Handler zum Löschen eines Benutzers
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { 
      role: sessionRole, 
      id: sessionId, 
      mandant_id: sessionMandantId,
      permissions: sessionPermissions
    } = session.user;
    
    const isOwnProfile = sessionId === targetUserId;


    if (sessionRole !== 'ADMIN' && sessionRole !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    console.log(`[DELETE /api/users/${targetUserId}] Lösche Benutzer...`);

    // Benutzer-Existenzprüfung (Zielbenutzer)
    const { rows: existingUsers } = await sql`
      SELECT role, mandant_id FROM users WHERE id = ${targetUserId}::uuid
    `;
    if (existingUsers.length === 0) {
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }
    const targetUser = existingUsers[0];

    // --- KORRIGIERTE BERECHTIGUNGSPRÜFUNG (WER DARF WEN LÖSCHEN) ---
    if (sessionRole === 'ADMIN') {
      if (targetUser.role === 'SUPERADMIN') {
        return NextResponse.json({ message: 'Admins dürfen keine Superadmins löschen' }, { status: 403 });
      }
      if (targetUser.mandant_id !== sessionMandantId) {
        return NextResponse.json({ message: 'Sie dürfen nur Benutzer Ihres eigenen Mandanten löschen' }, { status: 403 });
      }
      const kannAdminsVerwalten = sessionPermissions?.includes('kann_admins_verwalten');
      // Prüfen, ob das Ziel ein Admin ist UND es NICHT das eigene Profil ist UND die Berechtigung fehlt
      if (targetUser.role === 'ADMIN' && !isOwnProfile && !kannAdminsVerwalten) {
         return NextResponse.json({ message: 'Sie haben keine Berechtigung, andere Admins zu löschen' }, { status: 403 });
      }
      // Admins dürfen sich nicht selbst löschen
      if (isOwnProfile) {
         return NextResponse.json({ message: 'Admins können sich nicht selbst löschen.' }, { status: 403 });
      }
    }

    if (sessionRole === 'SUPERADMIN') {
      if (targetUser.role === 'SUPERADMIN' || isOwnProfile) {
         return NextResponse.json({ message: 'Superadmins können nicht sich selbst oder andere Superadmins löschen.' }, { status: 403 });
      }
    }
    // --- ENDE BERECHTIGUNGSPRÜFUNG ---

    const result = await sql`
      DELETE FROM users WHERE id = ${targetUserId}::uuid;
    `;

    if (result.rowCount === 0) {
      // Sollte theoretisch nicht passieren, da wir oben schon geprüft haben
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }

    console.log(`✅ [DELETE /api/users/${targetUserId}] Benutzer erfolgreich gelöscht`);
    return NextResponse.json({ message: 'Benutzer erfolgreich gelöscht' });
  } catch (error) {
    console.error(`[DELETE /api/users/${targetUserId}] Fehler:`, error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
