// src/app/api/users/[id]/route.ts

import { NextResponse, NextRequest } from 'next/server'; // NextRequest importieren
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { User } from '@/types'; // User-Typ importieren

// Typ für die Parameter aus dem Pfad
type RouteHandlerParams = {
  params: { id: string };
};

// Handler zum Abrufen eines einzelnen Benutzers
export async function GET(request: NextRequest, { params }: RouteHandlerParams) {
  try {
    const session = await getServerSession(authOptions);
    // Berechtigungsprüfung: Nur Admins oder Superadmins
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const { id } = params;
    console.log(`[GET /api/users/${id}] Benutzerdaten abrufen...`);

    // Alle relevanten Felder abrufen, einschließlich der neuen Semrush-Felder
    const { rows } = await sql<User>`
      SELECT
        id::text as id,
        email,
        role,
        domain,
        gsc_site_url,
        ga4_property_id,
        semrush_project_id, -- NEU
        tracking_id         -- NEU
      FROM users
      WHERE id = ${id}::uuid; -- ID als UUID casten
    `;

    if (rows.length === 0) {
      console.warn(`[GET /api/users/${id}] Benutzer nicht gefunden`);
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }
    console.log(`[GET /api/users/${id}] Benutzer gefunden:`, rows[0].email);
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error(`[GET /api/users/${id}] Fehler:`, error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Aktualisieren eines Benutzers
export async function PUT(request: NextRequest, { params }: RouteHandlerParams) {
  try {
    const session = await getServerSession(authOptions);
    // Berechtigungsprüfung: Nur Admins oder Superadmins
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();

    // --- NEUE FELDER AUS DEM BODY LESEN ---
    const {
        email,
        domain,
        gsc_site_url,
        ga4_property_id,
        semrush_project_id, // NEU
        tracking_id,        // NEU
        password            // Passwort kann optional mitgesendet werden
    } = body;
    // ------------------------------------

    if (!email) {
      return NextResponse.json({ message: 'E-Mail ist erforderlich' }, { status: 400 });
    }

    // E-Mail normalisieren (Kleinbuchstaben, keine Leerzeichen am Rand)
    const normalizedEmail = email.toLowerCase().trim();

    // Prüfe, ob die neue E-Mail bereits von einem *anderen* Benutzer verwendet wird
    const { rows: emailCheck } = await sql`
      SELECT id FROM users
      WHERE email = ${normalizedEmail} AND id::text != ${id};
    `;

    if (emailCheck.length > 0) {
      return NextResponse.json({
        message: 'Diese E-Mail-Adresse wird bereits von einem anderen Benutzer verwendet'
      }, { status: 409 });
    }

    // Hole die aktuelle Rolle, falls sie nicht im Body mitgesendet wird
    const { rows: existingUsers } = await sql`SELECT role FROM users WHERE id = ${id}::uuid`;
    if (existingUsers.length === 0) {
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }
    
    console.log(`[PUT /api/users/${id}] Update-Anfrage:`);
    console.log('  - E-Mail:', normalizedEmail);
    console.log('  - Domain:', domain);
    console.log('  - GSC URL:', gsc_site_url);
    console.log('  - GA4 ID:', ga4_property_id);
    console.log('  - Semrush ID:', semrush_project_id); // NEU
    console.log('  - Tracking ID:', tracking_id);       // NEU
    console.log('  - Passwort ändern:', !!password);

    // --- KORREKTUR: let zu const geändert ---
    const updateFields = [
      `email = ${normalizedEmail}`,
      // Setze Felder auf NULL, wenn sie leer sind, sonst den Wert
      `domain = ${domain || null}`,
      `gsc_site_url = ${gsc_site_url || null}`,
      `ga4_property_id = ${ga4_property_id || null}`,
      `semrush_project_id = ${semrush_project_id || null}`, // NEU
      `tracking_id = ${tracking_id || null}`                // NEU
    ];
    // ----------------------------------------

    let hashedPassword = null;
    if (password && password.trim().length > 0) {
      hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push(`password = ${hashedPassword}`); // Nur hinzufügen, wenn Passwort gesetzt ist
      console.log('  - Neues Passwort-Hash erstellt');
    } else {
      console.log('  - Passwort bleibt unverändert');
    }

    // Dynamisches SQL-Statement zusammensetzen
    const setClause = updateFields.join(', ');
    const updateQueryString = `
      UPDATE users
      SET ${setClause}
      WHERE id = $1::uuid
      RETURNING
        id::text as id,
        email,
        role,
        domain,
        gsc_site_url,
        ga4_property_id,
        semrush_project_id, -- NEU
        tracking_id;        -- NEU
    `;

    // SQL-Befehl ausführen
    const { rows } = await sql.query<User>(updateQueryString, [id]);

    if (rows.length === 0) {
      // Sollte theoretisch nicht passieren, da wir oben schon geprüft haben
      return NextResponse.json({ message: "Update fehlgeschlagen. Benutzer nicht gefunden." }, { status: 404 });
    }

    console.log('✅ Benutzer erfolgreich aktualisiert:', rows[0].email);

    // Gib die aktualisierten Daten zurück (ohne Passwort)
    return NextResponse.json({
      ...rows[0],
      message: 'Benutzer erfolgreich aktualisiert' // Zusätzliche Nachricht für das Frontend
    });

  } catch (error) {
    console.error(`[PUT /api/users/${id}] Fehler:`, error);
    return NextResponse.json({
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}

// Handler zum Löschen eines Benutzers
export async function DELETE(request: NextRequest, { params }: RouteHandlerParams) {
  try {
    const session = await getServerSession(authOptions);
    // Berechtigungsprüfung: Nur Admins oder Superadmins
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const { id } = params;
    console.log(`[DELETE /api/users/${id}] Lösche Benutzer...`);

    const result = await sql`
      DELETE FROM users WHERE id = ${id}::uuid; -- ID als UUID casten
    `;

    if (result.rowCount === 0) {
      console.warn(`[DELETE /api/users/${id}] Benutzer nicht gefunden`);
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }

    console.log(`[DELETE /api/users/${id}] ✅ Benutzer erfolgreich gelöscht`);
    return NextResponse.json({ message: 'Benutzer erfolgreich gelöscht' });
  } catch (error) {
    console.error(`[DELETE /api/users/${id}] Fehler:`, error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
