// src/app/api/admin/maintenance/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'maintenance_mode'`;
    const isActive = rows[0]?.value === 'true';
    return NextResponse.json({ isActive });
  } catch (error) {
    return NextResponse.json({ isActive: false }); // Standard: Aus
  }
}

export async function POST(req: Request) {
  try {
    // 1. Check Permissions
    const session = await auth();
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // 2. Parse Body
    const { isActive } = await req.json();
    const valueStr = isActive ? 'true' : 'false';

    // 3. Update DB (Insert or Update)
    await sql`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('maintenance_mode', ${valueStr}, CURRENT_TIMESTAMP)
      ON CONFLICT (key) 
      DO UPDATE SET value = ${valueStr}, updated_at = CURRENT_TIMESTAMP;
    `;

    return NextResponse.json({ success: true, isActive });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
