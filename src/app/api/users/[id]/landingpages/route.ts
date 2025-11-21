// src/app/api/users/[id]/landingpages/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { Landingpage } from '@/types';
import * as XLSX from '@e965/xlsx';
import Papa from 'papaparse';
import { getGoogleSheetData } from '@/lib/google-api';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function extractSheetId(url: string): string | null {
  const regex = /\/d\/([a-zA-Z0-9-_]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Robuste Hilfsfunktion zum Finden von Werten
function getRowValue(row: any, possibleKeys: string[]): string | null {
  if (!row || typeof row !== 'object') return null;
  
  const rowKeys = Object.keys(row);
  
  for (const targetKey of possibleKeys) {
    const normalizedTarget = targetKey.toLowerCase().trim();

    const foundKey = rowKeys.find(k => {
      // Entferne BOM, Anführungszeichen, Trimmen
      const normalizedKey = k.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').trim().toLowerCase();
      return normalizedKey === normalizedTarget;
    });

    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      const val = String(row[foundKey]).trim();
      // Entferne umschließende Anführungszeichen vom Wert, falls vorhanden
      return val.replace(/^"|"$/g, '');
    }
  }
  return null;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const session = await auth();
    
    if (!session?.user || (session.user.id !== userId && session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Nicht autorisiert.' }, { status: 401 });
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

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const session = await auth();

    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Nicht autorisiert. Nur Admins dürfen Landingpages importieren.' }, { status: 403 });
    }

    let rawData: any[] = [];
    const contentType = request.headers.get('content-type') || '';

    // --- GOOGLE SHEET ---
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { sheetUrl } = body;
      if (!sheetUrl) return NextResponse.json({ message: 'Keine URL.' }, { status: 400 });
      
      const sheetId = extractSheetId(sheetUrl);
      if (!sheetId) return NextResponse.json({ message: 'Ungültige URL.' }, { status: 400 });

      try {
        rawData = await getGoogleSheetData(sheetId);
      } catch (err) {
        return NextResponse.json({ 
          message: 'Zugriff auf Google Sheet fehlgeschlagen.',
          error: err instanceof Error ? err.message : String(err)
        }, { status: 403 });
      }
    } 
    // --- DATEI UPLOAD ---
    else {
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) return NextResponse.json({ message: 'Keine Datei.' }, { status: 400 });

      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.csv')) {
        const text = await file.text();
        const parseResult = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          transformHeader: (h) => h.trim().replace(/^"|"$/g, '') // Header bereinigen
        });
        
        if (parseResult.errors.length > 0) console.error('CSV Fehler:', parseResult.errors);
        rawData = parseResult.data;
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      } else {
        return NextResponse.json({ message: 'Ungültiges Format.' }, { status: 400 });
      }
    }

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ message: 'Keine Daten gefunden.' }, { status: 400 });
    }

    let importedCount = 0;

    // Transaktion für Performance und Sicherheit
    const client = await sql.connect();
    
    try {
      await client.query('BEGIN');

      for (const row of rawData) {
        // ✅ ERWEITERTE Spalten-Erkennung für DB-Export und Template
        const url = getRowValue(row, ['url', 'landingpage-url', 'link', 'landingpage_url']);
        
        // Überspringe leere Zeilen
        if (!url) continue;

        const hauptKeyword = getRowValue(row, ['haupt_keyword', 'haupt-keyword', 'keyword', 'main keyword']);
        const weitereKeywords = getRowValue(row, ['weitere_keywords', 'weitere keywords', 'keywords']);
        
        // Zahlen parsen
        const volStr = getRowValue(row, ['suchvolumen', 'volumen', 'volume']);
        const suchvolumen = volStr ? parseInt(volStr, 10) : 0;

        const posStr = getRowValue(row, ['aktuelle_position', 'aktuelle pos.', 'position', 'rank']);
        const position = posStr ? parseInt(posStr, 10) : 0;

        // Status aus der Datei lesen (falls vorhanden), sonst 'Offen' für neue
        const statusImport = getRowValue(row, ['status']);
        // Erlaube Status-Import nur, wenn er gültig ist
        const validStatus = ['Offen', 'In Prüfung', 'Gesperrt', 'Freigegeben'].includes(statusImport || '') 
          ? statusImport 
          : 'Offen';

        // ✅ UPSERT LOGIK
        await client.query(`
          INSERT INTO landingpages (
            user_id, url, haupt_keyword, weitere_keywords, 
            suchvolumen, aktuelle_position, status, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          ON CONFLICT (url, user_id) 
          DO UPDATE SET
            haupt_keyword = EXCLUDED.haupt_keyword,
            weitere_keywords = EXCLUDED.weitere_keywords,
            suchvolumen = EXCLUDED.suchvolumen,
            aktuelle_position = EXCLUDED.aktuelle_position,
            updated_at = NOW()
            -- Status wird NICHT überschrieben, es sei denn wir wollten einen Force-Import
        `, [
          userId, 
          url, 
          hauptKeyword || null, 
          weitereKeywords || null, 
          suchvolumen || null, 
          position || null, 
          validStatus
        ]);
        
        importedCount++;
      }

      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

    // Debugging, falls immer noch 0
    if (importedCount === 0 && rawData.length > 0) {
      console.log('[Import Debug] Keys der ersten Zeile:', Object.keys(rawData[0]));
    }

    return NextResponse.json({ 
      message: `${importedCount} Landingpages erfolgreich importiert.` 
    });

  } catch (error) {
    console.error('Import Fehler:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Import.',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
