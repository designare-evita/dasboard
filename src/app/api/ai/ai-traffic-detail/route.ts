// src/app/api/ai-traffic-detail/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { UserSchema } from '@/lib/schemas';

// Dynamischer Import um Build-Fehler zu vermeiden
async function getAiTrafficData(
  propertyId: string,
  currentStart: string,
  currentEnd: string,
  previousStart: string,
  previousEnd: string
) {
  const { getAiTrafficDetailWithComparison } = await import('@/lib/ai-traffic-extended');
  return getAiTrafficDetailWithComparison(propertyId, currentStart, currentEnd, previousStart, previousEnd);
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  console.log('[/api/ai-traffic-detail] Route aufgerufen');
  
  try {
    // 1. Auth prüfen
    let session;
    try {
      session = await auth();
    } catch (authError) {
      console.error('[/api/ai-traffic-detail] Auth Fehler:', authError);
      return NextResponse.json({ 
        message: 'Authentifizierungsfehler', 
        data: null 
      }, { status: 401 });
    }

    if (!session?.user?.email) {
      return NextResponse.json({ 
        message: 'Nicht autorisiert', 
        data: null 
      }, { status: 401 });
    }

    const { role, id } = session.user;
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30d';
    const projectId = searchParams.get('projectId');

    console.log('[/api/ai-traffic-detail] User:', session.user.email);
    console.log('[/api/ai-traffic-detail] DateRange:', dateRange, 'ProjectId:', projectId || 'self');

    // 2. Ziel-User ID bestimmen
    let targetUserId = id;
    
    if ((role === 'ADMIN' || role === 'SUPERADMIN') && projectId) {
      if (role === 'ADMIN') {
        try {
          const { rows: assignments } = await sql`
            SELECT 1 FROM project_assignments
            WHERE user_id::text = ${id} AND project_id::text = ${projectId}
          `;
          if (assignments.length === 0) {
            return NextResponse.json({ 
              message: 'Zugriff verweigert.', 
              data: null 
            }, { status: 403 });
          }
        } catch (dbError) {
          console.error('[/api/ai-traffic-detail] DB-Fehler (assignments):', dbError);
        }
      }
      targetUserId = projectId;
    }

    // 3. User-Daten laden
    let user;
    try {
      const { rows } = await sql`
        SELECT * FROM users WHERE id::text = ${targetUserId}
      `;

      if (rows.length === 0) {
        return NextResponse.json({ 
          message: 'Benutzer nicht gefunden', 
          data: null 
        }, { status: 404 });
      }

      const parseResult = UserSchema.safeParse(rows[0]);
      if (!parseResult.success) {
        console.error('[/api/ai-traffic-detail] User Parse Error:', parseResult.error);
        return NextResponse.json({ 
          message: 'Benutzerdaten fehlerhaft', 
          data: null 
        }, { status: 500 });
      }

      user = parseResult.data;
    } catch (dbError) {
      console.error('[/api/ai-traffic-detail] DB-Fehler (user):', dbError);
      return NextResponse.json({ 
        message: 'Datenbankfehler', 
        data: null 
      }, { status: 500 });
    }

    // 4. GA4 Property prüfen
    if (!user.ga4_property_id) {
      console.log('[/api/ai-traffic-detail] Keine GA4 Property konfiguriert');
      return NextResponse.json({ 
        message: 'GA4 Property nicht konfiguriert',
        data: null 
      }, { status: 200 });
    }

    // 5. Datumsbereich berechnen
    const end = new Date();
    end.setDate(end.getDate() - 1);

    const start = new Date(end);
    let days = 30;
    if (dateRange === '7d') days = 7;
    if (dateRange === '3m') days = 90;
    if (dateRange === '6m') days = 180;
    if (dateRange === '12m') days = 365;
    start.setDate(end.getDate() - days);

    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - days);

    const prevStartStr = prevStart.toISOString().split('T')[0];
    const prevEndStr = prevEnd.toISOString().split('T')[0];

    console.log(`[/api/ai-traffic-detail] Periode: ${startDateStr} - ${endDateStr}`);

    // 6. GA4 Daten laden
    try {
      const data = await getAiTrafficData(
        user.ga4_property_id,
        startDateStr,
        endDateStr,
        prevStartStr,
        prevEndStr
      );

      console.log('[/api/ai-traffic-detail] Daten erfolgreich geladen');
      return NextResponse.json({ data });

    } catch (gaError) {
      console.error('[/api/ai-traffic-detail] GA4 API Fehler:', gaError);
      
      // Leere Daten zurückgeben statt Fehler
      return NextResponse.json({ 
        message: 'GA4 Daten konnten nicht geladen werden',
        data: {
          totalSessions: 0,
          totalUsers: 0,
          avgEngagementTime: 0,
          bounceRate: 0,
          conversions: 0,
          sources: [],
          landingPages: [],
          trend: []
        }
      }, { status: 200 });
    }

  } catch (error) {
    console.error('[/api/ai-traffic-detail] Unerwarteter Fehler:', error);
    return NextResponse.json({
      message: error instanceof Error ? error.message : 'Interner Serverfehler',
      data: null
    }, { status: 500 });
  }
}
