// src/app/api/admin/maintenance/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// GET - Wartungsmodus-Status für alle User abrufen (für Admin-Panel)
// oder für den aktuellen User (für Header-Check)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const checkSelf = searchParams.get('checkSelf') === 'true';
    
    // Wenn nur der eigene Status geprüft werden soll
    if (checkSelf) {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ isInMaintenance: false });
      }
      
      const { rows } = await sql`
        SELECT maintenance_mode FROM users WHERE id = ${session.user.id}::uuid
      `;
      
      return NextResponse.json({ 
        isInMaintenance: rows[0]?.maintenance_mode === true 
      });
    }
    
    // Admin-Abfrage: Alle User mit Wartungsmodus
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Liste aller User im Wartungsmodus zurückgeben
    const { rows } = await sql`
      SELECT id::text as id, email, role, domain, maintenance_mode
      FROM users
      WHERE maintenance_mode = true
      ORDER BY email ASC
    `;
    
    return NextResponse.json({ 
      usersInMaintenance: rows,
      count: rows.length
    });
    
  } catch (error) {
    console.error('Maintenance GET error:', error);
    return NextResponse.json({ isInMaintenance: false, usersInMaintenance: [], count: 0 });
  }
}

// POST - Wartungsmodus für einzelne User setzen
export async function POST(req: Request) {
  try {
    const session = await auth();
    
    // Nur SUPERADMIN und ADMIN mit entsprechenden Rechten
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, isActive } = body;

    if (!userId) {
      return NextResponse.json({ message: 'userId ist erforderlich' }, { status: 400 });
    }

    // Prüfen ob der Ziel-User existiert und die Berechtigung vorhanden ist
    const { rows: targetUser } = await sql`
      SELECT id, role, mandant_id FROM users WHERE id = ${userId}::uuid
    `;

    if (targetUser.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    // SUPERADMIN darf nicht in Wartungsmodus gesetzt werden
    if (targetUser[0].role === 'SUPERADMIN') {
      return NextResponse.json({ 
        message: 'Superadmins können nicht in den Wartungsmodus gesetzt werden' 
      }, { status: 403 });
    }

    // ADMIN darf nur User des eigenen Mandanten in Wartungsmodus setzen
    if (session.user.role === 'ADMIN') {
      if (targetUser[0].mandant_id !== session.user.mandant_id) {
        return NextResponse.json({ 
          message: 'Sie können nur Benutzer Ihres Mandanten verwalten' 
        }, { status: 403 });
      }
      // Admin darf keine anderen Admins in Wartungsmodus setzen (außer mit Sonderrecht)
      if (targetUser[0].role === 'ADMIN' && !session.user.permissions?.includes('kann_admins_verwalten')) {
        return NextResponse.json({ 
          message: 'Keine Berechtigung, andere Admins zu verwalten' 
        }, { status: 403 });
      }
    }

    // Wartungsmodus setzen
    await sql`
      UPDATE users 
      SET maintenance_mode = ${isActive === true}
      WHERE id = ${userId}::uuid
    `;

    return NextResponse.json({ 
      success: true, 
      userId,
      isActive: isActive === true 
    });

  } catch (error: any) {
    console.error('Maintenance POST error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// PUT - Bulk-Update für mehrere User (optional)
export async function PUT(req: Request) {
  try {
    const session = await auth();
    
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nur Superadmins' }, { status: 403 });
    }

    const body = await req.json();
    const { userIds, isActive } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ message: 'userIds Array erforderlich' }, { status: 400 });
    }

    // Alle außer SUPERADMINs updaten
    const client = await sql.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const userId of userIds) {
        await client.query(`
          UPDATE users 
          SET maintenance_mode = $1
          WHERE id = $2::uuid AND role != 'SUPERADMIN'
        `, [isActive === true, userId]);
      }
      
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ 
      success: true, 
      updatedCount: userIds.length,
      isActive: isActive === true 
    });

  } catch (error: any) {
    console.error('Maintenance PUT error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
