// src/app/api/users/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    
    // Prüfung: Nur Admins/Superadmins dürfen die Liste sehen
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const onlyCustomers = searchParams.get('onlyCustomers') === 'true';

    // SQL Query mit Aggregationen für Landingpage-Status und Admin-Email
    // Wir nutzen Conditional Aggregation (SUM CASE...), um die verschiedenen Status zu zählen.
    const query = `
      SELECT 
        u.*,
        creator.email AS creator_email,
        COUNT(lp.id) AS landingpages_count,
        SUM(CASE WHEN lp.status = 'Offen' THEN 1 ELSE 0 END) AS landingpages_offen,
        SUM(CASE WHEN lp.status = 'In Prüfung' THEN 1 ELSE 0 END) AS landingpages_in_pruefung,
        SUM(CASE WHEN lp.status = 'Freigegeben' THEN 1 ELSE 0 END) AS landingpages_freigegeben,
        SUM(CASE WHEN lp.status = 'Gesperrt' THEN 1 ELSE 0 END) AS landingpages_gesperrt
      FROM users u
      LEFT JOIN users creator ON u."createdByAdminId" = creator.id
      LEFT JOIN landingpages lp ON u.id = lp.user_id
      ${onlyCustomers ? "WHERE u.role = 'BENUTZER'" : ''}
      GROUP BY u.id, creator.email
      ORDER BY u."createdAt" DESC
    `;

    const { rows } = await sql.query(query);

    // Konvertiere die Count-Strings (Postgres liefert count oft als String) in Numbers
    const cleanedRows = rows.map(user => ({
      ...user,
      landingpages_count: Number(user.landingpages_count || 0),
      landingpages_offen: Number(user.landingpages_offen || 0),
      landingpages_in_pruefung: Number(user.landingpages_in_pruefung || 0),
      landingpages_freigegeben: Number(user.landingpages_freigegeben || 0),
      landingpages_gesperrt: Number(user.landingpages_gesperrt || 0),
    }));

    return NextResponse.json(cleanedRows);
  } catch (error) {
    console.error('Fehler beim Laden der User:', error);
    return NextResponse.json({ message: 'Fehler beim Laden der Benutzer' }, { status: 500 });
  }
}
