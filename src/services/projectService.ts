// src/services/projectService.ts
import { sql } from '@vercel/postgres';

export async function getProjectsForDashboard(user: { id: string; role: string; mandant_id?: string | null }) {
  // Wir nutzen die gleiche Logik wie in der API Route für "onlyCustomers=true"
  
  // --- SUPERADMIN ---
  if (user.role === 'SUPERADMIN') {
    const { rows } = await sql`
      SELECT 
        u.id::text as id, u.email, u.role, u.domain, u.mandant_id, u.permissions, u.favicon_url,
        u.project_timeline_active, u.project_start_date, u.project_duration_months, u."createdAt",
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
        SUM(CASE WHEN lp.status = 'Gesperrt' THEN 1 ELSE 0 END) as landingpages_gesperrt,
        SUM(lp.gsc_impressionen_change) as total_impression_change
      FROM users u
      LEFT JOIN users creator ON u."createdByAdminId" = creator.id
      LEFT JOIN landingpages lp ON u.id = lp.user_id
      WHERE u.role = 'BENUTZER'
      GROUP BY u.id, creator.email
      ORDER BY u.mandant_id ASC, u.domain ASC, u.email ASC
    `;
    return parseNumbers(rows);
  }

  // --- ADMIN ---
  if (user.role === 'ADMIN') {
    const adminMandantId = user.mandant_id;
    const { rows } = await sql`
      SELECT 
        u.id::text as id, u.email, u.role, u.domain, u.mandant_id, u.permissions, u.favicon_url,
        u.project_timeline_active, u.project_start_date, u.project_duration_months, u."createdAt",
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
        SUM(CASE WHEN lp.status = 'Gesperrt' THEN 1 ELSE 0 END) as landingpages_gesperrt,
        SUM(lp.gsc_impressionen_change) as total_impression_change
      FROM users u
      LEFT JOIN users creator ON u."createdByAdminId" = creator.id
      LEFT JOIN landingpages lp ON u.id = lp.user_id
      WHERE u.role = 'BENUTZER'
        AND u.mandant_id = ${adminMandantId}
        AND (
          u."createdByAdminId"::text = ${user.id}
          OR EXISTS (
            SELECT 1 FROM project_assignments pa 
            WHERE pa.project_id = u.id AND pa.user_id::text = ${user.id}
          )
        )
      GROUP BY u.id, creator.email
      ORDER BY u.domain ASC, u.email ASC
    `;
    return parseNumbers(rows);
  }

  return [];
}

// Hilfsfunktion um Strings aus der DB in Numbers zu wandeln (für SUM/COUNT)
function parseNumbers(rows: any[]) {
  return rows.map(r => ({
    ...r,
    landingpages_count: Number(r.landingpages_count || 0),
    landingpages_offen: Number(r.landingpages_offen || 0),
    landingpages_in_pruefung: Number(r.landingpages_in_pruefung || 0),
    landingpages_freigegeben: Number(r.landingpages_freigegeben || 0),
    landingpages_gesperrt: Number(r.landingpages_gesperrt || 0),
    total_impression_change: Number(r.total_impression_change || 0),
  }));
}
