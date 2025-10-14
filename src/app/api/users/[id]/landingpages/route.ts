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
 * Die Felder sind als 'unknown' typisiert, da wir nicht garantieren können,
 * was der Benutzer hochlädt. Wir validieren und konvertieren die Typen später.
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
 * Entfernt führende/nachfolgende Leerzeichen.
 * @param v Der zu konvertierende Wert.
 * @returns Ein getrimmter String.
 */
const toStr = (v: unknown): string =>
  typeof v === 'string' ? v.trim() : (v ?? '').toString().trim();

/**
 * Konvertiert einen unbekannten Wert sicher in eine Zahl (oder null).
 * Akzeptiert deutsche Zahlenformate (z.B. "1.234,56").
 * @param v Der zu konvertierende Wert.
 * @returns Eine Zahl oder null, wenn die Konvertierung fehlschlägt.
 */
const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    // Ersetzt Tausendertrennzeichen (.) und wandelt Komma in Punkt um
    const cleaned = v.replace(/\./g, '').replace(',', '.').trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// ——— Handler ———

/**
 * Verarbeitet POST-Anfragen zum Hochladen und Importieren von Landingpages aus einer Excel-Datei.
 * @param req Die eingehende Anfrage (Request-Objekt).
 * @param context Das Kontextobjekt, das von Next.js bereitgestellt wird und die URL-Parameter enthält.
 */
export async function POST(
  req: Request,
  context: { params: { id: string } } // <<< KORREKTUR HIER
) {
  try {
    // 1. Authentifizierung prüfen
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert.' }, { status: 401 });
    }

    // 2. User-ID aus dem Kontextobjekt extrahieren
    const userId = context.params.id; // <<< KORREKTUR HIER
    if (!userId) {
      return NextResponse.json({ message: 'User-ID fehlt.' }, { status: 400 });
    }

    // 3. Datei aus dem Formular auslesen
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Datei nicht gefunden.' }, { status: 400 });
    }

    // 4. Datei in einen Buffer umwandeln und mit xlsx einlesen
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook: xlsx.WorkBook = xlsx.read(buffer, { type: 'buffer' });
    const firstSheetName: string = workbook.SheetNames[0];
    const worksheet: xlsx.WorkSheet = workbook.Sheets[firstSheetName];

    // Typisierte Zeilen aus dem Arbeitsblatt extrahieren
    const rows: RedaktionsplanRow[] = xlsx.utils.sheet_to_json<RedaktionsplanRow>(worksheet, {
      defval: '', // Leere Zellen als leere Strings behandeln
    });

    let importedCount = 0;

    // 5. Jede Zeile verarbeiten und in die Datenbank einfügen
    for (const row of rows) {
      // Daten sicher extrahieren und konvertieren
      const url = toStr(row['Landingpage-URL'] ?? row['URL']);
      const hauptKeyword = toStr(row['Haupt-Keyword']);
      const weitereKeywords = toStr(row['Weitere Keywords']);
      const suchvolumen = toNum(row['Suchvolumen']);
      const aktuellePosition = toNum(row['Aktuelle Position'] ?? row['Aktuelle Pos.']);

      // Überspringe leere Zeilen, bei denen die URL fehlt
      if (!url) {
        continue;
      }

      // SQL-Befehl zum Einfügen der Daten
      // ON CONFLICT sorgt dafür, dass keine Duplikate (gleiche URL für gleichen User) entstehen.
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
