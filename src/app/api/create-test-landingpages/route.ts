// src/app/api/create-test-landingpages/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Nur Admins und Superadmins dürfen Test-Daten erstellen
    if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');

    if (!userIdParam) {
      return NextResponse.json({ 
        message: 'userId Parameter fehlt',
        usage: '/api/create-test-landingpages?userId=USER_ID'
      }, { status: 400 });
    }

    console.log('[Create Test Landingpages] User ID:', userIdParam);

    // Prüfe, ob User existiert
    const { rows: users } = await sql`
      SELECT id, email, domain, role
      FROM users
      WHERE id::text = ${userIdParam};
    `;

    if (users.length === 0) {
      return NextResponse.json({ 
        message: 'Benutzer nicht gefunden',
        userId: userIdParam
      }, { status: 404 });
    }

    const user = users[0];
    console.log('[Create Test Landingpages] User gefunden:', user.email);

    // Erstelle Test-Landingpages
    const testPages = [
      {
        url: `https://${user.domain || 'example.com'}/seo-optimierung`,
        haupt_keyword: 'SEO Optimierung',
        weitere_keywords: 'Suchmaschinenoptimierung, SEO Beratung',
        suchvolumen: 1200,
        aktuelle_position: 15,
        status: 'Offen'
      },
      {
        url: `https://${user.domain || 'example.com'}/online-marketing`,
        haupt_keyword: 'Online Marketing',
        weitere_keywords: 'Digital Marketing, Marketing Strategie',
        suchvolumen: 2500,
        aktuelle_position: 8,
        status: 'In Prüfung'
      },
      {
        url: `https://${user.domain || 'example.com'}/content-marketing`,
        haupt_keyword: 'Content Marketing',
        weitere_keywords: 'Content Strategie, Blogging',
        suchvolumen: 1800,
        aktuelle_position: 12,
        status: 'Offen'
      },
      {
        url: `https://${user.domain || 'example.com'}/social-media`,
        haupt_keyword: 'Social Media Marketing',
        weitere_keywords: 'Facebook Marketing, Instagram Marketing',
        suchvolumen: 3200,
        aktuelle_position: 6,
        status: 'Freigegeben'
      },
      {
        url: `https://${user.domain || 'example.com'}/webdesign`,
        haupt_keyword: 'Webdesign',
        weitere_keywords: 'Website Gestaltung, UX Design',
        suchvolumen: 980,
        aktuelle_position: 20,
        status: 'Gesperrt'
      }
    ];

    const createdPages = [];

    for (const page of testPages) {
      try {
        const { rows } = await sql`
          INSERT INTO landingpages (
            user_id, 
            url, 
            haupt_keyword, 
            weitere_keywords, 
            suchvolumen, 
            aktuelle_position, 
            status
          )
          VALUES (
            ${userIdParam}::uuid,
            ${page.url},
            ${page.haupt_keyword},
            ${page.weitere_keywords},
            ${page.suchvolumen},
            ${page.aktuelle_position},
            ${page.status}
          )
          ON CONFLICT (url, user_id) 
          DO UPDATE SET
            haupt_keyword = EXCLUDED.haupt_keyword,
            status = EXCLUDED.status
          RETURNING id, url, status;
        `;

        createdPages.push(rows[0]);
        console.log('✅ Erstellt:', rows[0].url);

      } catch (pageError) {
        console.error('❌ Fehler bei Page:', page.url, pageError);
      }
    }

    // Zähle finale Landingpages für diesen User
    const { rows: countResult } = await sql`
      SELECT COUNT(*) as count
      FROM landingpages
      WHERE user_id::text = ${userIdParam};
    `;

    return NextResponse.json({
      success: true,
      message: '✅ Test-Landingpages erfolgreich erstellt!',
      user: {
        id: user.id,
        email: user.email,
        domain: user.domain
      },
      created: createdPages.length,
      total: parseInt(countResult[0].count),
      pages: createdPages
    });

  } catch (error) {
    console.error('❌ Fehler beim Erstellen der Test-Landingpages:', error);
    return NextResponse.json(
      { 
        message: 'Fehler beim Erstellen',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// POST: Batch-Create für mehrere User
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nur für Superadmins' }, { status: 401 });
    }

    // Erstelle für alle BENUTZER Test-Landingpages
    const { rows: customers } = await sql`
      SELECT id::text, email, domain
      FROM users
      WHERE role = 'BENUTZER';
    `;

    const results = [];

    for (const customer of customers) {
      try {
        const response = await fetch(
          `${request.url}?userId=${customer.id}`,
          { method: 'GET' }
        );
        const data = await response.json();
        results.push({
          customer: customer.email,
          success: response.ok,
          created: data.created
        });
      } catch (err) {
        results.push({
          customer: customer.email,
          success: false,
          error: err instanceof Error ? err.message : 'Fehler'
        });
      }
    }

    return NextResponse.json({
      message: 'Batch-Erstellung abgeschlossen',
      results
    });

  } catch (error) {
    console.error('Batch-Fehler:', error);
    return NextResponse.json(
      { message: 'Fehler beim Batch-Erstellen' },
      { status: 500 }
    );
  }
}
