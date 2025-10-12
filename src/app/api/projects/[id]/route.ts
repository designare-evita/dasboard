// src/app/api/projects/[id]/route.ts
// "Projekte" sind eigentlich Benutzer mit Rolle BENUTZER

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// Handler zum Abrufen eines einzelnen "Projekts" (= Benutzer)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // Superadmin sieht alle BENUTZER, Admin nur seine eigenen
    let query;
    if (session.user.role === 'SUPERADMIN') {
      query = sql`
        SELECT id, email, role, domain, gsc_site_url, ga4_property_id, "createdByAdminId"
        FROM users 
        WHERE id = ${id} AND role = 'BENUTZER'
      `;
    } else if (session.user.role === 'ADMIN') {
      query = sql`
        SELECT id, email, role, domain, gsc_site_url, ga4_property_id, "createdByAdminId"
        FROM users 
        WHERE id = ${id} AND role = 'BENUTZER' AND "createdByAdminId" = ${session.user.id}
      `;
    } else {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const { rows } = await query;
    
    if (rows.length === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    }
    
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen des Projekts:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Aktualisieren eines "Projekts" (= Benutzer)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // Nur Admins und Superadmins dürfen bearbeiten
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const body = await request.json();
    const { email, domain, gsc_site_url, ga4_property_id, password } = body;

    // Validierung
    if (!email || !domain) {
      return NextResponse.json({ message: 'E-Mail und Domain sind erforderlich' }, { status: 400 });
    }

    // Prüfen ob Projekt dem Admin gehört (oder Superadmin ist)
    if (session.user.role === 'ADMIN') {
      const { rows: existingProject } = await sql`
        SELECT * FROM users 
        WHERE id = ${id} AND role = 'BENUTZER' AND "createdByAdminId" = ${session.user.id}
      `;

      if (existingProject.length === 0) {
        return NextResponse.json({ message: 'Projekt nicht gefunden oder keine Berechtigung' }, { status: 404 });
      }
    }

    // Update Query vorbereiten - role wird NICHT geändert (bleibt BENUTZER)
    let updateQuery;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery = sql`
        UPDATE users
        SET 
          email = ${email},
          domain = ${domain},
          gsc_site_url = ${gsc_site_url},
          ga4_property_id = ${ga4_property_id},
          password = ${hashedPassword}
        WHERE id = ${id} AND role = 'BENUTZER'
        RETURNING id, email, role, domain, gsc_site_url, ga4_property_id;
      `;
    } else {
      updateQuery = sql`
        UPDATE users
        SET 
          email = ${email},
          domain = ${domain},
          gsc_site_url = ${gsc_site_url},
          ga4_property_id = ${ga4_property_id}
        WHERE id = ${id} AND role = 'BENUTZER'
        RETURNING id, email, role, domain, gsc_site_url, ga4_property_id;
      `;
    }

    const { rows } = await updateQuery;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Projekts:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Löschen eines "Projekts" (= Benutzer)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // Nur Admins und Superadmins dürfen löschen
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    // Prüfen ob Projekt dem Admin gehört (oder Superadmin ist)
    let deleteQuery;
    if (session.user.role === 'SUPERADMIN') {
      deleteQuery = sql`
        DELETE FROM users 
        WHERE id = ${id} AND role = 'BENUTZER';
      `;
    } else {
      deleteQuery = sql`
        DELETE FROM users 
        WHERE id = ${id} AND role = 'BENUTZER' AND "createdByAdminId" = ${session.user.id};
      `;
    }

    const result = await deleteQuery;

    if (result.rowCount === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden oder keine Berechtigung' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Projekt erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Projekts:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
