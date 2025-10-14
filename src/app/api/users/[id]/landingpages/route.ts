// src/app/api/users/[id]/landingpages/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import * as xlsx from 'xlsx';

export const runtime = 'nodejs';
// ——— Typen ———
type Params = { params: { id: string } };

type RedaktionsplanRow = {
  'Landingpage-URL'?: unknown;
  'URL'?: unknown;
  'Haupt-Keyword'?: unknown;
  'Weitere Keywords'?: unknown;
  'Suchvolumen'?: unknown;
  'Aktuelle Position'?: unknown; 
  'Aktuelle Pos.'?: unknown;    
};


// Hilfsfunktionen zum sicheren Parsen
const toStr = (v: unknown): string =>
  typeof v === 'string' ? v.trim() : (v ?? '').toString().trim();

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/\./g, '').replace(',', '.').trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// ——— Handler ———
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert.' }, { status: 401 });
    }

    // id sicher aus der URL extrahieren (ohne 2. Funktionsargument)
    const { pathname } = new URL(req.url);
    const match = pathname.match(/\/api\/users\/([^/]+)\/landingpages/i);
    const userId = match?.[1] ?? '';
    if (!userId) {
      return NextResponse.json({ message: 'User-ID fehlt.' }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Datei nicht gefunden.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // XLSX strikt typisieren
    const workbook: xlsx.WorkBook = xlsx.read(buffer, { type: 'buffer' });
    const firstSheetName: string = workbook.SheetNames[0];
    const worksheet: xlsx.WorkSheet = workbook.Sheets[firstSheetName];

    // Rows typisiert auslesen
    const rows: RedaktionsplanRow[] = xlsx.utils.sheet_to_json<RedaktionsplanRow>(worksheet, {
      defval: '',
    });

    let importedCount = 0;

    for (const row of rows) {
      const url = toStr(row['Landingpage-URL'] ?? row['URL']);
const hauptKeyword = toStr(row['Haupt-Keyword']);
const weitereKeywords = toStr(row['Weitere Keywords']);
const suchvolumen = toNum(row['Suchvolumen']);
const aktuellePosition = toNum(
  (row['Aktuelle Position'] ?? row['Aktuelle Pos.']) as unknown
);


      await sql`
        INSERT INTO landingpages (user_id, url, haupt_keyword, weitere_keywords, suchvolumen, aktuelle_position)
        VALUES (${userId}, ${url}, ${hauptKeyword}, ${weitereKeywords}, ${suchvolumen}, ${aktuellePosition})
        ON CONFLICT (url, user_id) DO NOTHING;
      `;
      importedCount++;
    }

    return NextResponse.json({ message: `${importedCount} Zeilen erfolgreich importiert.` });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Upload Fehler:', error);
    return NextResponse.json({ message: 'Fehler beim Verarbeiten der Datei.' }, { status: 500 });
  }
}
