// src/app/api/test-google/route.ts

import { NextResponse } from 'next/server';
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api';

export async function GET() {
  try {
    // WARNING: This test route will likely fail without real, valid tokens.
    // It is corrected here to fix the build error.
    const userTokens = {
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token',
    };

    const TEST_SITE_URL = 'https://max-online.at'; 
    const TEST_GA4_PROPERTY_ID = '314388177'; 

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    const [gscData, ga4Data] = await Promise.all([
      // The missing userTokens argument is now added
      getSearchConsoleData(TEST_SITE_URL, formattedStartDate, formattedEndDate, userTokens),
      getAnalyticsData(TEST_GA4_PROPERTY_ID, formattedStartDate, formattedEndDate, userTokens)
    ]);

    return NextResponse.json({
      message: 'Google API Test erfolgreich!',
      searchConsole: gscData,
      analytics: ga4Data,
    });

  } catch (error) {
    console.error('Fehler in der Google API Test-Route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: 'Fehler beim Testen der Google API', error: errorMessage }, { status: 500 });
  }
}
