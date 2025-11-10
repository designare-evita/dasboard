// src/app/api/update-landingpages-status/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    console.log('🔧 Aktualisiere Landingpages Status-Schema...');

    // 1. Ändere den Datentyp der Status-Spalte
    await sql`
      ALTER TABLE landingpages 
      ALTER COLUMN status TYPE VARCHAR(50);
    `;
    
    console.log('✅ Status-Spalte Typ aktualisiert');

    // 2. Migriere alte Werte zu neuen deutschen Werten
    await sql`
      UPDATE landingpages 
      SET status = CASE 
        WHEN status = 'pending' THEN 'Offen'
        WHEN status = 'in_review' THEN 'In Prüfung'
        WHEN status = 'approved' THEN 'Freigegeben'
        WHEN status = 'rejected' THEN 'Gesperrt'
        ELSE 'Offen'
      END;
    `;
    
    console.log('✅ Status-Werte migriert');

    // 3. Setze Default-Wert
    await sql`
      ALTER TABLE landingpages 
      ALTER COLUMN status SET DEFAULT 'Offen';
    `;
    
    console.log('✅ Default-Wert gesetzt');

    // 4. Erstelle Notifications-Tabelle (falls nicht vorhanden)
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'info',
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        related_landingpage_id INTEGER REFERENCES landingpages(id) ON DELETE CASCADE
      );
    `;
    
    console.log('✅ Notifications-Tabelle erstellt');

    // 5. Index für bessere Performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
      ON notifications(user_id);
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_notifications_read 
      ON notifications(user_id, read);
    `;
    
    console.log('✅ Indizes erstellt');

    // 6. Prüfe finale Struktur
    const { rows: columns } = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'landingpages'
      ORDER BY ordinal_position;
    `;

    const { rows: statusDistribution } = await sql`
      SELECT status, COUNT(*) as count
      FROM landingpages
      GROUP BY status;
    `;

    return NextResponse.json({
      success: true,
      message: '✅ Landingpages-Schema erfolgreich aktualisiert!',
      structure: columns,
      statusDistribution,
      validStatuses: ['Offen', 'In Prüfung', 'Gesperrt', 'Freigegeben']
    });

  } catch (error) {
    console.error('❌ Fehler beim Schema-Update:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Fehler beim Aktualisieren',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
