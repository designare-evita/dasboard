// src/app/api/users/[id]/route.ts - ANGEPASST FÜR MANDANTEN-LOGIK

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
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    
    // Berechtigungsprüfung: Admins ODER der Benutzer selbst
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role: sessionRole, id: sessionId, mandant_id: sessionMandantId } = session.user;
    const isAdmin = sessionRole === 'ADMIN' || sessionRole === 'SUPERADMIN';
    const isOwnProfile = sessionId === id;

    if (!isAdmin && !isOwnProfile) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    console.log(`[GET /api/users/${id}] Benutzerdaten abrufen... (angefragt von: ${session.user.email})`);

    // ✅ KORRIGIERT: Lade mandant_id und permissions
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
      WHERE id = ${id}::uuid;
    `;

    if (rows.length === 0) {
      console.warn(`[GET /api/users/${id}] Benutzer nicht gefunden`);
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }
    
    const userToGet = rows[0];

    // BERECHTIGUNGSPRÜFUNG: Admin darf nur eigene Mandanten-Benutzer sehen (außer Superadmin)
    if (sessionRole === 'ADMIN' && userToGet.mandant_id !== sessionMandantId) {
       return NextResponse.json({ message: 'Zugriff auf diesen Mandanten verweigert' }, { status: 403 });
    }

    console.log(`[GET /api/users/${id}] ✅ Benutzer gefunden:`, userToGet.email);
    
    return NextResponse.json(userToGet);
  } catch (error) {
    console.error(`[GET /api/users/${id}] Fehler:`, error);
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

    // --- BERECHTIGUNGSPRÜFUNG (WER DARF WEN BEARBEITEN) ---
    if (sessionRole === 'ADMIN') {
      // 1. Admin darf keinen Superadmin bearbeiten
      if (targetUser.role === 'SUPERADMIN') {
        return NextResponse.json({ message: 'Admins dürfen keine Superadmins bearbeiten' }, { status: 403 });
      }
      
      // 2. Admin darf nur Benutzer im EIGENEN Mandanten bearbeiten
      if (targetUser.mandant_id !== sessionMandantId) {
        return NextResponse.json({ message: 'Sie dürfen nur Benutzer Ihres eigenen Mandanten bearbeiten' }, { status: 403 });
      }

      // 3. Admin (Klasse 1) mit 'kann_admins_verwalten' darf andere Admins im Mandanten bearbeiten
      const kannAdminsVerwalten = sessionPermissions?.includes('kann_admins_verwalten');
      if (targetUser.role === 'ADMIN' && !kannAdminsVerwalten) {
         return NextResponse.json({ message: 'Sie haben keine Berechtigung, andere Admins zu bearbeiten' }, { status: 403 });
      }

      // 4. Ein normaler Admin darf mandant_id oder permissions nicht ändern
      if (body.mandant_id !== targetUser.mandant_id || (body.permissions && !kannAdminsVerwalten)) {
         return NextResponse.json({ message: 'Nur Superadmins (oder Admins mit Sonderrechten) dürfen Mandanten und Berechtigungen ändern' }, { status: 403 });
      }
    }
    
    if (sessionRole === 'SUPERADMIN') {
      // Superadmin darf Ziel nicht zu Superadmin machen (Sicherheit)
      if (targetUser.role !== 'SUPERADMIN' && body.role === 'SUPERADMIN') {
         return NextResponse.json({ message: 'Die Zuweisung der SUPERADMIN-Rolle ist über die API nicht gestattet.' }, { status: 403 });
      }
      // Superadmin darf sich nicht selbst bearbeiten (Sicherheit)
      if (targetUserId === sessionId) {
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

    // --- BERECHTIGUNGSPRÜFUNG (WER DARF WEN LÖSCHEN) ---
    if (sessionRole === 'ADMIN') {
      if (targetUser.role === 'SUPERADMIN') {
        return NextResponse.json({ message: 'Admins dürfen keine Superadmins löschen' }, { status: 403 });
      }
      if (targetUser.mandant_id !== sessionMandantId) {
        return NextResponse.json({ message: 'Sie dürfen nur Benutzer Ihres eigenen Mandanten löschen' }, { status: 403 });
      }
      const kannAdminsVerwalten = sessionPermissions?.includes('kann_admins_verwalten');
      if (targetUser.role === 'ADMIN' && !kannAdminsVerwalten) {
         return NextResponse.json({ message: 'Sie haben keine Berechtigung, andere Admins zu löschen' }, { status: 403 });
      }
    }

    if (sessionRole === 'SUPERADMIN') {
      if (targetUser.role === 'SUPERADMIN' || targetUserId === sessionId) {
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
