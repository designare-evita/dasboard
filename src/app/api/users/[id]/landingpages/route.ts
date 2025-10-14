// src/app/api/users/[id]/landingpages/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import * as xlsx from 'xlsx';

// Typ-Definitionen bleiben gleich
type RedaktionsplanRow = {
  'Landingpage-URL'?: string;
  'URL'?: string;
  'Haupt-Keyword'?: string;
  'Weitere Keywords'?: string;
  'Suchvolumen'?: number | string;
  'Aktuelle Pos.'?: number | string;
};

// GET-Funktion bleibt unverändert
export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const userId = context.params.id;

  if (!session?.user) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  if (session.user.role === 'BENUTZER' && session.user.id !== userId) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  try {
    const { rows } = await sql`
      SELECT id, url, status, haupt_keyword, aktuelle_position 
      FROM landingpages 
      WHERE user_id = ${userId} 
      ORDER BY created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Landingpages:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// POST-Funktion wird jetzt intelligenter
export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const userId = context.params.id;

  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ message: 'Keine Datei hochgeladen' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // *** HIER IST DIE NEUE LOGIK ***
    // Wir konvertieren das Sheet in ein Array von Arrays, um die Header-Zeile manuell zu finden
    const dataAsArray: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    // Finde die Zeilennummer, in der die Header beginnen (wir suchen nach 'Landingpage-URL')
    let headerRowIndex = -1;
    for (let i = 0; i < dataAsArray.length; i++) {
        if (dataAsArray[i].includes('Landingpage-URL')) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex === -1) {
        return NextResponse.json({ message: 'Konnte die Header-Zeile (Spalte "Landingpage-URL") in der Datei nicht finden.' }, { status: 400 });
    }

    // Extrahiere die Header und die Datenzeilen
    const headers = dataAsArray[headerRowIndex];
    const dataRows = dataAsArray.slice(headerRowIndex + 1);

    // Konvertiere die Datenzeilen in Objekte
    const data = dataRows.map(row => {
        const obj: Record<string, any> = {};
        headers.forEach((header, index) => {
            obj[header] = row[index];
        });
        return obj as RedaktionsplanRow;
    });

    let importedCount = 0;
    await sql.begin(async (sql) => {
      for (const row of data) {
        const url = row['Landingpage-URL'] || row['URL'];
        
        if (url && typeof url === 'string' && url.startsWith('http')) {
          const hauptKeyword = row['Haupt-Keyword'];
          const weitereKeywords = row['Weitere Keywords'];
          const suchvolumen = row['Suchvolumen'] ? parseInt(String(row['Suchvolumen']), 10) : null;
          const aktuellePosition = row['Aktuelle Pos.'] ? parseInt(String(row['Aktuelle Pos.']), 10) : null;

          await sql`
            INSERT INTO landingpages
            (user_id, url, haupt_keyword, weitere_keywords, suchvolumen, aktuelle_position)
            VALUES
            (${userId}, ${url}, ${hauptKeyword}, ${weitereKeywords}, ${suchvolumen}, ${aktuellePosition})
            ON CONFLICT (url, user_id) DO NOTHING; -- Verhindert Duplikate
          `;
          importedCount++;
        }
      }
    });

    return NextResponse.json({ message: `${importedCount} Zeilen erfolgreich importiert.` });
  } catch (error) {
    console.error("Upload Fehler:", error);
    return NextResponse.json({ message: 'Fehler beim Verarbeiten der Datei.' }, { status: 500 });
  }
}
