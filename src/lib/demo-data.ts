// src/lib/demo-data.ts
/**
 * Demo-Platzhalterdaten für Demo-Accounts
 * Verhindert leere KPIs und zeigt realistische Beispieldaten
 */

export function getDemoAnalyticsData(dateRange: string) {
  return {
    kpis: {
      totalUsers: {
        value: 2847,
        change: 24.3,
      },
      sessions: {
        value: 4521,
        change: 18.7,
      },
      bounceRate: {
        value: 42.8,
        change: -5.2,
      },
      avgEngagementTime: {
        value: 245,
        change: 12.4,
      },
      conversions: {
        value: 127,
        change: 31.5,
      },
      engagementRate: {
        value: 68.5,
        change: 8.3,
      },
    },
    topConvertingPages: [
      {
        path: '/produkte/sneaker-collection',
        conversions: 52,
        pageviews: 1234,
      },
      {
        path: '/sale/sommer-special',
        conversions: 38,
        pageviews: 987,
      },
      {
        path: '/landingpage/newsletter-anmeldung',
        conversions: 21,
        pageviews: 456,
      },
      {
        path: '/blog/top-trends-2025',
        conversions: 16,
        pageviews: 789,
      },
    ],
    topQueries: [
      {
        query: 'sneaker online kaufen',
        clicks: 234,
        impressions: 5678,
        position: 4.2,
      },
      {
        query: 'sportschuhe sale',
        clicks: 189,
        impressions: 4321,
        position: 6.8,
      },
      {
        query: 'laufschuhe damen',
        clicks: 156,
        impressions: 3890,
        position: 8.1,
      },
    ],
    trafficSources: [
      {
        source: 'google',
        sessions: 2145,
        conversions: 67,
      },
      {
        source: 'direct',
        sessions: 1234,
        conversions: 38,
      },
      {
        source: 'facebook',
        sessions: 678,
        conversions: 12,
      },
      {
        source: 'instagram',
        sessions: 464,
        conversions: 10,
      },
    ],
  };
}
