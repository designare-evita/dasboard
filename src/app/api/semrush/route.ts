// src/app/api/semrush/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { User } from '@/types';
import { getSemrushDomainOverview } from '@/lib/semrush-api';

/**
 * GET /api/semrush
 * Lädt Semrush-Daten für einen Benutzer
 * Query-Parameter: 
 *   - projectId (optional): Für Admins um spezifisches Projekt zu laden
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    console.log('[/api/semrush] GET Request');
    console.log('[/api/semrush] User:', session.user.email, 'Role:', role, 'ProjectId:', projectId || 'none');

    // Bestimme welcher User geladen werden soll
    let targetUserId: string;

    if (projectId) {
      // Admin/Superadmin lädt Daten für ein spezifisches Projekt
      if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
      }

      // Wenn ADMIN: Prüfe ob Zugriff erlaubt ist
      if (role === 'ADMIN') {
        const { rows: assignments } = await sql`
          SELECT 1 
          FROM project_assignments 
          WHERE user_id::text = ${id} 
          AND project_id::text = ${projectId}
        `;

        if (assignments.length === 0) {
          console.warn('[/api/semrush] ⚠️ Admin hat keinen Zugriff auf dieses Projekt');
          return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
        }
      }

      targetUserId = projectId;
    } else {
      // Benutzer lädt seine eigenen Daten
      targetUserId = id;
    }

    console.log('[/api/semrush] Lade Semrush-Daten für User:', targetUserId);

    // Lade User-Konfiguration aus der Datenbank
    const { rows } = await sql<User>`
      SELECT 
        domain,
        email
      FROM users 
      WHERE id::text = ${targetUserId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const user = rows[0];

    // Prüfe ob Domain konfiguriert ist
    if (!user.domain) {
      console.log('[/api/semrush] Keine Domain für User:', user.email);
      return NextResponse.json({
        organicKeywords: null,
        organicTraffic: null,
        lastFetched: null
      });
    }

    console.log('[/api/semrush] Rufe Semrush-Daten für Domain:', user.domain);

    // Abrufen der Semrush-Daten über die bestehende Funktion
    const semrushData = await getSemrushDomainOverview(user.domain, 'de');

    // Prüfe ob ein Fehler aufgetreten ist
    if ('error' in semrushData) {
      console.warn('[/api/semrush] Fehler beim Abrufen der Semrush-Daten:', semrushData.error);
      return NextResponse.json({
        organicKeywords: null,
        organicTraffic: null,
        lastFetched: new Date().toISOString()
      });
    }

    console.log('[/api/semrush] ✅ Semrush-Daten erfolgreich geladen');
    console.log('[/api/semrush] Keywords:', semrushData.organicKeywords, 'Traffic:', semrushData.organicTraffic);

    // Response mit lastFetched Timestamp
    return NextResponse.json({
      organicKeywords: semrushData.organicKeywords,
      organicTraffic: semrushData.organicTraffic,
      lastFetched: new Date().toISOString()
    });

  } catch (error) {
    console.error('[/api/semrush] Fehler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ 
      message: `Fehler beim Abrufen der Semrush-Daten: ${errorMessage}`,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
