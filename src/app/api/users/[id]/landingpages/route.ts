// src/app/api/users/[id]/landingpages/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import * as xlsx from 'xlsx';

export const runtime = 'nodejs';

// ——— Hilfsfunktionen ———

const toStr = (v: unknown): string =>
  typeof v === 'string' ? v.trim() : (v ?? '').toString().trim();

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  const parsed = parseFloat(String(v).replace(',', '.'));
  return isNaN(parsed) ? null : parsed;
};

// Macht Spaltennamen robuster
const normalizeKey = (key: string) =>
  key.toLowerCase().replace(/[\s\-.]/g, '');

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // User-ID aus der URL extrahieren
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
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);

    let importedCount = 0;

    for (const rawRow of rows) {
      // Normalisierte Schlüssel erzeugen
      const normalizedRow: Record<string, unknown> = {};
      for (const key in rawRow) {
        normalizedRow[normalizeKey(key)] = rawRow[key];
      }

      // Dynamische Zuordnung
      const url =
        toStr(
          normalizedRow['landingpageurl'] ??
            normalizedRow['url'] ??
            normalizedRow['seite'] ??
            ''
        ) || null;

      const hauptKeyword =
        toStr(
          normalizedRow['hauptkeyword'] ??
            normalizedRow['hauptwort'] ??
            normalizedRow['keyword'] ??
            ''
        ) || null;

      const weitereKeywords = toStr(
        normalizedRow['weiterekeywords'] ??
          normalizedRow['keywords'] ??
          normalizedRow['zusatzkeywords'] ??
          ''
      );

      const suchvolumen = toNum(
        normalizedRow['suchvolumen'] ?? normalizedRow['searchvolume']
      );

      const aktuellePosition = toNum(
        normalizedRow['aktuelleposition'] ??
          normalizedRow['position'] ??
          normalizedRow['aktuellepos']
      );

      if (!url) continue;

      await sql`
        INSERT INTO landingpages (user_id, url, haupt_keyword, weitere_keywords, suchvolumen, aktuelle_position)
        VALUES (${userId}, ${url}, ${hauptKeyword}, ${weitereKeywords}, ${suchvolumen}, ${aktuellePosition})
        ON CONFLICT (url, user_id) DO NOTHING;
      `;
      importedCount++;
    }

    return NextResponse.json({
      message: `${importedCount} Zeilen erfolgreich importiert.`,
    });
  } catch (error) {
    console.error('Upload Fehler:', error);
    return NextResponse.json(
      { message: 'Fehler beim Verarbeiten der Datei.' },
      { status: 500 }
    );
  }
}

