// src/app/api/setup-project-assignments/route.ts
// (Diese Datei wird wiederhergestellt)

import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // WICHTIG: Referenziert users(id) für beide Spalten,
    // da sowohl Admins (user_id) als auch Projekte/Kunden (project_id) in der users-Tabelle leben.
    const result = await sql`
      CREATE TABLE IF NOT EXISTS project_assignments (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, project_id)
      );
    `;
    
    console.log('Tabelle "project_assignments" erfolgreich geprüft/erstellt.');
    
    return NextResponse.json({ 
      message: "Tabelle 'project_assignments' erfolgreich geprüft/erstellt.",
      result 
    }, { status: 200 });
  } catch (error) {
    console.error("Fehler beim Erstellen der 'project_assignments' Tabelle:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
