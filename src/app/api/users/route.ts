// src/app/api/users/route.ts - KOMPLETT

import { NextResponse, NextRequest } from 'next/server'; // NextRequest hinzugefügt
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { User } from '@/types';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET: Benutzer abrufen (mit optionalem onlyCustomers Parameter)
export async function GET(request: NextRequest) { // Request-Typ zu NextRequest geändert
  const session = await getServerSession(authOptions);

  console.log('[/api/users] GET Request');
  console.log('[/api/users] User:', session?.user?.email, 'Role:', session?.user?.role);

  if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
  }

  // ✅ Query-Parameter prüfen
  const { searchParams } = new URL(request.url);
  const onlyCustomers = searchParams.get('onlyCustomers') === 'true';

  console.log('[/api/users] onlyCustomers:', onlyCustomers);

  try {
    let result;

    if (session.user.role === 'SUPERADMIN') {
      if (onlyCustomers) {
        // Nur Kunden (für Redaktionsplan)
        console.log('[/api/users] SUPERADMIN - Lade nur BENUTZER (Kunden)');

        result = await sql`
          SELECT id::text as id, email, role, domain
          FROM users
          WHERE role = 'BENUTZER'
          ORDER BY domain ASC, email ASC
        `;
      } else {
        // Alle außer SUPERADMIN (für Admin-Bereich)
        console.log('[/api/users] SUPERADMIN - Lade alle Benutzer außer SUPERADMIN');

        result = await sql`
          SELECT id::text as id, email, role, domain
          FROM users
          WHERE role != 'SUPERADMIN'
          ORDER BY role DESC, email ASC
        `;
      }

      console.log('[/api/users] Gefunden:', result.rows.length, 'Benutzer');

    } else { // ADMIN
      console.log('[/api/users] ADMIN - Lade zugewiesene Projekte');

      // Admin sieht immer nur zugewiesene Benutzer-Projekte
      result = await sql`
        SELECT
          u.id::text as id,
          u.email,
          u.role,
          u.domain
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.project_id
        WHERE pa.user_id::text = ${session.user.id}
        AND u.role = 'BENUTZER'
        ORDER BY u.domain ASC, u.email ASC
      `;

      console.log('[/api/users] Gefunden:', result.rows.length, 'zugewiesene Projekte');
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
export async function POST(req: NextRequest) { // Request-Typ zu NextRequest geändert
  const session = await getServerSession(authOptions);

  // Prüfen, ob der Benutzer eingeloggt ist UND Admin oder Superadmin ist
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: "Zugriff verweigert" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const createdByAdminId = session.user.id;
    const { email, password, role, domain, gsc_site_url, ga4_property_id } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ message: 'E-Mail, Passwort und Rolle sind erforderlich' }, { status: 400 });
    }

    // --- BERECHTIGUNGSPRÜFUNG ---
    const loggedInUserRole = session.user.role;
    const roleToCreate = role;

    // 1. Nur Superadmin darf Admins erstellen
    if (roleToCreate === 'ADMIN' && loggedInUserRole !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nur Superadmins dürfen Admins erstellen.' }, { status: 403 });
    }

    // 2. Admins dürfen NUR Kunden (Benutzer) erstellen
    if (loggedInUserRole === 'ADMIN' && roleToCreate !== 'BENUTZER') {
       return NextResponse.json({ message: 'Admins dürfen nur Kunden (Benutzer) erstellen.' }, { status: 403 });
    }

    // 3. Superadmin darf keine Superadmins erstellen (Sicherheitsmaßnahme)
    if (roleToCreate === 'SUPERADMIN') {
       return NextResponse.json({ message: 'Superadmins können nicht über diese API erstellt werden.' }, { status: 403 });
    }
    // --- ENDE BERECHTIGUNGSPRÜFUNG ---

    // ✨ Validierung für domain, gsc_site_url, ga4_property_id wurde entfernt ✨
    /* // ALT:
    if (role === 'BENUTZER' && (!domain || !gsc_site_url || !ga4_property_id)) {
      return NextResponse.json({ message: 'Für Benutzer sind Domain, GSC Site URL und GA4 Property ID Pflichtfelder.' }, { status: 400 });
    }
    */

    const { rows } = await sql<User>`SELECT * FROM users WHERE email = ${email}`;
    if (rows.length > 0) {
      return NextResponse.json({ message: 'Benutzer existiert bereits' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✨ SQL-Query verwendet || null, um leere optionale Werte korrekt als NULL einzufügen ✨
    const { rows: newUsers } = await sql<User>`
      INSERT INTO users (email, password, role, domain, gsc_site_url, ga4_property_id, "createdByAdminId")
      VALUES (${email}, ${hashedPassword}, ${roleToCreate}, ${domain || null}, ${gsc_site_url || null}, ${ga4_property_id || null}, ${createdByAdminId})
      RETURNING id, email, role, domain`;

    return NextResponse.json(newUsers[0], { status: 201 });

  } catch (error) {
    console.error('Fehler bei der Benutzererstellung:', error);
    return NextResponse.json({
        message: 'Interner Serverfehler',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}
