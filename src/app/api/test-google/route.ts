// src/app/api/test-google/route.ts

import { NextResponse } from 'next/server';
// HIER IST DIE KORREKTUR: getGa4Data -> getAnalyticsData
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api';

export async function GET() {
  try {
    // Harte Test-Daten (ersetze diese bei Bedarf mit echten Werten)
    const TEST_SITE_URL = 'https://max-online.at/'; // Ersetze dies mit einer echten GSC-URL
    const TEST_GA4_PROPERTY_ID = 'properties/314388177'; // Ersetze dies mit einer echten GA4 Property ID

    // Daten für die letzten 30 Tage abrufen
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    const [gscData, ga4Data] = await Promise.all([
      getSearchConsoleData(TEST_SITE_URL, formattedStartDate, formattedEndDate),
      // HIER IST DIE KORREKTUR: getGa4Data -> getAnalyticsData
      getAnalyticsData(TEST_GA4_PROPERTY_ID, formattedStartDate, formattedEndDate)
    ]);

    return NextResponse.json({
      message: 'Google API Test erfolgreich!',
      searchConsole: gscData,
      analytics: ga4Data,
    });

  } catch (error) {
    console.error('Fehler in der Google API Test-Route:', error);
    // Gib eine detailliertere Fehlermeldung im JSON-Format zurück
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: 'Fehler beim Testen der Google API', error: errorMessage }, { status: 500 });
  }
}
