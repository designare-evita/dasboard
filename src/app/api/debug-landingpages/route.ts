// src/app/api/debug-landingpages/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const results: Record<string, unknown> = {
      currentUser: {
        email: session.user.email,
        role: session.user.role,
        id: session.user.id
      }
    };

    // 1. Alle Landingpages mit User-Info
    const { rows: allLandingpages } = await sql`
      SELECT 
        lp.id,
        lp.user_id::text,
        lp.url,
        lp.haupt_keyword,
        lp.status,
        lp.created_at,
        u.email as user_email,
        u.domain as user_domain,
        u.role as user_role
      FROM landingpages lp
      LEFT JOIN users u ON lp.user_id = u.id
      ORDER BY lp.created_at DESC
      LIMIT 20;
    `;
    
    results.allLandingpages = allLandingpages;
    results.totalCount = allLandingpages.length;

    // 2. Landingpages für den aktuellen User
    const { rows: userLandingpages } = await sql`
      SELECT 
        id,
        url,
        haupt_keyword,
        status,
        created_at,
        user_id::text
      FROM landingpages
      WHERE user_id::text = ${session.user.id}
      ORDER BY created_at DESC;
    `;
    
    results.myLandingpages = userLandingpages;
    results.myCount = userLandingpages.length;

    // 3. Status-Verteilung
    const { rows: statusDistribution } = await sql`
      SELECT 
        status,
        COUNT(*) as count,
        user_id::text
      FROM landingpages
      GROUP BY status, user_id;
    `;
    
    results.statusDistribution = statusDistribution;

    // 4. Prüfe Tabellen-Schema
    const { rows: tableSchema } = await sql`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'landingpages'
      ORDER BY ordinal_position;
    `;
    
    results.tableSchema = tableSchema;

    // 5. Wenn Admin: Zeige alle Kunden mit Landingpage-Counts
    if (session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN') {
      const { rows: customerStats } = await sql`
        SELECT 
          u.id::text,
          u.email,
          u.domain,
          COUNT(lp.id) as landingpage_count
        FROM users u
        LEFT JOIN landingpages lp ON u.id = lp.user_id
        WHERE u.role = 'BENUTZER'
        GROUP BY u.id, u.email, u.domain
        ORDER BY landingpage_count DESC;
      `;
      
      results.customerStats = customerStats;
    }

    // 6. Beispiel-Daten für schnellen Test
    results.exampleQuery = {
      description: "Um Landingpages für einen User zu erstellen, nutze:",
      userId: session.user.id,
      sql: `INSERT INTO landingpages (user_id, url, haupt_keyword, status) VALUES ('${session.user.id}', 'https://example.com/test', 'Test Keyword', 'Offen');`
    };

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('Debug-Fehler:', error);
    return NextResponse.json(
      { 
        message: 'Fehler beim Debugging',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
