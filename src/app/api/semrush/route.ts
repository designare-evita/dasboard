// src/app/api/semrush/route.ts (DEAKTIVIERT)
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
// import { sql } from '@vercel/postgres';
// import { User } from '@/types';
// import { getSemrushData } from '@/lib/semrush-api'; // Deaktiviert

/**
 * GET /api/semrush
 * DEAKTIVIERT: Diese Route wurde deaktiviert, da nur noch Keyword-Tracking verwendet wird.
 * Nutzen Sie stattdessen /api/semrush/keywords
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    console.warn('[/api/semrush] DEPRECATED: Dieser API-Endpunkt (für Domain Overview) ist deaktiviert.');

    return NextResponse.json({ 
      message: 'Dieser API-Endpunkt ist deaktiviert. Bitte /api/semrush/keywords verwenden.',
      organicKeywords: null,
      organicTraffic: null,
      lastFetched: null,
      fromCache: false,
      error: 'Endpoint deprecated'
    }, { status: 404 });

  } catch (error) {
    console.error('[/api/semrush] Fehler im deaktivierten Endpunkt:', error);
    return NextResponse.json({ 
      message: 'Dieser API-Endpunkt ist deaktiviert.',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
