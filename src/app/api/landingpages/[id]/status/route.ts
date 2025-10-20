// src/app/api/landingpages/[id]/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

type StatusType = 'Offen' | 'In Prüfung' | 'Gesperrt' | 'Freigegeben';

// Hilfsfunktion: Benachrichtigung erstellen
async function createNotification(
  userId: string,
  message: string,
  type: 'info' | 'success' | 'warning',
  landingpageId: number
) {
  try {
    await sql`
      INSERT INTO notifications (user_id, message, type, related_landingpage_id)
      VALUES (${userId}, ${message}, ${type}, ${landingpageId});
    `;
    console.log('✅ Benachrichtigung erstellt für User:', userId);
  } catch (error) {
    console.error('❌ Fehler beim Erstellen der Benachrichtigung:', error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: landingpageId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json();
    const { status: newStatus } = body as { status: StatusType };

    console.log('[Status Update] User:', session.user.email, 'Role:', session.user.role);
    console.log('[Status Update] Landingpage ID:', landingpageId);
    console.log('[Status Update] Neuer Status:', newStatus);

    // Validierung: Status muss einer der erlaubten Werte sein
    const validStatuses: StatusType[] = ['Offen', 'In Prüfung', 'Gesperrt', 'Freigegeben'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({ 
        message: 'Ungültiger Status',
        validStatuses 
      }, { status: 400 });
    }

    // Lade die Landingpage mit User-Info
    const { rows: landingpages } = await sql`
      SELECT 
        lp.*,
        u.email as user_email,
        u.domain as user_domain
      FROM landingpages lp
      INNER JOIN users u ON lp.user_id = u.id
      WHERE lp.id = ${landingpageId};
    `;

    if (landingpages.length === 0) {
      return NextResponse.json({ message: 'Landingpage nicht gefunden' }, { status: 404 });
    }

    const landingpage = landingpages[0];
    const oldStatus = landingpage.status;

    console.log('[Status Update] Alter Status:', oldStatus);
    console.log('[Status Update] Landingpage gehört zu:', landingpage.user_email);

    // Berechtigungsprüfung
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN';
    const isOwner = session.user.id === landingpage.user_id;

    // BENUTZER darf nur zwischen Freigegeben und Gesperrt wechseln
    if (session.user.role === 'BENUTZER') {
      if (!isOwner) {
        return NextResponse.json({ 
          message: 'Sie dürfen nur Ihre eigenen Landingpages bearbeiten' 
        }, { status: 403 });
      }

      // BENUTZER darf nur Freigegeben/Gesperrt ändern
      if (newStatus !== 'Freigegeben' && newStatus !== 'Gesperrt') {
        return NextResponse.json({ 
          message: 'Sie dürfen nur zwischen "Freigegeben" und "Gesperrt" wechseln' 
        }, { status: 403 });
      }
    }

// ADMIN/SUPERADMIN: Prüfe Zugriff auf Projekt
if (isAdmin) {
  if (session.user.role === 'ADMIN') {
    // Prüfe, ob der Admin Zugriff auf dieses Projekt hat
    const { rows: accessCheck } = await sql`
      SELECT 1 
      FROM project_assignments 
      WHERE user_id::text = ${session.user.id} 
      AND project_id::text = ${landingpage.user_id};
    `;

    // Nur ADMINs (nicht SUPERADMINs) müssen Projektzugriff haben
    if (accessCheck.length === 0) {
      return NextResponse.json({ 
        message: 'Sie haben keinen Zugriff auf dieses Projekt' 
      }, { status: 403 });
    }
  }
  // SUPERADMIN hat automatisch Zugriff auf alle Projekte
}

    // Status-Update durchführen
    await sql`
      UPDATE landingpages
      SET status = ${newStatus}
      WHERE id = ${landingpageId};
    `;

    console.log('✅ Status erfolgreich aktualisiert');

    // Benachrichtigungen erstellen
    const pageUrl = new URL(landingpage.url).pathname;
    
    // 1. Benachrichtigung an den Kunden (wenn Admin den Status ändert)
    if (isAdmin && oldStatus !== newStatus) {
      let customerMessage = '';
      
      if (newStatus === 'In Prüfung') {
        customerMessage = `Ihre Landingpage "${pageUrl}" wartet auf Ihre Freigabe.`;
      } else if (newStatus === 'Offen') {
        customerMessage = `Ihre Landingpage "${pageUrl}" wurde auf "Offen" gesetzt.`;
      } else if (newStatus === 'Freigegeben') {
        customerMessage = `Ihre Landingpage "${pageUrl}" wurde vom Admin freigegeben.`;
      } else if (newStatus === 'Gesperrt') {
        customerMessage = `Ihre Landingpage "${pageUrl}" wurde vom Admin gesperrt.`;
      }
      
      if (customerMessage) {
        await createNotification(
          landingpage.user_id,
          customerMessage,
          newStatus === 'Freigegeben' ? 'success' : newStatus === 'Gesperrt' ? 'warning' : 'info',
          parseInt(landingpageId)
        );
      }
    }

    // 2. Benachrichtigung an Admins (wenn Kunde den Status ändert)
    if (isOwner && !isAdmin && oldStatus !== newStatus) {
      // Finde alle Admins, die Zugriff auf dieses Projekt haben
      const { rows: admins } = await sql`
        SELECT DISTINCT u.id, u.email
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.user_id
        WHERE pa.project_id::text = ${landingpage.user_id}
        AND u.role = 'ADMIN';
      `;

      // Benachrichtige auch den Superadmin
      const { rows: superadmins } = await sql`
        SELECT id, email
        FROM users
        WHERE role = 'SUPERADMIN';
      `;

      const allAdmins = [...admins, ...superadmins];

      let adminMessage = '';
      const customerDomain = landingpage.user_domain || landingpage.user_email;
      
      if (newStatus === 'Freigegeben') {
        adminMessage = `Kunde "${customerDomain}" hat die Landingpage "${pageUrl}" freigegeben.`;
      } else if (newStatus === 'Gesperrt') {
        adminMessage = `Kunde "${customerDomain}" hat die Landingpage "${pageUrl}" gesperrt.`;
      }

      if (adminMessage) {
        for (const admin of allAdmins) {
          await createNotification(
            admin.id,
            adminMessage,
            newStatus === 'Freigegeben' ? 'success' : 'warning',
            parseInt(landingpageId)
          );
        }
      }
    }

    return NextResponse.json({ 
      message: 'Status erfolgreich aktualisiert',
      oldStatus,
      newStatus,
      landingpage: {
        id: landingpage.id,
        url: landingpage.url,
        status: newStatus
      }
    });

  } catch (error) {
    console.error('❌ Fehler beim Status-Update:', error);
    return NextResponse.json(
      { 
        message: 'Fehler beim Aktualisieren des Status',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
