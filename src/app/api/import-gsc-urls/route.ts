// src/app/api/import-gsc-urls/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

function createAuth(): JWT {
  const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  
  if (!privateKeyBase64 || !clientEmail) {
    throw new Error('Google API Credentials fehlen');
  }

  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
  return new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Nur für Superadmins und Admins
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      userId,           // Pflicht: User ID des Projekts
      deleteExisting,   // Optional: Alte URLs löschen? (default: false)
      minClicks,        // Optional: Min. Klicks (default: 5)
      limit,            // Optional: Max. URLs (default: 50)
      daysBack,         // Optional: Zeitraum in Tagen (default: 30)
    } = body;

    if (!userId) {
      return NextResponse.json({ message: 'userId ist erforderlich' }, { status: 400 });
    }

    // Berechtigungsprüfung für Admins
    if (session.user.role === 'ADMIN') {
      const { rows: accessCheck } = await sql`
        SELECT 1 FROM project_assignments 
        WHERE user_id::text = ${session.user.id} 
        AND project_id::text = ${userId}
      `;
      
      if (accessCheck.length === 0) {
        return NextResponse.json({ message: 'Zugriff auf dieses Projekt verweigert' }, { status: 403 });
      }
    }

    console.log(`[Import GSC URLs] Start für User: ${userId}`);

    // 1. Lade User-Daten
    const { rows: users } = await sql`
      SELECT id, email, gsc_site_url, domain 
      FROM users 
      WHERE id::text = ${userId}
    `;

    if (users.length === 0) {
      return NextResponse.json({ message: 'User nicht gefunden' }, { status: 404 });
    }

    const user = users[0];
    console.log(`[Import GSC URLs] User gefunden: ${user.email}`);

    if (!user.gsc_site_url) {
      return NextResponse.json({ 
        message: 'Keine GSC Site URL für diesen User konfiguriert' 
      }, { status: 400 });
    }

    // 2. Hole GSC-Daten
    const auth = createAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 3); // GSC Delay
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (daysBack || 30));

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    console.log(`[Import GSC URLs] Zeitraum: ${formatDate(startDate)} bis ${formatDate(endDate)}`);
    console.log(`[Import GSC URLs] Site URL: ${user.gsc_site_url}`);

    const response = await searchconsole.searchanalytics.query({
      siteUrl: user.gsc_site_url,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['page'],
        type: 'web',
        aggregationType: 'byPage',
        rowLimit: 1000, // Hoch setzen, dann später filtern
      },
    });

    const rows = response.data.rows || [];
    console.log(`[Import GSC URLs] GSC lieferte ${rows.length} URLs`);

    if (rows.length === 0) {
      return NextResponse.json({ 
        message: 'Keine URLs in GSC gefunden für diesen Zeitraum',
        siteUrl: user.gsc_site_url,
        dateRange: { start: formatDate(startDate), end: formatDate(endDate) }
      }, { status: 404 });
    }

    // 3. Filtere und sortiere URLs
    const minClicksThreshold = minClicks || 5;
    const maxUrls = limit || 50;

    const filteredUrls = rows
      .filter(row => {
        const url = row.keys?.[0];
        const clicks = row.clicks || 0;
        
        // Nur URLs mit ausreichend Klicks
        if (clicks < minClicksThreshold) return false;
        
        // Keine PDFs, Bilder, etc.
        if (url?.match(/\.(pdf|jpg|jpeg|png|gif|zip|xml)$/i)) return false;
        
        return true;
      })
      .map(row => ({
        url: row.keys![0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        position: row.position || 0,
      }))
      .sort((a, b) => b.clicks - a.clicks) // Sortiere nach Klicks
      .slice(0, maxUrls);

    console.log(`[Import GSC URLs] Nach Filterung: ${filteredUrls.length} URLs`);

    if (filteredUrls.length === 0) {
      return NextResponse.json({ 
        message: `Keine URLs mit mindestens ${minClicksThreshold} Klicks gefunden`,
        totalUrls: rows.length,
      }, { status: 404 });
    }

    // 4. Optional: Lösche alte Landingpages
    let deletedCount = 0;
    if (deleteExisting === true) {
      console.log(`[Import GSC URLs] Lösche bestehende Landingpages...`);
      const deleteResult = await sql`
        DELETE FROM landingpages 
        WHERE user_id::text = ${userId}
      `;
      deletedCount = deleteResult.rowCount || 0;
      console.log(`[Import GSC URLs] ${deletedCount} alte URLs gelöscht`);
    }

    // 5. Füge neue URLs ein
    let insertedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;

    for (const gscUrl of filteredUrls) {
      try {
        // Versuche INSERT, bei Konflikt (URL existiert bereits) nichts tun
        const result = await sql`
          INSERT INTO landingpages (
            user_id, 
            url, 
            status, 
            created_at,
            gsc_klicks,
            gsc_impressionen,
            gsc_position
          )
          VALUES (
            ${userId}::uuid,
            ${gscUrl.url},
            'Offen',
            NOW(),
            ${gscUrl.clicks},
            ${gscUrl.impressions},
            ${gscUrl.position === 0 ? null : gscUrl.position}
          )
          ON CONFLICT (url, user_id) 
          DO UPDATE SET
            gsc_klicks = ${gscUrl.clicks},
            gsc_impressionen = ${gscUrl.impressions},
            gsc_position = ${gscUrl.position === 0 ? null : gscUrl.position},
            gsc_last_updated = NOW()
          RETURNING (xmax = 0) as inserted;
        `;
        
        // xmax = 0 bedeutet INSERT, xmax > 0 bedeutet UPDATE
        if (result.rows[0]?.inserted) {
          insertedCount++;
        } else {
          updatedCount++;
        }

      } catch (err) {
        console.error(`[Import GSC URLs] Fehler bei URL: ${gscUrl.url}`, err);
        skippedCount++;
      }
    }

    console.log(`[Import GSC URLs] ✅ Abgeschlossen: ${insertedCount} eingefügt, ${updatedCount} aktualisiert, ${skippedCount} übersprungen`);

    // 6. Invalidiere Google Data Cache
    try {
      await sql`
        DELETE FROM google_data_cache 
        WHERE user_id::text = ${userId}
      `;
      console.log(`[Import GSC URLs] Cache invalidiert`);
    } catch (cacheError) {
      console.warn(`[Import GSC URLs] Cache-Invalidierung fehlgeschlagen:`, cacheError);
    }

    return NextResponse.json({
      success: true,
      message: `✅ Import erfolgreich abgeschlossen`,
      summary: {
        user: {
          id: user.id,
          email: user.email,
          domain: user.domain,
          gscSiteUrl: user.gsc_site_url,
        },
        stats: {
          totalGscUrls: rows.length,
          filteredUrls: filteredUrls.length,
          inserted: insertedCount,
          updated: updatedCount,
          skipped: skippedCount,
          deleted: deletedCount,
        },
        settings: {
          minClicks: minClicksThreshold,
          limit: maxUrls,
          daysBack: daysBack || 30,
          deleteExisting: deleteExisting || false,
        },
        dateRange: {
          start: formatDate(startDate),
          end: formatDate(endDate),
        },
      },
      topUrls: filteredUrls.slice(0, 10).map(u => ({
        url: u.url,
        clicks: u.clicks,
        impressions: u.impressions,
        position: Math.round(u.position * 10) / 10,
      })),
    }, { status: 200 });

  } catch (error) {
    console.error('[Import GSC URLs] ❌ Fehler:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

// GET: Zeige Preview ohne Import
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ message: 'userId Parameter erforderlich' }, { status: 400 });
    }

    // User-Daten laden
    const { rows: users } = await sql`
      SELECT id, email, gsc_site_url, domain 
      FROM users 
      WHERE id::text = ${userId}
    `;

    if (users.length === 0) {
      return NextResponse.json({ message: 'User nicht gefunden' }, { status: 404 });
    }

    const user = users[0];

    if (!user.gsc_site_url) {
      return NextResponse.json({ 
        message: 'Keine GSC Site URL konfiguriert',
        user: { email: user.email, domain: user.domain }
      }, { status: 400 });
    }

    // GSC-Daten Preview
    const auth = createAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 3);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const response = await searchconsole.searchanalytics.query({
      siteUrl: user.gsc_site_url,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['page'],
        type: 'web',
        aggregationType: 'byPage',
        rowLimit: 100,
      },
    });

    const rows = response.data.rows || [];
    
    const preview = rows
      .filter(row => (row.clicks || 0) >= 5)
      .map(row => ({
        url: row.keys![0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        position: Math.round((row.position || 0) * 10) / 10,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50);

    return NextResponse.json({
      user: {
        email: user.email,
        domain: user.domain,
        gscSiteUrl: user.gsc_site_url,
      },
      dateRange: {
        start: formatDate(startDate),
        end: formatDate(endDate),
      },
      preview: {
        totalUrls: rows.length,
        urlsWithMinClicks: preview.length,
        topUrls: preview.slice(0, 20),
      },
      note: 'Dies ist nur eine Vorschau. Verwende POST zum Import.',
    });

  } catch (error) {
    console.error('[Import GSC URLs Preview] Fehler:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    }, { status: 500 });
  }
}
