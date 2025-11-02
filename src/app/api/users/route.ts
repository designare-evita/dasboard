// src/app/api/users/route.ts - KORRIGIERT (Mit automatischer Zuweisung)

import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { User } from '@/types';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET: Benutzer abrufen (mit Mandanten-Filterung UND Berechtigungs-Filterung)
// (Diese Funktion ist von der letzten Korrektur bereits korrekt und bleibt unverändert)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  console.log('[/api/users] GET Request');
  console.log('[/api/users] User:', session?.user?.email, 'Role:', session?.user?.role);

  if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const onlyCustomers = searchParams.get('onlyCustomers') === 'true';

  console.log('[/api/users] onlyCustomers:', onlyCustomers);

  try {
    let result;

    if (session.user.role === 'SUPERADMIN') {
      // SUPERADMIN sieht alle (oder nur Kunden, je nach Filter)
      console.log('[/api/users] SUPERADMIN - Lade Benutzer');
      
      if (onlyCustomers) {
        result = await sql`
          SELECT id::text as id, email, role, domain, mandant_id, permissions
          FROM users
          WHERE role = 'BENUTZER'
          ORDER BY mandant_id ASC, domain ASC, email ASC
        `;
      } else {
        // Alle außer SUPERADMIN (für Admin-Bereich)
        result = await sql`
          SELECT id::text as id, email, role, domain, mandant_id, permissions
          FROM users
          WHERE role != 'SUPERADMIN'
          ORDER BY mandant_id ASC, role DESC, email ASC
        `;
      }

      console.log('[/api/users] Gefunden:', result.rows.length, 'Benutzer');

    } else { // ADMIN
      // ADMIN sieht nur Benutzer des EIGENEN Mandanten
      const adminMandantId = session.user.mandant_id;
      
      const adminPermissions = session.user.permissions || [];
      const kannAdminsVerwalten = adminPermissions.includes('kann_admins_verwalten');
      
      if (!adminMandantId) {
        console.warn(`[/api/users] ADMIN ${session.user.email} hat keine mandant_id und kann niemanden sehen.`);
        return NextResponse.json([]); // Leeres Array zurückgeben
      }

      console.log(`[/api/users] ADMIN - Lade Benutzer für Mandant: ${adminMandantId}`);
      console.log(`[/api/users] ADMIN - Hat 'kann_admins_verwalten': ${kannAdminsVerwalten}`);


      if (onlyCustomers) {
        // Nur Kunden (BENUTZER) des eigenen Mandanten (Diese Logik ändert sich nicht)
        result = await sql`
          SELECT id::text as id, email, role, domain, mandant_id, permissions
          FROM users
          WHERE mandant_id = ${adminMandantId}
          AND role = 'BENUTZER'
          ORDER BY domain ASC, email ASC
        `;
      } else {
        // Logik für die /admin Seite (wenn onlyCustomers=false ist)
        
        if (kannAdminsVerwalten) {
          // Admin (Klasse 1) darf Admins + Benutzer seines Mandanten sehen
          console.log('[/api/users] Admin (Klasse 1) lädt Admins + Benutzer');
          result = await sql`
            SELECT id::text as id, email, role, domain, mandant_id, permissions
            FROM users
            WHERE mandant_id = ${adminMandantId}
            AND role != 'SUPERADMIN'
            ORDER BY role DESC, email ASC
          `;
        } else {
          // Normaler Admin (ohne Klasse 1) darf NUR Benutzer seines Mandanten sehen
          console.log('[/api/users] Admin (Standard) lädt NUR Benutzer');
          result = await sql`
            SELECT id::text as id, email, role, domain, mandant_id, permissions
            FROM users
            WHERE mandant_id = ${adminMandantId}
            AND role = 'BENUTZER'
            ORDER BY role DESC, email ASC
          `;
        }
      }

      console.log('[/api/users] Gefunden:', result.rows.length, 'zugewiesene Benutzer/Admins');
    }

    return NextResponse.json(result.rows);

  } catch (error) {
    console.error('[/api/users] Fehler beim Abrufen der Benutzer:', error);
    return NextResponse.json({
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}

// POST: Neuen Benutzer erstellen
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: "Zugriff verweigert" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const createdByAdminId = session.user.id;
    const { 
      email, 
      password, 
      role, 
      mandant_id, 
      permissions,
      domain, 
      gsc_site_url, 
      ga4_property_id, 
      semrush_project_id, 
      semrush_tracking_id, 
      semrush_tracking_id_02 
    } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ message: 'E-Mail, Passwort und Rolle sind erforderlich' }, { status: 400 });
    }
    
    // (Berechtigungsprüfungen bleiben gleich)
    const loggedInUserRole = session.user.role;
    const loggedInUserMandantId = session.user.mandant_id;
    const roleToCreate = role;

    if (roleToCreate === 'SUPERADMIN') {
       return NextResponse.json({ message: 'Superadmins können nicht über diese API erstellt werden.' }, { status: 403 });
    }
    if (loggedInUserRole === 'ADMIN') {
      if (roleToCreate !== 'BENUTZER') {
         return NextResponse.json({ message: 'Admins dürfen nur Kunden (Benutzer) erstellen.' }, { status: 403 });
      }
      // KORREKTUR: Wenn ein Admin erstellt, wird der Mandant automatisch geerbt
      if (mandant_id !== loggedInUserMandantId) {
         return NextResponse.json({ message: 'Admins dürfen nur Benutzer im eigenen Mandanten erstellen.' }, { status: 403 });
      }
      if (permissions && permissions.length > 0) {
         return NextResponse.json({ message: 'Admins dürfen keine Berechtigungen (Klasse) zuweisen.' }, { status: 403 });
      }
    }
    
    const { rows } = await sql<User>`SELECT * FROM users WHERE email = ${email}`;
    if (rows.length > 0) {
      return NextResponse.json({ message: 'Benutzer existiert bereits' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const permissionsArray = Array.isArray(permissions) ? permissions : [];
    const permissionsPgString = `{${permissionsArray.join(',')}}`;

    const { rows: newUsers } = await sql<User>`
      INSERT INTO users (
        email, password, role, mandant_id, permissions,
        domain, gsc_site_url, ga4_property_id,
        semrush_project_id, semrush_tracking_id, semrush_tracking_id_02,
        "createdByAdminId"
      )
      VALUES (
        ${email}, ${hashedPassword}, ${roleToCreate}, 
        ${mandant_id || null}, -- Wird vom Admin (wenn nicht Superadmin) geerbt oder vom Superadmin gesetzt
        ${permissionsPgString},
        ${domain || null}, ${gsc_site_url || null}, ${ga4_property_id || null},
        ${semrush_project_id || null}, ${semrush_tracking_id || null}, ${semrush_tracking_id_02 || null},
        ${createdByAdminId}
      )
      RETURNING id, email, role, domain, mandant_id, permissions`;
      
    const newUser = newUsers[0];

    // --- KORREKTUR: Automatische Zuweisung für den Ersteller ---
    // Wenn ein Admin (egal ob Klasse 1 oder Standard) einen KUNDEN erstellt,
    // wird er automatisch diesem Kunden zugewiesen.
    if (loggedInUserRole === 'ADMIN' && roleToCreate === 'BENUTZER') {
      const newCustomerId = newUser.id;
      
      console.log(`[/api/users] ADMIN ${createdByAdminId} erstellt Kunde ${newCustomerId}.`);
      console.log(`[/api/users] Füge automatische Zuweisung in 'project_assignments' hinzu...`);

      try {
        await sql`
          INSERT INTO project_assignments (user_id, project_id)
          VALUES (${createdByAdminId}::uuid, ${newCustomerId}::uuid)
        `;
        console.log(`[/api/users] ✅ Zuweisung erfolgreich.`);
      } catch (assignError) {
        console.error(`[/api/users] ❌ FEHLER bei automatischer Zuweisung:`, assignError);
        // Der Benutzer wurde erstellt, aber die Zuweisung schlug fehl.
        // Wir loggen den Fehler, aber die Aktion war trotzdem "teils" erfolgreich.
      }
    }
    // --- ENDE KORREKTUR ---

    return NextResponse.json(newUser, { status: 201 });

  } catch (error) {
    console.error('Fehler bei der Benutzererstellung:', error);
    return NextResponse.json({
        message: 'Interner Serverfehler',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}
