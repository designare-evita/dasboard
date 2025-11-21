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

// ✅ NEU: Robuste Hilfsfunktion zum Finden von Werten in einer Zeile
// Ignoriert Groß/Kleinschreibung, BOM-Marker und Leerzeichen
function getRowValue(row: any, possibleKeys: string[]): string | null {
  if (!row || typeof row !== 'object') return null;
  
  const rowKeys = Object.keys(row);
  
  for (const targetKey of possibleKeys) {
    // 1. Normalisierter Ziel-Schlüssel (klein, getrimmt)
    const normalizedTarget = targetKey.toLowerCase().trim();

    // Suche im Row-Objekt nach einem passenden Schlüssel
    const foundKey = rowKeys.find(k => {
      // Entferne BOM (\uFEFF), trimme und mache klein
      const normalizedKey = k.replace(/^\uFEFF/, '').trim().toLowerCase();
      return normalizedKey === normalizedTarget;
    });

    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      const val = String(row[foundKey]).trim();
      return val === '' ? null : val;
    }
  }
  return null;
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
          // Versucht, Trennzeichen (, oder ;) automatisch zu erkennen
        });

        if (parseResult.errors.length > 0) {
          console.error('CSV Parsing Fehler:', parseResult.errors);
          // Wir machen weiter, falls Daten vorhanden sind, warnen aber im Log
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
      // ✅ NEU: Robuste Spalten-Erkennung
      
      // URL suchen
      const url = getRowValue(row, ['Landingpage-URL', 'url', 'URL', 'Link']);
      
      // Keywords suchen
      const hauptKeyword = getRowValue(row, ['Haupt-Keyword', 'Keyword', 'Main Keyword', 'Hauptkeyword']);
      const weitereKeywords = getRowValue(row, ['Weitere Keywords', 'weitere keywords', 'Keywords']);
      
      // Zahlenwerte sicher parsen
      const suchvolumenStr = getRowValue(row, ['Suchvolumen', 'Volumen', 'Volume', 'Search Volume']);
      let suchvolumen = suchvolumenStr ? parseInt(suchvolumenStr, 10) : 0;
      if (isNaN(suchvolumen)) suchvolumen = 0;

      const positionStr = getRowValue(row, ['Aktuelle Pos.', 'Position', 'Rank', 'Pos']);
      let position = positionStr ? parseInt(positionStr, 10) : 0;
      if (isNaN(position)) position = 0;

      // Validierung: URL muss vorhanden sein
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
            updated_at
          )
          VALUES (
            ${userId}::uuid, 
            ${url}, 
            ${hauptKeyword}, 
            ${weitereKeywords}, 
            ${suchvolumen || null}, 
            ${position || null},
            'Offen', -- Standardstatus bei neuem Import
            NOW()
          )
          ON CONFLICT (url, user_id) 
          DO UPDATE SET
            haupt_keyword = EXCLUDED.haupt_keyword,
            weitere_keywords = EXCLUDED.weitere_keywords,
            suchvolumen = EXCLUDED.suchvolumen,
            aktuelle_position = EXCLUDED.aktuelle_position,
            updated_at = NOW()
            -- Status wird NICHT überschrieben
        `;
        
        importedCount++;
      }
    }

    // Optional: Falls 0 importiert wurden, Log-Ausgabe der ersten Zeile zur Diagnose
    if (importedCount === 0 && rawData.length > 0) {
        console.warn('[Upload Debug] Erste Zeile der Rohdaten:', rawData[0]);
        console.warn('[Upload Debug] Erkannte Keys:', Object.keys(rawData[0]));
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
