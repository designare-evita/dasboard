// src/app/api/users/[id]/landingpages/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import * as xlsx from 'xlsx';

export const runtime = 'nodejs';

// ——— Typen ———

/**
 * Definiert die erwartete Struktur einer Zeile in der hochgeladenen Excel-Datei.
 */
type RedaktionsplanRow = {
  'Landingpage-URL'?: unknown;
  'URL'?: unknown;
  'Haupt-Keyword'?: unknown;
  'Weitere Keywords'?: unknown;
  'Suchvolumen'?: unknown;
  'Aktuelle Position'?: unknown;
  'Aktuelle Pos.'?: unknown;
};

// ——— Hilfsfunktionen zum sicheren Parsen ———

/**
 * Konvertiert einen unbekannten Wert sicher in einen String.
 */
const toStr = (v: unknown): string =>
  typeof v === 'string' ? v.trim() : (v ?? '').toString().trim();

/**
 * Konvertiert einen unbekannten Wert sicher in eine Zahl (oder null).
 */
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

/**
 * Verarbeitet POST-Anfragen zum Hochladen und Importieren von Landingpages aus einer Excel-Datei.
 * @param request Die eingehende Anfrage (Request-Objekt).
 * @param params Das Objekt, das aus dem zweiten Argument der Funktion destrukturiert wird und die URL-Parameter enthält.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } } // <<< DIE FINALE KORREKTUR IST HIER
) {
  try {
    // 1. Authentifizierung prüfen
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert.' }, { status: 401 });
    }

    // 2. User-ID aus den URL-Parametern extrahieren
    const userId = params.id; // Funktioniert jetzt direkt
    if (!userId) {
      return NextResponse.json({ message: 'User-ID fehlt.' }, { status: 400 });
    }

    // 3. Datei aus dem Formular auslesen
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Datei nicht gefunden.' }, { status: 400 });
    }

    // 4. Datei verarbeiten
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook: xlsx.WorkBook = xlsx.read(buffer, { type: 'buffer' });
    const firstSheetName: string = workbook.SheetNames[0];
    const worksheet: xlsx.WorkSheet = workbook.Sheets[firstSheetName];
    const rows: RedaktionsplanRow[] = xlsx.utils.sheet_to_json<RedaktionsplanRow>(worksheet, {
      defval: '',
    });

    let importedCount = 0;

    // 5. Jede Zeile in die Datenbank einfügen
    for (const row of rows) {
      const url = toStr(row['Landingpage-URL'] ?? row['URL']);
      const hauptKeyword = toStr(row['Haupt-Keyword']);
      const weitereKeywords = toStr(row['Weitere Keywords']);
      const suchvolumen = toNum(row['Suchvolumen']);
      const aktuellePosition = toNum(row['Aktuelle Position'] ?? row['Aktuelle Pos.']);

      if (!url) {
        continue;
      }

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
