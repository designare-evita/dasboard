// src/services/userService.ts
import { sql } from '@vercel/postgres';

interface UserSession {
  id: string;
  role: string;
  mandant_id?: string | null;
  permissions?: string[];
}

export async function getUsersForManagement(user: UserSession) {
  try {
    // --- SUPERADMIN ---
    if (user.role === 'SUPERADMIN') {
      const { rows } = await sql`
        SELECT 
          u.id::text as id, 
          u.email, 
          u.role, 
          u.domain, 
          u.mandant_id, 
          u.permissions, 
          u.favicon_url,
          (
            SELECT STRING_AGG(DISTINCT admins.email, ', ')
            FROM project_assignments pa_sub
            JOIN users admins ON pa_sub.user_id = admins.id
            WHERE pa_sub.project_id = u.id
          ) as assigned_admins,
          (
            SELECT STRING_AGG(DISTINCT p.domain, ', ')
            FROM project_assignments pa_sub2
            JOIN users p ON pa_sub2.project_id = p.id
            WHERE pa_sub2.user_id = u.id
          ) as assigned_projects
        FROM users u
        WHERE u.role != 'SUPERADMIN'
        ORDER BY u.mandant_id ASC, u.role DESC, u.email ASC
      `;
      return rows;
    }

    // --- ADMIN ---
    if (user.role === 'ADMIN') {
      const adminId = user.id;
      const adminMandantId = user.mandant_id;
      const kannAdminsVerwalten = user.permissions?.includes('kann_admins_verwalten');

      const kundenRes = await sql`
        SELECT DISTINCT 
          u.id::text as id, u.email, u.role, u.domain, u.mandant_id, u.permissions, u.favicon_url,
          (
            SELECT STRING_AGG(DISTINCT admins.email, ', ')
            FROM project_assignments pa_sub
            JOIN users admins ON pa_sub.user_id = admins.id
            WHERE pa_sub.project_id = u.id
          ) as assigned_admins,
          (
            SELECT STRING_AGG(DISTINCT p.domain, ', ')
            FROM project_assignments pa_sub2
            JOIN users p ON pa_sub2.project_id = p.id
            WHERE pa_sub2.user_id = u.id
          ) as assigned_projects
        FROM users u
        WHERE u.role = 'BENUTZER' 
          AND u.mandant_id = ${adminMandantId}
          AND (
            u."createdByAdminId"::text = ${adminId}
            OR EXISTS (
              SELECT 1 FROM project_assignments pa 
              WHERE pa.project_id = u.id AND pa.user_id::text = ${adminId}
            )
          )
      `;
      
      let rows = kundenRes.rows;

      if (kannAdminsVerwalten && adminMandantId) {
        const adminsRes = await sql`
          SELECT 
            u.id::text as id, u.email, u.role, u.domain, u.mandant_id, u.permissions, u.favicon_url,
            (
              SELECT STRING_AGG(DISTINCT admins.email, ', ')
              FROM project_assignments pa_sub
              JOIN users admins ON pa_sub.user_id = admins.id
              WHERE pa_sub.project_id = u.id
            ) as assigned_admins,
            (
              SELECT STRING_AGG(DISTINCT p.domain, ', ')
              FROM project_assignments pa_sub2
              JOIN users p ON pa_sub2.project_id = p.id
              WHERE pa_sub2.user_id = u.id
            ) as assigned_projects
          FROM users u
          WHERE u.mandant_id = ${adminMandantId}
            AND u.role = 'ADMIN'
            AND u.id::text != ${adminId}
        `;
        rows = [...rows, ...adminsRes.rows];
      }
      
      // Sortierung in JS, da wir zwei Queries gemischt haben könnten
      rows.sort((a, b) => (a.role > b.role) ? -1 : (a.role === b.role) ? a.email.localeCompare(b.email) : 1);
      
      return rows;
    }

    return [];
  } catch (error) {
    console.error('[UserService] Fehler beim Laden der Benutzer:', error);
    return [];
  }
}
