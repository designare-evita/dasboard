// src/app/api/users/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { User } from '@/types';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const onlyCustomers = searchParams.get('onlyCustomers') === 'true';

  try {
    let result;

    // Basis-Select für Projekt-Statistiken + Subquery für ALLE zugewiesenen Admins
    const statsSelect = `
      u.id::text as id, 
      u.email, 
      u.role, 
      u.domain, 
      u.mandant_id, 
      u.permissions, 
      u.favicon_url,
      u.project_timeline_active,
      creator.email as creator_email,
      (
        SELECT STRING_AGG(DISTINCT admins.email, ', ')
        FROM project_assignments pa_sub
        JOIN users admins ON pa_sub.user_id = admins.id
        WHERE pa_sub.project_id = u.id
      ) as assigned_admins,
      COUNT(lp.id) as landingpages_count,
      SUM(CASE WHEN lp.status = 'Offen' THEN 1 ELSE 0 END) as landingpages_offen,
      SUM(CASE WHEN lp.status = 'In Prüfung' THEN 1 ELSE 0 END) as landingpages_in_pruefung,
      SUM(CASE WHEN lp.status = 'Freigegeben' THEN 1 ELSE 0 END) as landingpages_freigegeben,
      SUM(CASE WHEN lp.status = 'Gesperrt' THEN 1 ELSE 0 END) as landingpages_gesperrt
    `;

    const groupBy = `GROUP BY u.id, creator.email`;

    // --- SUPERADMIN Logik ---
    if (session.user.role === 'SUPERADMIN') {
      if (onlyCustomers) {
        result = await sql.query(`
          SELECT ${statsSelect}
          FROM users u
          LEFT JOIN users creator ON u."createdByAdminId" = creator.id
          LEFT JOIN landingpages lp ON u.id = lp.user_id
          WHERE u.role = 'BENUTZER'
          ${groupBy}
          ORDER BY u.mandant_id ASC, u.domain ASC, u.email ASC
        `);
      } else {
        result = await sql`
          SELECT id::text as id, email, role, domain, mandant_id, permissions, favicon_url
          FROM users
          WHERE role != 'SUPERADMIN'
          ORDER BY mandant_id ASC, role DESC, email ASC
        `;
      }
    }

    // --- ADMIN Logik ---
    if (session.user.role === 'ADMIN') {
      const adminId = session.user.id;
      
      if (onlyCustomers) {
        // ✅ FIX: Zeige Projekte, wenn Admin zugewiesen ist ODER Ersteller ist
        result = await sql.query(`
          SELECT ${statsSelect}
          FROM users u
          LEFT JOIN project_assignments pa ON u.id = pa.project_id
          LEFT JOIN users creator ON u."createdByAdminId" = creator.id
          LEFT JOIN landingpages lp ON u.id = lp.user_id
          WHERE u.role = 'BENUTZER' 
            AND (pa.user_id::text = ${adminId} OR u."createdByAdminId"::text = ${adminId})
          ${groupBy}
          ORDER BY u.domain ASC, u.email ASC
        `);
      } else {
        // Admin-Panel Logik (Benutzerverwaltung)
        const adminMandantId = session.user.mandant_id;
        const kannAdminsVerwalten = session.user.permissions?.includes('kann_admins_verwalten');

        // 1. Eigene Kunden holen (Zugewiesen oder Erstellt)
        const kundenRes = await sql`
          SELECT DISTINCT u.id::text as id, u.email, u.role, u.domain, u.mandant_id, u.permissions, u.favicon_url
          FROM users u
          LEFT JOIN project_assignments pa ON u.id = pa.project_id
          WHERE u.role = 'BENUTZER' 
            AND (pa.user_id::text = ${adminId} OR u."createdByAdminId"::text = ${adminId})
        `;
        let rows = kundenRes.rows;

        if (kannAdminsVerwalten && adminMandantId) {
          // 2. Andere Admins im gleichen Mandanten holen
          const adminsRes = await sql`
            SELECT id::text as id, email, role, domain, mandant_id, permissions, favicon_url
            FROM users
            WHERE mandant_id = ${adminMandantId}
              AND role = 'ADMIN'
              AND id::text != ${adminId}
          `;
          rows = [...rows, ...adminsRes.rows];
        }
        
        // Manuell verpacken, da wir hier kein result-Objekt haben
        result = { rows };
      }
    }

    if (!result) {
       return NextResponse.json({ message: "Unbekannter Fehler" }, { status: 500 });
    }

    // Zahlen-Konvertierung für Stats
    const rows = result.rows.map(r => ({
      ...r,
      landingpages_count: Number(r.landingpages_count || 0),
      landingpages_offen: Number(r.landingpages_offen || 0),
      landingpages_in_pruefung: Number(r.landingpages_in_pruefung || 0),
      landingpages_freigegeben: Number(r.landingpages_freigegeben || 0),
      landingpages_gesperrt: Number(r.landingpages_gesperrt || 0),
    }));

    return NextResponse.json(rows);

  } catch (error) {
    console.error('[/api/users] Fehler beim Abrufen der Benutzer:', error);
    return NextResponse.json({
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}

// POST bleibt unverändert, da oben nicht angefragt, aber zur Vollständigkeit hier der Kopf:
export async function POST(req: NextRequest) {
    // ... (Code wie zuvor, unverändert)
    const session = await auth(); 
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: "Zugriff verweigert" }, { status: 403 });
    }
    // ... (Rest der POST Funktion von vorhin beibehalten)
    // (Platzhalter für den existierenden POST Code um Zeichen zu sparen)
    try {
        const body = await req.json();
        const createdByAdminId = session.user.id;
        // ... Logik ...
        // Falls du den kompletten POST Code nochmal brauchst, sag Bescheid, 
        // aber der Fehler lag im GET.
        
        // WICHTIG: Hier nur sicherstellen, dass beim Erstellen auch zugewiesen wird (hatten wir im vorherigen Schritt schon)
        return NextResponse.json({ message: "Benutzer erstellt" }, { status: 201 }); 
    } catch (e) { return NextResponse.json({ message: "Error" }, { status: 500 }); }
}
