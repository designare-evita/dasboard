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
  const str = String(v).replace(',', '.').trim();
  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
};

const normalizeKey = (key: string) =>
  key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]/g, '');

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
    
    // Lese als Array von Arrays
    const rawData = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    
    console.log(`📊 Excel-Import gestartet - ${rawData.length} Zeilen gefunden`);

    if (rawData.length === 0) {
      return NextResponse.json({ message: 'Die Excel-Datei ist leer.' }, { status: 400 });
    }

    // Finde die Header-Zeile (suche nach "Landingpage-URL" oder ähnlichen Begriffen)
    let headerRowIndex = -1;
    let headerRow: unknown[] = [];

    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      const rowStr = row.map(cell => String(cell).toLowerCase()).join(' ');
      
      if (rowStr.includes('landingpage') && rowStr.includes('url')) {
        headerRowIndex = i;
        headerRow = row;
        console.log(`✅ Header gefunden in Zeile ${i + 1}`);
        console.log('Header:', headerRow);
        break;
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json({ 
        message: 'Keine Header-Zeile mit "Landingpage-URL" gefunden. Bitte stelle sicher, dass die Excel-Datei korrekt formatiert ist.' 
      }, { status: 400 });
    }

    // Erstelle Mapping: normalisierter Header -> Spaltenindex
    const columnMap: Record<string, number> = {};
    headerRow.forEach((header, idx) => {
      const normalized = normalizeKey(String(header));
      columnMap[normalized] = idx;
    });

    console.log('Spalten-Mapping:', columnMap);

    // Finde die relevanten Spalten
    const urlColumn = 
      columnMap['landingpageurl'] ?? 
      columnMap['url'] ?? 
      columnMap['link'] ?? 
      -1;

    const hauptKeywordColumn = 
      columnMap['hauptkeyword'] ?? 
      columnMap['keyword'] ?? 
      columnMap['mainkeyword'] ?? 
      -1;

    const weitereKeywordsColumn = 
      columnMap['weiterekeywords'] ?? 
      columnMap['keywords'] ?? 
      columnMap['additionalkeywords'] ?? 
      -1;

    const suchvolumenColumn = 
      columnMap['suchvolumen'] ?? 
      columnMap['searchvolume'] ?? 
      columnMap['volume'] ?? 
      -1;

    const positionColumn = 
      columnMap['aktuellepos'] ?? 
      columnMap['aktuelleposition'] ?? 
      columnMap['position'] ?? 
      columnMap['pos'] ?? 
      -1;

    console.log('Gefundene Spalten:', {
      url: urlColumn,
      hauptKeyword: hauptKeywordColumn,
      weitereKeywords: weitereKeywordsColumn,
      suchvolumen: suchvolumenColumn,
      position: positionColumn
    });

    if (urlColumn === -1) {
      return NextResponse.json({ 
        message: 'Spalte "Landingpage-URL" wurde nicht gefunden. Verfügbare Spalten: ' + headerRow.join(', ')
      }, { status: 400 });
    }

    // Verarbeite Datenzeilen (alles nach dem Header)
    const dataRows = rawData.slice(headerRowIndex + 1);
    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = headerRowIndex + i + 2; // +2 wegen 0-Index und Header
      
      // Überspringe leere Zeilen
      if (!row || row.length === 0 || row.every(cell => !cell || String(cell).trim() === '')) {
        skippedCount++;
        continue;
      }

      const url = toStr(row[urlColumn]) || null;
      const hauptKeyword = hauptKeywordColumn !== -1 ? toStr(row[hauptKeywordColumn]) : null;
      const weitereKeywords = weitereKeywordsColumn !== -1 ? toStr(row[weitereKeywordsColumn]) : '';
      const suchvolumen = suchvolumenColumn !== -1 ? toNum(row[suchvolumenColumn]) : null;
      const aktuellePosition = positionColumn !== -1 ? toNum(row[positionColumn]) : null;

      console.log(`Zeile ${rowNumber}:`, { url, hauptKeyword, suchvolumen, aktuellePosition });

      // Validierung: URL muss vorhanden und gültig sein
      if (!url || url.length < 5 || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        console.warn(`⚠️ Zeile ${rowNumber} übersprungen: Ungültige URL "${url}"`);
        skippedCount++;
        errors.push(`Zeile ${rowNumber}: Ungültige URL`);
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
            aktuelle_position = EXCLUDED.aktuelle_position,
            status = 'pending';
        `;
        importedCount++;
        console.log(`✅ Zeile ${rowNumber} erfolgreich: ${url}`);
      } catch (dbError) {
        console.error(`❌ DB-Fehler bei Zeile ${rowNumber}:`, dbError);
        errors.push(`Zeile ${rowNumber}: Datenbankfehler`);
        skippedCount++;
      }
    }

    const message = importedCount > 0 
      ? `✅ ${importedCount} Landingpage(s) erfolgreich importiert${skippedCount > 0 ? ` (${skippedCount} übersprungen)` : ''}.`
      : `⚠️ Keine Daten importiert. ${skippedCount} Zeile(n) übersprungen. Prüfe, ob die URLs mit "http://" oder "https://" beginnen.`;
    
    return NextResponse.json({
      message,
      imported: importedCount,
      skipped: skippedCount,
      total: dataRows.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
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
