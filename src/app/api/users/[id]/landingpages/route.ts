// src/app/api/users/[id]/landingpages/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import * as xlsx from 'xlsx';

// GET: Landingpages für einen Benutzer abrufen (brauchen wir später)
export async function GET(request: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    const userId = params.id;

    if (!session?.user) {
        return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    if (session.user.role === 'BENUTZER' && session.user.id !== userId) {
        return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    try {
        const { rows } = await sql`
            SELECT id, url, status, haupt_keyword, aktuelle_position FROM landingpages WHERE user_id = ${userId} ORDER BY created_at DESC
        `;
        return NextResponse.json(rows);
    } catch (error) {
        return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
    }
}

// POST: Landingpages aus einer XLSX-Datei hochladen
export async function POST(request: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    const userId = params.id;

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
        const data = xlsx.utils.sheet_to_json(worksheet) as Record<string, any>[];

        // URLs und Metadaten in die Datenbank einfügen
        await sql.begin(async (sql) => {
            for (const row of data) {
                const url = row['Landingpage-URL'] || row['URL'];
                const hauptKeyword = row['Haupt-Keyword'];
                const weitereKeywords = row['Weitere Keywords'];
                const suchvolumen = parseInt(row['Suchvolumen'], 10) || null;
                const aktuellePosition = parseInt(row['Aktuelle Pos.'], 10) || null;

                if (url && typeof url === 'string' && url.startsWith('http')) {
                    await sql`
                        INSERT INTO landingpages
                        (user_id, url, haupt_keyword, weitere_keywords, suchvolumen, aktuelle_position)
                        VALUES
                        (${userId}, ${url}, ${hauptKeyword}, ${weitereKeywords}, ${suchvolumen}, ${aktuellePosition})
                    `;
                }
            }
        });

        return NextResponse.json({ message: `${data.length} Zeilen erfolgreich importiert.` });
    } catch (error) {
        console.error("Upload Fehler:", error);
        return NextResponse.json({ message: 'Fehler beim Verarbeiten der Datei' }, { status: 500 });
    }
}
