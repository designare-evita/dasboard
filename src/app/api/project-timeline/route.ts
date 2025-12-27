// src/app/api/project-timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // ==========================================
    // ✅ DEMO-MODUS CHECK
    // ==========================================
    const isDemo = session.user.email?.includes('demo');
    
    if (isDemo) {
      console.log('[Project Timeline] Demo-User erkannt. Sende Demo-Daten...');
      
      // Generiere Demo-Daten für die Timeline
      const demoData = {
        project: {
          startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // vor 60 Tagen
          durationMonths: 6
        },
        progress: {
          counts: {
            'Offen': 3,
            'In Prüfung': 5,
            'Gesperrt': 1,
            'Freigegeben': 21,
            'Total': 30
          },
          percentage: 70
        },
        gscImpressionTrend: generateTrendData(60, 800, 1200),
        aiTrafficTrend: generateTrendData(60, 50, 180),
        topMovers: [
          {
            url: 'https://demo-shop.de/produkte/sneaker-collection',
            haupt_keyword: 'sneaker online kaufen',
            gsc_impressionen: 5234,
            gsc_impressionen_change: 1823
          },
          {
            url: 'https://demo-shop.de/sale/sommer-special',
            haupt_keyword: 'sportschuhe sale',
            gsc_impressionen: 3421,
            gsc_impressionen_change: 987
          },
          {
            url: 'https://demo-shop.de/laufschuhe-damen',
            haupt_keyword: 'laufschuhe damen',
            gsc_impressionen: 2876,
            gsc_impressionen_change: 654
          }
        ]
      };

      return NextResponse.json(demoData);
    }
    // ==========================================
    // ENDE DEMO-MODUS
    // ==========================================

    // Hier kommt der normale Code für echte User...
    // (wird nicht ausgeführt für Demo-User)
    
    return NextResponse.json({ message: 'Not implemented for non-demo users' }, { status: 501 });
    
  } catch (error) {
    console.error('[Project Timeline] Error:', error);
    return NextResponse.json({ message: 'Fehler' }, { status: 500 });
  }
}

// Helper: Generiert Trend-Daten mit aufsteigender Tendenz
function generateTrendData(days: number, minValue: number, maxValue: number) {
  const data = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    // Wert steigt über Zeit von minValue zu maxValue
    const progress = (days - i) / days;
    const value = Math.floor(minValue + (maxValue - minValue) * progress + (Math.random() - 0.5) * 100);
    
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.max(0, value)
    });
  }
  
  return data;
}
