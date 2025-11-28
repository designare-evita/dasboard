// src/app/api/notifications/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth
import { sql } from '@vercel/postgres';
import { unstable_noStore as noStore } from 'next/cache'; // Importiere noStore

type Notification = {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning';
  read: boolean;
  created_at: string;
  related_landingpage_id: number | null;
};

// GET: Benachrichtigungen abrufen
export async function GET() {
  // Caching für Benachrichtigungen deaktivieren, damit sie immer aktuell sind
  noStore(); 
  
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // Hole alle Benachrichtigungen des Benutzers (neueste zuerst)
    const { rows: notifications } = await sql<Notification>`
      SELECT 
        id, 
        message, 
        type, 
        read, 
        created_at,
        related_landingpage_id
      FROM notifications
      WHERE user_id::text = ${session.user.id}
      ORDER BY created_at DESC
      LIMIT 50;
    `;

    // Zähle ungelesene Benachrichtigungen
    const { rows: unreadCount } = await sql`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id::text = ${session.user.id}
      AND read = FALSE;
    `;

    return NextResponse.json({
      notifications,
      unreadCount: parseInt(unreadCount[0].count, 10) // parseInt mit Basis 10
    });

  } catch (error) {
    console.error('Fehler beim Abrufen der Benachrichtigungen:', error);
    return NextResponse.json(
      { message: 'Fehler beim Laden der Benachrichtigungen' },
      { status: 500 }
    );
  }
}

// PUT: Benachrichtigung als gelesen markieren
export async function PUT(request: Request) {
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAllAsRead } = body;

    if (markAllAsRead) {
      // Alle Benachrichtigungen als gelesen markieren
      await sql`
        UPDATE notifications
        SET read = TRUE
        WHERE user_id::text = ${session.user.id}
        AND read = FALSE;
      `;

      return NextResponse.json({ 
        message: 'Alle Benachrichtigungen als gelesen markiert' 
      });
    } else if (notificationId) {
      // Einzelne Benachrichtigung als gelesen markieren
      await sql`
        UPDATE notifications
        SET read = TRUE
        WHERE id = ${notificationId}
        AND user_id::text = ${session.user.id};
      `;

      return NextResponse.json({ 
        message: 'Benachrichtigung als gelesen markiert' 
      });
    } else {
      return NextResponse.json({ 
        message: 'Ungültige Anfrage' 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Fehler beim Markieren der Benachrichtigung:', error);
    return NextResponse.json(
      { message: 'Fehler beim Aktualisieren' },
      { status: 500 }
    );
  }
}

// DELETE: Benachrichtigung löschen
export async function DELETE(request: Request) {
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');

    if (!notificationId) {
      return NextResponse.json({ 
        message: 'Benachrichtigungs-ID fehlt' 
      }, { status: 400 });
    }

    await sql`
      DELETE FROM notifications
      WHERE id = ${notificationId}
      AND user_id::text = ${session.user.id};
    `;

    return NextResponse.json({ 
      message: 'Benachrichtigung gelöscht' 
    });

  } catch (error) {
    console.error('Fehler beim Löschen der Benachrichtigung:', error);
    return NextResponse.json(
      { message: 'Fehler beim Löschen' },
      { status: 500 }
    );
  }
}
