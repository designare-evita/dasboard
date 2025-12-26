// src/app/api/setup-demo/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    // 1. Passwort hashen (wir nehmen "demo123" für alle)
    const hashedPassword = await bcrypt.hash('demo123', 10);

    // 2. Demo Mandant/User (Das Projekt) anlegen
    // ID fest vergeben, damit wir sie wiedererkennen
    const demoUserId = '00000000-0000-0000-0000-000000000001';
    
    await sql`
      INSERT INTO users (id, email, password, role, domain, created_at)
      VALUES (
        ${demoUserId}, 
        'demo-project@designare.at', 
        ${hashedPassword}, 
        'BENUTZER', 
        'demo-shop.de', 
        NOW()
      )
      ON CONFLICT (email) DO UPDATE 
      SET password = ${hashedPassword}; -- Update password falls schon existiert
    `;

    // 3. Demo Admin anlegen
    const demoAdminId = '00000000-0000-0000-0000-000000000002';

    await sql`
      INSERT INTO users (id, email, password, role, created_at)
      VALUES (
        ${demoAdminId}, 
        'demo-admin@designare.at', 
        ${hashedPassword}, 
        'ADMIN', 
        NOW()
      )
      ON CONFLICT (email) DO UPDATE 
      SET password = ${hashedPassword};
    `;

    // 4. Admin dem Projekt zuweisen (WICHTIG für /api/projects Logik)
    await sql`
      INSERT INTO project_assignments (user_id, project_id)
      VALUES (${demoAdminId}, ${demoUserId})
      ON CONFLICT DO NOTHING;
    `;

    return NextResponse.json({ 
      message: 'Demo Daten erfolgreich angelegt!',
      credentials: {
        admin: { email: 'demo-admin@designare.at', password: 'demo123' },
        user: { email: 'demo-project@designare.at', password: 'demo123' }
      }
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
