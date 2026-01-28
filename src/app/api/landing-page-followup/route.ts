// src/app/api/landing-page-followup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth'; // ✅ NextAuth v5 aus deiner auth.ts
import { sql } from '@vercel/postgres';
import { getLandingPageFollowUpPaths } from '@/lib/google-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // ✅ Auth Check
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Parameter aus URL holen
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const dateRange = searchParams.get('dateRange') || '30d';
    const landingPage = searchParams.get('landingPage');

    if (!landingPage) {
      return NextResponse.json({ error: 'landingPage Parameter fehlt' }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId Parameter fehlt' }, { status: 400 });
    }

    // GA4 Property ID ermitteln
    let ga4PropertyId: string | null = null;
    let siteUrl: string | null = null;

    // Projekt-basiert
    const { rows } = await sql`
      SELECT u.ga4_property_id, u.gsc_site_url, u.domain
      FROM projects p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ${projectId}::uuid
      LIMIT 1
    `;
    
    if (rows.length > 0) {
      ga4PropertyId = rows[0].ga4_property_id;
      siteUrl = rows[0].gsc_site_url || rows[0].domain;
    }

    if (!ga4PropertyId) {
      return NextResponse.json({ error: 'GA4 Property nicht konfiguriert' }, { status: 400 });
    }

    // Datumsbereich berechnen
    const end = new Date();
    end.setDate(end.getDate() - 1); // Gestern
    
    const start = new Date(end);
    let days = 30;
    
    switch (dateRange) {
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '3m': days = 90; break;
      case '6m': days = 180; break;
      case '12m': days = 365; break;
      case '18m': days = 548; break;
      case '24m': days = 730; break;
    }
    
    start.setDate(end.getDate() - days);
    
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    // Folgepfade von GA4 abrufen
    const followUpData = await getLandingPageFollowUpPaths(
      ga4PropertyId,
      landingPage,
      startDateStr,
      endDateStr,
      siteUrl || undefined
    );

    return NextResponse.json({ 
      data: followUpData,
      meta: {
        landingPage,
        dateRange,
        startDate: startDateStr,
        endDate: endDateStr
      }
    });

  } catch (error) {
    console.error('[API /landing-page-followup] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
