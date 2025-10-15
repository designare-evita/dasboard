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
  key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]/g, '');

// Prüft, ob die erste Zeile ein Header ist oder bereits Daten enthält
function hasHeaderRow(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false;
  
  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  
  // Wenn die Keys typische Header-Namen enthalten, ist es ein Header
  const headerPatterns = ['url', 'keyword', 'seite', 'haupt', 'position', 'volumen', 'page', 'link'];
  return keys.some(key => 
    headerPatterns.some(pattern => normalizeKey(key).includes(pattern))
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

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
    
    // WICHTIG: Wir lesen die Datei als Array von Arrays, nicht als JSON-Objekt
    const rawData = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    
    console.log(`📊 Rohdaten - ${rawData.length} Zeilen gefunden`);
    console.log('Erste 3 Zeilen:', rawData.slice(0, 3));

    if (rawData.length === 0) {
      return NextResponse.json({ message: 'Die Excel-Datei ist leer.' }, { status: 400 });
    }

    let dataRows: unknown[][];
    let headerRow: unknown[] | null = null;

    // Prüfen, ob die erste Zeile ein Header ist
    const firstRow = rawData[0];
    const hasHeader = firstRow.some((cell: unknown) => {
      const str = String(cell).toLowerCase();
      return str.includes('url') || str.includes('keyword') || str.includes('seite') || 
             str.includes('haupt') || str.includes('position') || str.includes('volumen');
    });

    if (hasHeader) {
      console.log('✅ Header-Zeile erkannt');
      headerRow = firstRow;
      dataRows = rawData.slice(1);
    } else {
      console.log('⚠️ Keine Header-Zeile - verwende Standardzuordnung');
      dataRows = rawData;
    }

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      // Überspringe leere Zeilen
      if (!row || row.length === 0 || row.every(cell => !cell)) {
        skippedCount++;
        continue;
      }

      let url: string | null = null;
      let hauptKeyword: string | null = null;
      let weitereKeywords = '';
      let suchvolumen: number | null = null;
      let aktuellePosition: number | null = null;

      if (headerRow) {
        // MIT HEADER: Zuordnung über Spaltennamen
        const rowObj: Record<string, unknown> = {};
        headerRow.forEach((header, idx) => {
          const normalizedHeader = normalizeKey(String(header));
          rowObj[normalizedHeader] = row[idx];
        });

        url = toStr(
          rowObj['landingpageurl'] ?? rowObj['url'] ?? rowObj['seite'] ?? 
          rowObj['page'] ?? rowObj['link'] ?? ''
        ) || null;

        hauptKeyword = toStr(
          rowObj['hauptkeyword'] ?? rowObj['hauptwort'] ?? rowObj['keyword'] ??
          rowObj['mainkeyword'] ?? ''
        ) || null;

        weitereKeywords = toStr(
          rowObj['weiterekeywords'] ?? rowObj['keywords'] ?? 
          rowObj['zusatzkeywords'] ?? rowObj['additionalkeywords'] ?? ''
        );

        suchvolumen = toNum(
          rowObj['suchvolumen'] ?? rowObj['searchvolume'] ?? 
          rowObj['volume'] ?? rowObj['vol']
        );

        aktuellePosition = toNum(
          rowObj['aktuelleposition'] ?? rowObj['aktuellepos'] ?? 
          rowObj['position'] ?? rowObj['pos'] ?? rowObj['currentposition']
        );
      } else {
        // OHNE HEADER: Zuordnung nach Position
        // Annahme: [URL, Haupt-Keyword, Weitere Keywords, Suchvolumen, Position]
        url = toStr(row[0]) || null;
        hauptKeyword = toStr(row[1]) || null;
        weitereKeywords = toStr(row[2]);
        suchvolumen = toNum(row[3]);
        aktuellePosition = toNum(row[4]);
      }

      console.log(`Zeile ${i + 1}:`, { url, hauptKeyword, weitereKeywords, suchvolumen, aktuellePosition });

      // Validierung: Mindestens URL muss vorhanden sein
      if (!url || url.length < 5) {
        console.warn(`⚠️ Zeile ${i + 1} übersprungen: Keine gültige URL`);
        skippedCount++;
        errors.push(`Zeile ${i + 1}: Ungültige oder fehlende URL`);
        continue;
      }

      try {
        await sql`
          INSERT INTO landingpages (user_id, url, haupt_keyword, weitere_keywords, suchvolumen, aktuelle_position)
          VALUES (${userId}, ${url}, ${hauptKeyword}, ${weitereKeywords}, ${suchvolumen}, ${aktuellePosition})
          ON CONFLICT (url, user_id) DO UPDATE SET
            haupt_keyword = EXCLUDED.haupt_keyword,
            weitere_keywords = EXCLUDED.weitere_keywords,
            suchvolumen = EXCLUDED.suchvolumen,
            aktuelle_position = EXCLUDED.aktuelle_position;
        `;
        importedCount++;
        console.log(`✅ Zeile ${i + 1} erfolgreich importiert: ${url}`);
      } catch (dbError) {
        console.error(`❌ DB-Fehler bei Zeile ${i + 1}:`, dbError);
        errors.push(`Zeile ${i + 1}: Datenbankfehler`);
        skippedCount++;
      }
    }

    const message = importedCount > 0 
      ? `✅ ${importedCount} Landingpage(s) erfolgreich importiert${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.`
      : `⚠️ Keine Daten importiert. ${skippedCount} Zeile(n) übersprungen.`;
    
    return NextResponse.json({
      message,
      imported: importedCount,
      skipped: skippedCount,
      total: dataRows.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined // Max 5 Fehler anzeigen
    });
  } catch (error) {
    console.error('❌ Upload Fehler:', error);
    return NextResponse.json(
      { 
        message: 'Fehler beim Verarbeiten der Datei.',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
