import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET a single user by ID
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const { id } = params;

  try {
    const data = await sql`SELECT id, email, domain, gsc_site_url, ga4_property_id FROM users WHERE id = ${id}`;
    if (data.rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }
    return NextResponse.json(data.rows[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen des Benutzers:', error);
    return NextResponse.json({ message: 'Fehler beim Abrufen des Benutzers' }, { status: 500 });
  }
}

// UPDATE a user by ID
export async function PUT(request: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
        return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id } = params;
    const { email, domain, gsc_site_url, ga4_property_id } = await request.json();

    if (!email || !domain || !gsc_site_url || !ga4_property_id) {
        return NextResponse.json({ message: 'Alle Felder sind erforderlich' }, { status: 400 });
    }

    try {
        await sql`
            UPDATE users
            SET email = ${email.toLowerCase()}, domain = ${domain}, gsc_site_url = ${gsc_site_url}, ga4_property_id = ${ga4_property_id}
            WHERE id = ${id}
        `;
        return NextResponse.json({ message: 'Benutzer erfolgreich aktualisiert' });
    } catch (error) {
        console.error('Fehler beim Aktualisieren des Benutzers:', error);
        return NextResponse.json({ message: 'Fehler beim Aktualisieren des Benutzers' }, { status: 500 });
    }
}

// DELETE a user by ID
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
        return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id } = params;

    try {
        await sql`DELETE FROM users WHERE id = ${id}`;
        return NextResponse.json({ message: 'Benutzer erfolgreich gelöscht' });
    } catch (error) {
        console.error('Fehler beim Löschen des Benutzers:', error);
        return NextResponse.json({ message: 'Fehler beim Löschen des Benutzers' }, { status: 500 });
    }
}
