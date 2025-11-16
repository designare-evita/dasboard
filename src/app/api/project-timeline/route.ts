// src/app/api/project-timeline/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth
import { getSearchConsoleData } from '@/lib/google-api';
import { User } from '@/types';
import { unstable_noStore as noStore } from 'next/cache';

// Hilfsfunktion: Format YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  noStore(); // Caching für diese dynamische Route verhindern
  
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId'); // Für Admin-Abfragen
    
    let targetUserId: string;
    let userGscUrl: string | null | undefined;
    const sessionUser = session.user;

    // --- KORRIGIERT: Logik zur Bestimmung der Ziel-ID ---
    if (sessionUser.role === 'BENUTZER') {
      // Kunde fragt EIGENE Daten ab
      targetUserId = sessionUser.id;
      userGscUrl = sessionUser.gsc_site_url;
    } else if ((sessionUser.role === 'ADMIN' || sessionUser.role === 'SUPERADMIN') && projectId) {
      // Admin fragt ein SPEZIFISCHES Projekt ab
      targetUserId = projectId;
      // GSC-URL des ZIEL-Projekts laden
      const { rows: projectRows } = await sql`
        SELECT gsc_site_url 
        FROM users 
        WHERE id = ${targetUserId}::uuid;
      `;
      if (projectRows.length > 0) {
        userGscUrl = projectRows[0].gsc_site_url;
      }
      // (Die Berechtigungsprüfung für Admins erfolgt bereits auf der Seite, die diese API aufruft)
    } else {
      // Ungültiger Aufruf
      return NextResponse.json({ message: 'Ungültige Anfrage' }, { status: 400 });
    }
    // --- ENDE KORREKTUR ---


    // 1. Hole Projekt-Details (Start, Dauer) aus der DB für die Ziel-ID
    const { rows: userRows } = await sql<User>`
      SELECT 
        project_start_date, 
        project_duration_months 
      FROM users 
      WHERE id = ${targetUserId}::uuid;
    `;
    
    if (userRows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }
    
    const project = userRows[0];
    const startDate = project.project_start_date ? new Date(project.project_start_date) : new Date();
    const duration = project.project_duration_months || 6;

    // 2. Aggregiere Landingpage-Status für die Ziel-ID
    const { rows: statusRows } = await sql`
      SELECT 
        status, 
        COUNT(*) AS count 
      FROM landingpages 
      WHERE user_id = ${targetUserId}::uuid
      GROUP BY status;
    `;

    const statusCounts = {
      'Offen': 0,
      'In Prüfung': 0,
      'Gesperrt': 0,
      'Freigegeben': 0,
      'Total': 0,
    };

    statusRows.forEach(row => {
      if (row.status in statusCounts) {
        statusCounts[row.status as keyof typeof statusCounts] = parseInt(String(row.count), 10);
      }
      statusCounts['Total'] += parseInt(String(row.count), 10);
    });

    // 3. Hole GSC-Daten (Reichweite/Impressionen) seit Projektstart
    let gscImpressionTrend: { date: string; value: number }[] = [];

    // KORRIGIERT: userGscUrl statt gscSiteUrl (das war die GSC-URL des Admins)
    if (userGscUrl) {
      try {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() - 2); 
        
        const endDateStr = formatDate(endDate);
        const startDateStr = formatDate(startDate);
        
        if (startDateStr < endDateStr) {
          console.log(`[Timeline API] Rufe GSC-Daten ab für ${userGscUrl} von ${startDateStr} bis ${endDateStr}`);
          
          const gscDataResult = await getSearchConsoleData(
            userGscUrl,
            startDateStr,
            endDateStr
          );
          
          gscImpressionTrend = gscDataResult.impressions.daily;

        } else {
           console.log('[Timeline API] Projektstart liegt in der Zukunft oder zu nah am Enddatum. Überspringe GSC-Abruf.');
        }
        
      } catch (gscError) {
        console.error('[Timeline API] Fehler beim Abrufen der GSC-Daten:', gscError);
      }
    } else {
      console.warn(`[Timeline API] Keine gsc_site_url für Benutzer ${targetUserId} konfiguriert.`);
    }

    // 4. Daten kombinieren und zurückgeben
    return NextResponse.json({
      project: {
        startDate: startDate.toISOString(),
        durationMonths: duration,
      },
      progress: {
        counts: statusCounts,
        percentage: statusCounts.Total > 0 
          ? (statusCounts['Freigegeben'] / statusCounts.Total) * 100 
          : 0,
      },
      gscImpressionTrend: gscImpressionTrend,
    });

  } catch (error) {
    console.error('[GET /api/project-timeline] Fehler:', error);
    return NextResponse.json({ 
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}
