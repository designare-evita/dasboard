// src/app/api/users/[id]/landingpages/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import * as xlsx from 'xlsx';

export const runtime = 'nodejs';

// ——— Typen ———

type RedaktionsplanRow = {
  'Landingpage-URL'?: unknown;
  'URL'?: unknown;
  'Haupt-Keyword'?: unknown;
  'Weitere Keywords'?: unknown;
  'Suchvolumen'?: unknown;
  'Aktuelle Position'?: unknown;
  'Aktuelle Pos.'?: unknown;
};

// ——— Hilfsfunktionen ———

const toStr = (v: unknown): string =>
  typeof v === 'string' ? v.trim() : (v ?? '').toString().trim();

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  const parsed = parseFloat(String(v).replace(',', '.'));
  return isNaN(parsed) ? null : parsed;
};

// ——— POST Handler ———

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // User-ID aus der URL extrahieren (z. B. /api/users/123/landingpages)
    const url = new URL(request.url);
    const idMatch = url.pathname.match(/\/users\/([^/]+)\/landingpages/);
    const userId = idMatch ? idMatch[1] : null;

    if (!userId) {
      return NextResponse.json({ message: 'Ungültige Benutzer-ID' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ message: 'Keine Datei hochgeladen.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json<RedaktionsplanRow>(sheet);

    let importedCount = 0;

    for (const row of rows) {
      const url = toStr(row['Landingpage-URL'] ?? row['URL']);
      const hauptKeyword = toStr(row['Haupt-Keyword']);
      const weitereKeywords = toStr(row['Weitere Keywords']);
      const suchvolumen = toNum(row['Suchvolumen']);
      const aktuellePosition = toNum(row['Aktuelle Position'] ?? row['Aktuelle Pos.']);

      if (!url) continue;

      await sql`
        INSERT INTO landingpages (user_id, url, haupt_keyword, weitere_keywords, suchvolumen, aktuelle_position)
        VALUES (${userId}, ${url}, ${hauptKeyword}, ${weitereKeywords}, ${suchvolumen}, ${aktuellePosition})
        ON CONFLICT (url, user_id) DO NOTHING;
      `;
      importedCount++;
    }

    return NextResponse.json({ message: `${importedCount} Zeilen erfolgreich importiert.` });
  } catch (error) {
    console.error('Upload Fehler:', error);
    return NextResponse.json({ message: 'Fehler beim Verarbeiten der Datei.' }, { status: 500 });
  }
}
