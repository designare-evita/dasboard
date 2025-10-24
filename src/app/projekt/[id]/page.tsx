// src/app/projekt/[id]/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useApiData from '@/hooks/use-api-data'; // Dein Custom Hook zum Datenladen
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
// NEU: Importiere die geteilten Typen und die Hilfsfunktion
import {
  ProjectDashboardData,
  hasDashboardData
} from '@/lib/dashboard-shared';
// NEU: Importiere die wiederverwendbare Dashboard-Komponente
import ProjectDashboard from '@/components/ProjectDashboard';
// Alte Typen (KpiDatum, ChartPoint, ProjectApiData, ActiveKpi) und
// alte Komponenten (KpiCard, KpiCardsGrid, KpiTrendChart, AiTrafficCard, TopQueriesList)
// werden hier nicht mehr direkt benötigt, da sie in ProjectDashboard verwendet werden.

export default function ProjektDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  // State für den Zeitraum bleibt hier
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  // API-Datenabruf mit dem generischen Typ ProjectDashboardData
  const { data, isLoading, error } = useApiData<ProjectDashboardData>(
    // Stelle sicher, dass der API-Endpunkt korrekt ist und den dateRange verwendet
    `/api/projects/${projectId}?dateRange=${dateRange}`
  );

  // --- Lade- und Fehlerzustände ---
  if (isLoading) {
    // Optional: Füge hier eine detailliertere Ladeanzeige hinzu
    return (
      <div className="p-8 text-center">
        <p>Lade Projektdaten...</p>
      </div>
    );
  }

  if (error) {
    // Zeige eine Fehlermeldung an
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded border border-red-200">
        <h3>Fehler beim Laden der Projektdaten</h3>
        <p className="text-sm mt-2">{error}</p>
      </div>
    );
  }

  // --- Fall: Keine Daten gefunden ---
  if (!data) {
    return (
      <div className="p-8 text-center text-gray-500">
        Keine Daten für dieses Projekt gefunden oder das Projekt existiert nicht.
      </div>
    );
  }

  // --- Logik für "Keine Daten"-Hinweis ---
  // Verwende die Hilfsfunktion, um zu prüfen, ob valide Daten vorhanden sind
  // Zeige den Hinweis nur an, wenn der Ladevorgang abgeschlossen ist UND keine Daten da sind.
  const showNoDataHint = !isLoading && !hasDashboardData(data);

  // --- Rendern der Seite mit der neuen Komponente ---
  return (
    // Padding für die Seite
    <div className="p-4 sm:p-6 md:p-8">
      {/*
        * Die ProjectDashboard-Komponente rendert jetzt das gesamte Layout:
        * - Header mit DateRangeSelector
        * - KPI-Karten
        * - Diagramm mit Tabs
        * - AI-Traffic-Karte (wenn Daten vorhanden)
        * - Top-Queries-Liste (wenn Daten vorhanden)
        * Sie verwaltet auch den 'activeKpi'-Status intern.
      */}
      <ProjectDashboard
        data={data} // Die geladenen Daten
        isLoading={isLoading} // Wird für interne Ladeanzeigen (z.B. in KpiCardsGrid) verwendet
        dateRange={dateRange} // Aktueller Zeitraum
        onDateRangeChange={setDateRange} // Funktion zum Ändern des Zeitraums
        showNoDataHint={showNoDataHint} // Ob der "Keine Daten"-Hinweis angezeigt werden soll
        // Optional: Eigener Text für den Hinweis auf dieser Seite
        noDataHintText="Hinweis: Für dieses Projekt wurden noch keine KPI-/Zeitreihen-Daten geliefert. Es werden vorübergehend Platzhalter-Werte (0) angezeigt."
      />
    </div>
  );
}
