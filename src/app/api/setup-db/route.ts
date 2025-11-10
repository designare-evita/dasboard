import { NextResponse } from 'next/server';
import { createTables } from '@/lib/database';

// Diese Route ruft die Funktion auf, um die Datenbanktabellen zu erstellen.
export async function GET() {
  try {
    await createTables();
    return NextResponse.json({ message: 'Datenbank-Tabellen erfolgreich erstellt!' });
  } catch (error) {
    return NextResponse.json(
      { message: 'Fehler beim Erstellen der Tabellen', error: (error as Error).message },
      { status: 500 }
    );
  }
}
