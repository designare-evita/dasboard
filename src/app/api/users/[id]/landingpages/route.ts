// src/app/api/users/[id]/landingpages/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { Landingpage } from '@/types';
// Importe für Datei-Parsing
import * as XLSX from '@e965/xlsx';
import Papa from 'papaparse';
// Import für Google Sheet
import { getGoogleSheetData } from '@/lib/google-api';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Hilfsfunktion zur Extraktion der Sheet-ID
function extractSheetId(url: string): string | null {
  const regex = /\/d\/([a-zA-Z0-9-_]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// --- GET Handler ---
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const session = await auth();
    
    if (!session?.user || (session.user.id !== userId && session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Nicht autorisiert.' }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ message: 'Benutzer-ID fehlt.' }, { status: 400 });
    }

    const { rows: landingpages } = await sql<Landingpage>`
      SELECT *
      FROM landingpages
      WHERE user_id::text = ${userId}
      ORDER BY id DESC
    `;

    return NextResponse.json(landingpages);
  } catch (error) {
    console.error('Fehler in /api/users/[id]/landingpages GET:', error);
    return NextResponse.json({ message: 'Interner Serverfehler.' }, { status: 500 });
  }
}

// --- POST Handler für Uploads (Datei & Google Sheet) ---
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const session = await auth();

    // Berechtigungsprüfung: Nur Admins/Superadmins dürfen hochladen
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Nicht autorisiert. Nur Admins dürfen Landingpages importieren.' }, { status: 403 });
    }

    let rawData: any[] = [];
    const contentType = request.headers.get('content-type') || '';

    // --- FALL 1: Google Sheet Link (JSON) ---
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { sheetUrl } = body;

      if (!sheetUrl) {
        return NextResponse.json({ message: 'Keine Google Sheet URL angegeben.' }, { status: 400 });
      }

      const sheetId = extractSheetId(sheetUrl);
      if (!sheetId) {
        return NextResponse.json({ message: 'Ungültige Google Sheet URL.' }, { status: 400 });
      }

      console.log('[Import] Starte Google Sheet Import für ID:', sheetId);
      try {
        rawData = await getGoogleSheetData(sheetId);
      } catch (err) {
        console.error('[Import] Fehler beim Sheet-Zugriff:', err);
        return NextResponse.json({ 
          message: 'Zugriff auf Google Sheet fehlgeschlagen. Wurde das Sheet mit der Service-E-Mail geteilt?',
          error: err instanceof Error ? err.message : String(err)
        }, { status: 403 });
      }

    } 
    // --- FALL 2: Datei Upload (FormData) ---
    else {
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json({ message: 'Keine Datei hochgeladen.' }, { status: 400 });
      }

      const fileName = file.name.toLowerCase();

      // A) CSV Verarbeitung
      if (fileName.endsWith('.csv')) {
        console.log('[Upload] Verarbeite CSV:', fileName);
        const text = await file.text();
        
        const parseResult = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
        });

        if (parseResult.errors.length > 0) {
          console.error('CSV Parsing Fehler:', parseResult.errors);
          return NextResponse.json({ message: 'Fehler beim Lesen der CSV-Datei.' }, { status: 400 });
        }
        rawData = parseResult.data;
      } 
      // B) Excel Verarbeitung
      else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        console.log('[Upload] Verarbeite Excel:', fileName);
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        rawData = XLSX.utils.sheet_to_json(worksheet);
      } 
      else {
        return NextResponse.json({ message: 'Ungültiges Dateiformat. Bitte .xlsx oder .csv verwenden.' }, { status: 400 });
      }
    }

    // --- GEMEINSAME DATENVERARBEITUNG ---

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ message: 'Es wurden keine Daten gefunden (Datei/Sheet leer?).' }, { status: 400 });
    }

    let importedCount = 0;

    for (const row of rawData) {
      // Flexibles Mapping für Spaltennamen (Case-Insensitive oder Variationen)
      // Sheet/Excel Spalten: Landingpage-URL, Haupt-Keyword, Weitere Keywords, Suchvolumen, Aktuelle Pos.
      
      const url = (row['Landingpage-URL'] || row['url'] || row['URL'])?.toString().trim();
      const hauptKeyword = (row['Haupt-Keyword'] || row['Keyword'] || row['keyword'])?.toString().trim() || null;
      const weitereKeywords = (row['Weitere Keywords'] || row['weitere keywords'])?.toString().trim() || null;
      
      let suchvolumen = parseInt(row['Suchvolumen'] || row['Volumen'], 10);
      if (isNaN(suchvolumen)) suchvolumen = 0;

      let position = parseInt(row['Aktuelle Pos.'] || row['Position'], 10);
      if (isNaN(position)) position = 0;

      if (url) {
        // Insert oder Update (Upsert)
        await sql`
          INSERT INTO landingpages (
            user_id, 
            url, 
            haupt_keyword, 
            weitere_keywords, 
            suchvolumen, 
            aktuelle_position,
            status,
            updated_at -- ✅ NEU: Initialwert setzen
          )
          VALUES (
            ${userId}::uuid, 
            ${url}, 
            ${hauptKeyword}, 
            ${weitereKeywords}, 
            ${suchvolumen || null}, 
            ${position || null},
            'Offen',
            NOW() -- ✅ NEU
          )
          ON CONFLICT (url, user_id) 
          DO UPDATE SET
            haupt_keyword = EXCLUDED.haupt_keyword,
            weitere_keywords = EXCLUDED.weitere_keywords,
            suchvolumen = EXCLUDED.suchvolumen,
            aktuelle_position = EXCLUDED.aktuelle_position,
            updated_at = NOW() -- ✅ NEU: Aktualisiert Zeitstempel bei Re-Import
            -- Status wird NICHT überschrieben
        `;
        
        importedCount++;
      }
    }

    return NextResponse.json({ 
      message: `${importedCount} Landingpages erfolgreich synchronisiert/importiert.` 
    });

  } catch (error) {
    console.error('Fehler in /api/users/[id]/landingpages POST:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Importieren der Daten.',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
