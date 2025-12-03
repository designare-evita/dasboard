// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { ConvertingPageData } from "@/lib/dashboard-shared"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Fasst Landingpages zusammen, indem URL-Parameter (wie fbclid) entfernt werden.
 * Werte wie Sessions und Conversions werden addiert, Raten neu berechnet.
 */
export function aggregateLandingPages(pages: ConvertingPageData[]): ConvertingPageData[] {
  const pageMap = new Map<string, ConvertingPageData>();

  pages.forEach((page) => {
    // 1. Alles ab dem Fragezeichen abschneiden (z.B. /angebot?fbclid=123 -> /angebot)
    const cleanPath = page.path.split('?')[0];

    if (pageMap.has(cleanPath)) {
      // 2. Wenn der saubere Pfad schon existiert: Werte zusammenführen
      const existing = pageMap.get(cleanPath)!;
      
      // Metriken addieren
      const totalSessions = (existing.sessions || 0) + (page.sessions || 0);
      const totalConversions = existing.conversions + page.conversions;
      const totalNewUsers = (existing.newUsers || 0) + (page.newUsers || 0);

      // Conversion Rate basierend auf neuen Summen berechnen
      const newConversionRate = totalSessions > 0 
        ? (totalConversions / totalSessions) * 100 
        : 0;
        
      // Engagement Rate gewichtet berechnen (damit Seiten mit viel Traffic stärker zählen)
      let newEngagementRate = 0;
      if (totalSessions > 0) {
        const weightExisting = existing.sessions || 0;
        const weightPage = page.sessions || 0;
        const rateExisting = existing.engagementRate || 0;
        const ratePage = page.engagementRate || 0;
        
        newEngagementRate = ((rateExisting * weightExisting) + (ratePage * weightPage)) / totalSessions;
      } else {
        // Fallback: Einfacher Durchschnitt, wenn keine Sessions da sind
        newEngagementRate = ((existing.engagementRate || 0) + (page.engagementRate || 0)) / 2;
      }

      pageMap.set(cleanPath, {
        ...existing,
        sessions: totalSessions,
        conversions: totalConversions,
        newUsers: totalNewUsers,
        conversionRate: newConversionRate,
        engagementRate: parseFloat(newEngagementRate.toFixed(2)) // Runden für saubere Daten
      });

    } else {
      // 3. Neuer Eintrag für diesen Pfad (noch nicht in Map)
      pageMap.set(cleanPath, {
        ...page,
        path: cleanPath
      });
    }
  });

  // Array zurückgeben und nach Conversions sortieren (höchste zuerst)
  return Array.from(pageMap.values())
    .sort((a, b) => b.conversions - a.conversions);
}
