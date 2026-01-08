// src/app/api/ai-traffic-detail/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { UserSchema } from '@/lib/schemas';
import { getAiTrafficDetailWithComparison } from '@/lib/ai-traffic-extended';

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30d';
    const projectId = searchParams.get('projectId');

    console.log('[/api/ai-traffic-detail] Request von:', session.user.email);
    console.log('[/api/ai-traffic-detail] DateRange:', dateRange, 'ProjectId:', projectId || 'self');

    // Ziel-User ID bestimmen
    let targetUserId = id;
    
    // Admin/Superadmin können andere Projekte abfragen
    if ((role === 'ADMIN' || role === 'SUPERADMIN') && projectId) {
      // Berechtigungsprüfung für normale Admins
      if (role === 'ADMIN') {
        const { rows: assignments } = await sql`
          SELECT 1 FROM project_assignments
          WHERE user_id::text = ${id} AND project_id::text = ${projectId}
        `;
        if (assignments.length === 0) {
          return NextResponse.json({ message: 'Zugriff verweigert.' }, { status: 403 });
        }
      }
      targetUserId = projectId;
    }

    // User-Daten laden
    const { rows } = await sql`
      SELECT * FROM users WHERE id::text = ${targetUserId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const parseResult = UserSchema.safeParse(rows[0]);
    if (!parseResult.success) {
      return NextResponse.json({ message: 'Benutzerdaten fehlerhaft' }, { status: 500 });
    }

    const user = parseResult.data;

    // GA4 Property prüfen
    if (!user.ga4_property_id) {
      return NextResponse.json({ 
        message: 'GA4 Property nicht konfiguriert',
        data: null 
      }, { status: 200 });
    }

    // Datumsbereich berechnen
    const end = new Date();
    end.setDate(end.getDate() - 1); // Gestern als End-Datum

    const start = new Date(end);
    let days = 30;
    if (dateRange === '7d') days = 7;
    if (dateRange === '3m') days = 90;
    if (dateRange === '6m') days = 180;
    if (dateRange === '12m') days = 365;
    start.setDate(end.getDate() - days);

    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    // Vorperiode berechnen
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - days);

    const prevStartStr = prevStart.toISOString().split('T')[0];
    const prevEndStr = prevEnd.toISOString().split('T')[0];

    console.log(`[AI Traffic Detail] Periode: ${startDateStr} - ${endDateStr}`);
    console.log(`[AI Traffic Detail] Vergleich: ${prevStartStr} - ${prevEndStr}`);

    // Daten laden
    const data = await getAiTrafficDetailWithComparison(
      user.ga4_property_id,
      startDateStr,
      endDateStr,
      prevStartStr,
      prevEndStr
    );

    return NextResponse.json({ data });

  } catch (error) {
    console.error('[/api/ai-traffic-detail] Fehler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({
      message: `Fehler beim Abrufen der KI-Traffic-Daten: ${errorMessage}`,
      data: null
    }, { status: 500 });
  }
}
