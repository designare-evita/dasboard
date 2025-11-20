// src/app/api/users/[id]/landingpages/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { Landingpage } from '@/types';
// Importe für Datei-Parsing
import * as XLSX from '@e965/xlsx';
import Papa from 'papaparse';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// --- GET Handler (bleibt unverändert, aber hier zur Vollständigkeit) ---
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

// --- POST Handler für Uploads (CSV & XLSX) ---
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const session = await auth();

    // Berechtigungsprüfung: Nur Admins/Superadmins dürfen hochladen
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Nicht autorisiert. Nur Admins dürfen Landingpages importieren.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ message: 'Keine Datei hochgeladen.' }, { status: 400 });
    }

    // Daten-Array initialisieren
    let rawData: any[] = [];
    const fileName = file.name.toLowerCase();

    // --- Fall A: CSV Verarbeitung ---
    if (fileName.endsWith('.csv')) {
      console.log('[Upload] Verarbeite CSV:', fileName);
      const text = await file.text();
      
      const parseResult = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true, // Konvertiert Zahlen automatisch
      });

      if (parseResult.errors.length > 0) {
        console.error('CSV Parsing Fehler:', parseResult.errors);
        return NextResponse.json({ message: 'Fehler beim Lesen der CSV-Datei.' }, { status: 400 });
      }
      rawData = parseResult.data;
    } 
    // --- Fall B: Excel (XLSX) Verarbeitung ---
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

    // --- Daten Validierung und Import ---
    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ message: 'Die Datei scheint leer zu sein.' }, { status: 400 });
    }

    let importedCount = 0;
    let updateCount = 0;

    // Durchlaufe alle Zeilen
    for (const row of rawData) {
      // Spalten-Mapping basierend auf den Namen in der Vorlage
      // Wir nutzen trim(), um Leerzeichen zu entfernen
      const url = row['Landingpage-URL']?.toString().trim();
      const hauptKeyword = row['Haupt-Keyword']?.toString().trim() || null;
      const weitereKeywords = row['Weitere Keywords']?.toString().trim() || null;
      
      // Zahlen parsen und säubern
      let suchvolumen = parseInt(row['Suchvolumen'], 10);
      if (isNaN(suchvolumen)) suchvolumen = 0;

      let position = parseInt(row['Aktuelle Pos.'], 10);
      if (isNaN(position)) position = 0;

      if (url) {
        // Insert oder Update (Upsert) in die Datenbank
        // Wir verwenden ON CONFLICT, um bestehende URLs für diesen User zu aktualisieren
        await sql`
          INSERT INTO landingpages (
            user_id, 
            url, 
            haupt_keyword, 
            weitere_keywords, 
            suchvolumen, 
            aktuelle_position,
            status
          )
          VALUES (
            ${userId}::uuid, 
            ${url}, 
            ${hauptKeyword}, 
            ${weitereKeywords}, 
            ${suchvolumen || null}, 
            ${position || null},
            'Offen' -- Standardstatus bei Import
          )
          ON CONFLICT (url, user_id) 
          DO UPDATE SET
            haupt_keyword = EXCLUDED.haupt_keyword,
            weitere_keywords = EXCLUDED.weitere_keywords,
            suchvolumen = EXCLUDED.suchvolumen,
            aktuelle_position = EXCLUDED.aktuelle_position
            -- Status wird NICHT überschrieben, um bestehende Workflows nicht zu stören
        `;
        
        // Wir zählen hier einfach alles als "importiert"
        importedCount++;
      }
    }

    return NextResponse.json({ 
      message: `${importedCount} Landingpages erfolgreich importiert/aktualisiert.` 
    });

  } catch (error) {
    console.error('Fehler in /api/users/[id]/landingpages POST:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Verarbeiten der Datei.',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
