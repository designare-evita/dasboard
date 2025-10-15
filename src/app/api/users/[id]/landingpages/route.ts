// src/app/api/users/[id]/landingpages/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import * as xlsx from 'xlsx';

export const runtime = 'nodejs';

// ——— Hilfsfunktionen ———

const toStr = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  return String(v).trim();
};

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
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
    
    // Lese als Array von Arrays - WICHTIG: raw values ohne Typkonvertierung
    const rawData = xlsx.utils.sheet_to_json<unknown[]>(sheet, { 
      header: 1, 
      defval: '',
      raw: false // Konvertiert alles zu Strings
    });
    
    console.log(`📊 Excel-Import: ${rawData.length} Zeilen gelesen`);
    console.log('Erste 5 Zeilen:', JSON.stringify(rawData.slice(0, 5), null, 2));

    if (rawData.length < 2) {
      return NextResponse.json({ message: 'Die Excel-Datei enthält nicht genug Daten.' }, { status: 400 });
    }

    // Suche nach Header-Zeile in den ersten 10 Zeilen
    let headerRowIndex = -1;
    let headerRow: unknown[] = [];

    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      
      // Prüfe ob diese Zeile Header enthält
      const hasUrlColumn = row.some(cell => {
        const str = normalizeKey(String(cell));
        return str.includes('landingpage') && str.includes('url') || 
               str === 'url' || 
               str === 'landingpageurl';
      });

      if (hasUrlColumn) {
        headerRowIndex = i;
        headerRow = row;
        console.log(`✅ Header gefunden in Zeile ${i + 1}:`, headerRow);
        break;
      }
    }

    if (headerRowIndex === -1) {
      console.error('❌ Kein Header gefunden!');
      return NextResponse.json({ 
        message: 'Keine Header-Zeile gefunden. Erste Zeile der Datei: ' + JSON.stringify(rawData[0])
      }, { status: 400 });
    }

    // Erstelle Spalten-Mapping
    const columnIndices = {
      url: -1,
      hauptKeyword: -1,
      weitereKeywords: -1,
      suchvolumen: -1,
      position: -1
    };

    headerRow.forEach((header, idx) => {
      const normalized = normalizeKey(String(header));
      
      // URL-Spalte
      if (normalized.includes('landingpage') && normalized.includes('url') || normalized === 'url') {
        columnIndices.url = idx;
        console.log(`  → URL-Spalte: Index ${idx} ("${header}")`);
      }
      
      // Haupt-Keyword
      if (normalized.includes('haupt') && normalized.includes('keyword') || normalized === 'hauptkeyword') {
        columnIndices.hauptKeyword = idx;
        console.log(`  → Haupt-Keyword: Index ${idx} ("${header}")`);
      }
      
      // Weitere Keywords
      if (normalized.includes('weitere') && normalized.includes('keyword') || normalized === 'weiterekeywords') {
        columnIndices.weitereKeywords = idx;
        console.log(`  → Weitere Keywords: Index ${idx} ("${header}")`);
      }
      
      // Suchvolumen
      if (normalized.includes('suchvolumen') || normalized.includes('searchvolume') || normalized === 'volume') {
        columnIndices.suchvolumen = idx;
        console.log(`  → Suchvolumen: Index ${idx} ("${header}")`);
      }
      
      // Position
      if (normalized.includes('aktuelle') && normalized.includes('pos') || normalized === 'position' || normalized === 'aktuellepos') {
        columnIndices.position = idx;
        console.log(`  → Position: Index ${idx} ("${header}")`);
      }
    });

    console.log('Finale Spalten-Indizes:', columnIndices);

    if (columnIndices.url === -1) {
      return NextResponse.json({ 
        message: `URL-Spalte nicht gefunden! Verfügbare Spalten: ${headerRow.join(', ')}`
      }, { status: 400 });
    }

    // Verarbeite Datenzeilen
    const dataRows = rawData.slice(headerRowIndex + 1);
    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const debugInfo: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const excelRowNum = headerRowIndex + i + 2;
      
      // Überspringe komplett leere Zeilen
      const hasContent = row.some(cell => cell && String(cell).trim() !== '');
      if (!hasContent) {
        skippedCount++;
        continue;
      }

      const urlValue = toStr(row[columnIndices.url]);
      const hauptKeyword = columnIndices.hauptKeyword !== -1 ? toStr(row[columnIndices.hauptKeyword]) : null;
      const weitereKeywords = columnIndices.weitereKeywords !== -1 ? toStr(row[columnIndices.weitereKeywords]) : '';
      const suchvolumen = columnIndices.suchvolumen !== -1 ? toNum(row[columnIndices.suchvolumen]) : null;
      const aktuellePosition = columnIndices.position !== -1 ? toNum(row[columnIndices.position]) : null;

      const logEntry = `Zeile ${excelRowNum}: url="${urlValue}" keyword="${hauptKeyword}" vol=${suchvolumen} pos=${aktuellePosition}`;
      console.log(logEntry);
      debugInfo.push(logEntry);

      // Validierung
      if (!urlValue) {
        skippedCount++;
        errors.push(`Zeile ${excelRowNum}: Leere URL`);
        continue;
      }

      if (urlValue.length < 5) {
        skippedCount++;
        errors.push(`Zeile ${excelRowNum}: URL zu kurz`);
        continue;
      }

      if (!urlValue.startsWith('http://') && !urlValue.startsWith('https://')) {
        skippedCount++;
        errors.push(`Zeile ${excelRowNum}: URL startet nicht mit http(s)://`);
        continue;
      }

      // Datenbank-Insert
      try {
        await sql`
          INSERT INTO landingpages (user_id, url, haupt_keyword, weitere_keywords, suchvolumen, aktuelle_position)
          VALUES (${userId}, ${urlValue}, ${hauptKeyword}, ${weitereKeywords}, ${suchvolumen}, ${aktuellePosition})
          ON CONFLICT (url, user_id) DO UPDATE SET
            haupt_keyword = EXCLUDED.haupt_keyword,
            weitere_keywords = EXCLUDED.weitere_keywords,
            suchvolumen = EXCLUDED.suchvolumen,
            aktuelle_position = EXCLUDED.aktuelle_position;
        `;
        importedCount++;
        console.log(`✅ Erfolgreich importiert: ${urlValue}`);
      } catch (dbError) {
        console.error(`❌ DB-Fehler bei Zeile ${excelRowNum}:`, dbError);
        errors.push(`Zeile ${excelRowNum}: DB-Fehler - ${dbError instanceof Error ? dbError.message : 'Unbekannt'}`);
        skippedCount++;
      }
    }

    console.log(`\n📊 Import abgeschlossen: ${importedCount} erfolgreich, ${skippedCount} übersprungen`);

    const message = importedCount > 0 
      ? `✅ ${importedCount} Landingpage(s) erfolgreich importiert${skippedCount > 0 ? ` (${skippedCount} übersprungen)` : ''}.`
      : `⚠️ Keine Daten importiert. ${skippedCount} Zeile(n) übersprungen.`;
    
    return NextResponse.json({
      message,
      imported: importedCount,
      skipped: skippedCount,
      total: dataRows.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      debug: debugInfo.slice(0, 5), // Erste 5 Zeilen als Debug-Info
      columnMapping: columnIndices
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
