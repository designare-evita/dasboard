import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    const adminEmail = process.env.SUPERADMIN_EMAIL;
    if (!adminEmail) {
      throw new Error('SUPERADMIN_EMAIL ist in Vercel nicht gesetzt.');
    }

    const gscUrl = 'https://max-online.at/';
    const ga4Id = '421293385';

    await sql`
      UPDATE users
      SET 
        gsc_site_url = ${gscUrl},
        ga4_property_id = ${ga4Id},
        domain = 'max-online.at'
      WHERE 
        email = ${adminEmail.toLowerCase()};
    `;

    return NextResponse.json({ message: `Super-Admin-Konto wurde erfolgreich mit den Daten für ${gscUrl} verknüpft.` });
  } catch (error) {
    return NextResponse.json(
      { message: 'Fehler beim Aktualisieren des Super-Admin-Kontos', error: (error as Error).message },
      { status: 500 }
    );
  }
}
