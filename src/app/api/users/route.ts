// src/app/api/users/route.ts
// (FINALE KORREKTUR der GET-Logik basierend auf Ihren Regeln)
// ✅ AKTUALISIERT mit favicon_url

import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { User } from '@/types';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth

// GET: Benutzer abrufen (mit korrekter Berechtigungs-Logik)
export async function GET(request: NextRequest) {
  const session = await auth(); // KORRIGIERT: auth() aufgerufen

  console.log('[/api/users] GET Request');
  console.log('[/api/users] User:', session?.user?.email, 'Role:', session?.user?.role);

  if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  // ?onlyCustomers=true wird vom Redaktionsplan-Dropdown verwendet
  const onlyCustomers = searchParams.get('onlyCustomers') === 'true';

  try {
    let result;

    // --- SUPERADMIN Logik ---
    if (session.user.role === 'SUPERADMIN') {
      console.log('[/api/users] SUPERADMIN - Lade Benutzer');
      if (onlyCustomers) {
        // Redaktionsplan: Alle Kunden
        result = await sql`
          SELECT id::text as id, email, role, domain, mandant_id, permissions, favicon_url
          FROM users
          WHERE role = 'BENUTZER'
          ORDER BY mandant_id ASC, domain ASC, email ASC
        `;
      } else {
        // Admin-Panel: Alle außer Superadmins
        result = await sql`
          SELECT id::text as id, email, role, domain, mandant_id, permissions, favicon_url
          FROM users
          WHERE role != 'SUPERADMIN'
          ORDER BY mandant_id ASC, role DESC, email ASC
        `;
      }
      console.log('[/api/users] (SA) Gefunden:', result.rows.length, 'Benutzer');
      return NextResponse.json(result.rows);
    }

    // --- ADMIN Logik ---
    if (session.user.role === 'ADMIN') {
      const adminId = session.user.id;
      const adminMandantId = session.user.mandant_id;
      const adminPermissions = session.user.permissions || [];
      const kannAdminsVerwalten = adminPermissions.includes('kann_admins_verwalten');

      if (onlyCustomers) {
        // FÜR REDAKTIONSPLAN (/admin/redaktionsplan)
        // Zeige nur explizit zugewiesene Kunden (Benutzer)
        console.log(`[/api/users] ADMIN - Lade zugewiesene Kunden für Redaktionsplan`);
        result = await sql`
          SELECT u.id::text as id, u.email, u.role, u.domain, u.mandant_id, u.permissions, u.favicon_url
          FROM users u
          INNER JOIN project_assignments pa ON u.id = pa.project_id
          WHERE pa.user_id::text = ${adminId} AND u.role = 'BENUTZER'
          ORDER BY u.domain ASC, u.email ASC
        `;
        console.log('[/api/users] (Admin) Gefunden:', result.rows.length, 'zugewiesene Kunden');
        return NextResponse.json(result.rows);
      } 
      
      // FÜR ADMIN-PANEL (/admin)
      console.log(`[/api/users] ADMIN - Lade Ansicht für Admin-Panel`);
      console.log(`[/api/users] ADMIN - Hat 'kann_admins_verwalten': ${kannAdminsVerwalten}`);

      // 1. Hole immer die explizit zugewiesenen KUNDEN
      const kundenQuery = sql`
        SELECT u.id::text as id, u.email, u.role, u.domain, u.mandant_id, u.permissions, u.favicon_url
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.project_id
        WHERE pa.user_id::text = ${adminId} AND u.role = 'BENUTZER'
      `;

      if (kannAdminsVerwalten && adminMandantId) {
        // 2. Admin (Klasse 1) - Hole KUNDEN + ANDERE ADMINS (im selben Label)
        console.log(`[/api/users] Admin (Klasse 1) lädt Admins + zugewiesene Kunden für Mandant: ${adminMandantId}`);
        const adminsQuery = sql`
          SELECT id::text as id, email, role, domain, mandant_id, permissions, favicon_url
          FROM users
          WHERE mandant_id = ${adminMandantId}
            AND role = 'ADMIN'
            AND id::text != ${adminId} -- Sich selbst ausschließen
        `;
        
        // Führe beide Abfragen parallel aus und kombiniere sie
        const [kundenResult, adminsResult] = await Promise.all([kundenQuery, adminsQuery]);
        const combinedUsers = [...kundenResult.rows, ...adminsResult.rows];
        
        // Sortieren (optional, aber schön)
        combinedUsers.sort((a, b) => (a.role > b.role) ? -1 : (a.role === b.role) ? a.email.localeCompare(b.email) : 1);
        
        console.log('[/api/users] (Klasse 1) Gefunden:', combinedUsers.length, 'Benutzer/Admins');
        return NextResponse.json(combinedUsers);
        
      } else {
        // 3. Admin (Standard) - Hole NUR zugewiesene KUNDEN
        console.log('[/api/users] Admin (Standard) lädt NUR zugewiesene Kunden');
        result = await kundenQuery;
        
        console.log('[/api/users] (Standard) Gefunden:', result.rows.length, 'Benutzer');
        return NextResponse.json(result.rows);
      }
    }

    // Fallback (sollte nie eintreten)
    return NextResponse.json({ message: "Unbekannter Fehler" }, { status: 500 });

  } catch (error) {
    console.error('[/api/users] Fehler beim Abrufen der Benutzer:', error);
    return NextResponse.json({
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}

// POST: Neuen Benutzer erstellen (✅ AKTUALISIERT mit Projekt-Datum/Dauer)
export async function POST(req: NextRequest) {
  const session = await auth(); // KORRIGIERT: auth() aufgerufen

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
      semrush_tracking_id_02,
      favicon_url,
      project_start_date,     // ✅ NEU
      project_duration_months // ✅ NEU
    } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ message: 'E-Mail, Passwort und Rolle sind erforderlich' }, { status: 400 });
    }
    
    // (Berechtigungsprüfungen)
    const loggedInUserRole = session.user.role;
    const loggedInUserMandantId = session.user.mandant_id;
    const roleToCreate = role;

    if (roleToCreate === 'SUPERADMIN') {
       return NextResponse.json({ message: 'Superadmins können nicht über diese API erstellt werden.' }, { status: 403 });
    }
    
    let effective_mandant_id = mandant_id;

    if (loggedInUserRole === 'ADMIN') {
      if (roleToCreate !== 'BENUTZER') {
         return NextResponse.json({ message: 'Admins dürfen nur Kunden (Benutzer) erstellen.' }, { status: 403 });
      }
      // KORREKTUR: Admin erbt Mandant-ID
      effective_mandant_id = loggedInUserMandantId; 
      if (!effective_mandant_id) {
         return NextResponse.json({ message: 'Ihr Admin-Konto hat kein Label (Mandant-ID) und kann keine Benutzer erstellen.' }, { status: 400 });
      }
      if (permissions && permissions.length > 0) {
         return NextResponse.json({ message: 'Admins dürfen keine Berechtigungen (Klasse) zuweisen.' }, { status: 403 });
      }
    }
    
    if (roleToCreate !== 'SUPERADMIN' && !effective_mandant_id) {
       return NextResponse.json({ message: 'Mandant-ID (Label) ist erforderlich' }, { status: 400 });
    }

    
    const { rows } = await sql<User>`SELECT * FROM users WHERE email = ${email}`;
    if (rows.length > 0) {
      return NextResponse.json({ message: 'Benutzer existiert bereits' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const permissionsArray = Array.isArray(permissions) ? permissions : [];
    const permissionsPgString = `{${permissionsArray.join(',')}}`;

    // ✅ NEU: Werte aufbereiten (Standardmäßig HEUTE und 6 Monate, falls nicht angegeben)
    const duration = project_duration_months ? parseInt(String(project_duration_months), 10) : 6;
    const startDate = project_start_date ? new Date(project_start_date).toISOString() : new Date().toISOString();

    const { rows: newUsers } = await sql<User>`
      INSERT INTO users (
        email, password, role, mandant_id, permissions,
        domain, gsc_site_url, ga4_property_id,
        semrush_project_id, semrush_tracking_id, semrush_tracking_id_02,
        favicon_url,
        project_start_date,     // ✅ NEU
        project_duration_months, // ✅ NEU
        "createdByAdminId"
      )
      VALUES (
        ${email}, ${hashedPassword}, ${roleToCreate}, 
        ${effective_mandant_id || null}, 
        ${permissionsPgString},
        ${domain || null}, ${gsc_site_url || null}, ${ga4_property_id || null},
        ${semrush_project_id || null}, ${semrush_tracking_id || null}, ${semrush_tracking_id_02 || null},
        ${favicon_url || null},
        ${startDate},             // ✅ NEU
        ${duration},              // ✅ NEU
        ${createdByAdminId}
      )
      RETURNING id, email, role, domain, mandant_id, permissions, favicon_url, project_start_date, project_duration_months`; // ✅ NEU
      
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
