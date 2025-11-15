// src/app/api/project-timeline/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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
    const session = await getServerSession(authOptions);
    
    // KORRIGIERT: Tippfehler behoben (BENUTTER -> BENUTZER)
    if (session?.user?.role !== 'BENUTZER') {
      // Diese Route ist primär für die Kunden-Ansicht gedacht
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    const userId = session.user.id;
    // const gscSiteUrl = session.user.gsc_site_url; // ENTFERNT (Fix 1)

    // 1. Hole Projekt-Details (Start, Dauer, GSC-URL) aus der DB
    const { rows: userRows } = await sql<User>`
      SELECT 
        project_start_date, 
        project_duration_months,
        gsc_site_url -- NEU (Fix 1)
      FROM users 
      WHERE id = ${userId}::uuid;
    `;
    
    if (userRows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }
    
    const project = userRows[0];
    const gscSiteUrl = project.gsc_site_url; // NEU (Fix 1)
    const startDate = project.project_start_date ? new Date(project.project_start_date) : new Date();
    const duration = project.project_duration_months || 6;

    // 2. Aggregiere Landingpage-Status
    const { rows: statusRows } = await sql`
      SELECT 
        status, 
        COUNT(*) AS count 
      FROM landingpages 
      WHERE user_id = ${userId}::uuid
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
        statusCounts[row.status as keyof typeof statusCounts] = parseInt(row.count, 10);
      }
      statusCounts['Total'] += parseInt(row.count, 10);
    });

    // 3. Hole GSC-Daten (Reichweite/Impressionen) seit Projektstart
    let gscData = []; // Initialisiert als Array
    if (gscSiteUrl) {
      try {
        const today = new Date();
        const endDateStr = formatDate(today);
        const startDateStr = formatDate(startDate);

        console.log(`[Timeline API] Rufe GSC-Daten ab für ${gscSiteUrl} von ${startDateStr} bis ${endDateStr}`);
        
        // GSC-Daten (nur Impressionen, täglich) holen
        // GEÄNDERT (Fix 2)
        const gscResult = await getSearchConsoleData(
          gscSiteUrl,
          startDateStr,
          endDateStr,
          ['impressions'], 
          'date'
        );
        
        // NEU (Fix 2): Nur das Array der Impressionen zuweisen
        if (gscResult && gscResult.impressions) {
          gscData = gscResult.impressions;
        }
        
      } catch (gscError) {
        console.error('[Timeline API] Fehler beim Abrufen der GSC-Daten:', gscError);
      }
    } else {
      console.warn('[Timeline API] Keine gsc_site_url für Benutzer konfiguriert.');
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
      gscImpressionTrend: gscData,
    });

  } catch (error) {
    console.error('[GET /api/project-timeline] Fehler:', error);
    return NextResponse.json({ 
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}
