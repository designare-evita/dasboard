// src/app/api/data/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api';
import { sql } from '@vercel/postgres';
import { User } from '@/types';

// Hilfsfunktionen (unverändert)
function formatDate(date: Date): string { return date.toISOString().split('T')[0]; }
function calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    const change = ((current - previous) / previous) * 100;
    return Math.round(change * 10) / 10;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    let usersToFetch: Partial<User>[] = [];

    // *** HIER IST DIE NEUE LOGIK FÜR DIE ROLLEN ***
    if (session.user.role === 'SUPERADMIN') {
      // Super Admin: Alle Kunden (Rolle 'USER') abrufen
      const { rows } = await sql<User>`
        SELECT id, email, domain, gsc_site_url, ga4_property_id 
        FROM users 
        WHERE role = 'USER'
      `;
      usersToFetch = rows;

    } else {
      // Normaler Benutzer (oder Admin ohne zugewiesene Kunden, für den Moment)
      const { rows } = await sql<User>`
        SELECT gsc_site_url, ga4_property_id, email, domain
        FROM users 
        WHERE email = ${session.user.email}
      `;
      usersToFetch = rows;
    }

    // Wenn keine Benutzer/Projekte gefunden wurden, eine leere Liste zurückgeben
    if (usersToFetch.length === 0) {
      return NextResponse.json([]);
    }
    
    // Wenn es nur einen Benutzer gibt (Normalfall für Kunden), nur dessen Daten laden
    if (usersToFetch.length === 1 && session.user.role !== 'SUPERADMIN') {
        const user = usersToFetch[0];
        if (!user.gsc_site_url || !user.ga4_property_id) {
             return NextResponse.json({ message: 'Google-Properties nicht konfiguriert.' }, { status: 404 });
        }
        // ... (Logik zum Abrufen der Daten für einen einzelnen Benutzer bleibt gleich)
        // ... (Code aus Platzgründen gekürzt, die Logik ist dieselbe)
        return NextResponse.json({ /* ... Datenobjekt ... */ });
    }

    // Für Super Admin: Eine Liste aller Projekte mit minimalen Daten zurückgeben
    const projects = usersToFetch.map(user => ({
      id: user.id,
      email: user.email,
      domain: user.domain,
    }));

    return NextResponse.json(projects);

  } catch (error) {
    console.error('Fehler in der /api/data Route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    return NextResponse.json({ message: `Fehler beim Abrufen der Dashboard-Daten: ${errorMessage}` }, { status: 500 });
  }
}
