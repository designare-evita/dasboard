// src/components/ProjectTimelineWidget.tsx
'use client';

import useSWR from 'swr';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  Label,
} from 'recharts';
import { 
  BarChart, 
  CalendarCheck, 
  CheckCircle, 
  ClockHistory, 
  GraphUpArrow, 
  HourglassSplit,
  BoxSeam
} from 'react-bootstrap-icons';
import { addMonths, format, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';

// Typen für die API-Antwort
interface StatusCounts {
  'Offen': number;
  'In Prüfung': number;
  'Gesperrt': number;
  'Freigegeben': number;
  'Total': number;
}
interface GscDataPoint {
  date: string;
  value: number; // 'value' enthält die Impressionen
}
interface TimelineData {
  project: {
    startDate: string;
    durationMonths: number;
  };
  progress: {
    counts: StatusCounts;
    percentage: number;
  };
  gscImpressionTrend: GscDataPoint[];
}

// Typen für Tooltip
interface TooltipPayload {
  dataKey: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number; // Label ist hier ein Timestamp (Zahl)
}

// SWR Fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Hilfsfunktion für Tooltip-Formatierung
const formatImpressions = (value: number) => {
  return new Intl.NumberFormat('de-DE').format(value);
};

// Tooltip-Inhalt
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const dateLabel = typeof label === 'number' ? new Date(label) : (typeof label === 'string' ? new Date(label) : new Date());
    
    return (
      <div className="bg-white p-3 shadow-md rounded border border-gray-200">
        <p className="font-bold text-gray-800">{format(dateLabel, 'd. MMMM yyyy', { locale: de })}</p>
        <p className="text-sm text-indigo-600">
          Reichweite: {formatImpressions(payload.find((p) => p.dataKey === 'impressions')?.value || 0)}
        </p>
      </div>
    );
  }
  return null;
};

// --- KORREKTUR 1: Props-Interface hinzufügen ---
interface ProjectTimelineWidgetProps {
  projectId?: string; // Optional: Für Admins, die ein bestimmtes Projekt ansehen
}

// Die Hauptkomponente
export default function ProjectTimelineWidget({ projectId }: ProjectTimelineWidgetProps) {
  
  // --- KORREKTUR 2: API-URL dynamisch bauen ---
  // Wenn eine projectId übergeben wird (Admin-Ansicht), füge sie als Query-Parameter hinzu.
  // Wenn nicht (Kunden-Ansicht), rufe die Route ohne Parameter auf.
  const apiUrl = projectId 
    ? `/api/project-timeline?projectId=${projectId}` 
    : '/api/project-timeline';
  
  const { data, error, isLoading } = useSWR<TimelineData>(
    apiUrl, // Benutze die dynamische URL
    fetcher
  );
  // --- ENDE KORREKTUR 2 ---


  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 min-h-[300px] flex items-center justify-center">
        <HourglassSplit size={30} className="animate-spin text-indigo-500" />
        <p className="ml-3 text-gray-600">Lade Projekt-Timeline...</p>
      </div>
    );
  }

  if (error || !data) {
    console.error('SWR Fehler:', error, 'Daten:', data);
    // Spezifischere Fehlermeldung, falls die API einen Fehler zurückgibt (z.B. 403)
    const apiErrorMessage = (error && typeof error === 'object' && 'message' in error) 
      ? (error as { message: string }).message 
      : 'Fehler beim Laden der Timeline-Daten.';
      
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <BarChart size={20} /> Projekt-Fortschritt
        </h2>
        <p className="text-red-600">{apiErrorMessage}</p>
      </div>
    );
  }

  const { project, progress, gscImpressionTrend } = data;
  const { counts, percentage } = progress;

  // Prüfen, ob project-Daten vorhanden sind, sonst Fallback
  const startDate = project?.startDate ? new Date(project.startDate) : new Date();
  const duration = project?.durationMonths || 6;
  const endDate = addMonths(startDate, duration);
  const today = new Date();

  // Berechne Projektfortschritt in % (Zeit)
  const totalProjectDays = differenceInCalendarDays(endDate, startDate) || 1; // Verhindere Division durch 0
  const elapsedProjectDays = differenceInCalendarDays(today, startDate);
  const timeElapsedPercentage = Math.max(0, Math.min(100, (elapsedProjectDays / totalProjectDays) * 100));

  // Daten für GSC-Chart aufbereiten
  const chartData = (gscImpressionTrend || []).map(d => ({
    date: new Date(d.date).getTime(), 
    impressions: d.value,
  }));
  
  // X-Achsen-Ticks (Start, Heute, Ende)
  const xTicks = [
    startDate.getTime(),
    today.getTime(),
    endDate.getTime()
  ];
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <BarChart size={20} /> Projekt-Fortschritt
      </h2>

      {/* --- 1. Fortschritts-Balken (Landingpages) --- */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">
            Landingpage-Freigaben
          </span>
          <span className="text-lg font-bold text-indigo-600">
            {counts.Freigegeben} / {counts.Total}
          </span>
        </div>
        
        {/* Gestapelter Fortschrittsbalken */}
        {counts.Total > 0 ? (
          <div className="flex w-full h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${(counts.Freigegeben / counts.Total) * 100}%` }}
              title={`Freigegeben: ${counts.Freigegeben}`}
            ></div>
            <div
              className="bg-yellow-500 transition-all"
              style={{ width: `${(counts['In Prüfung'] / counts.Total) * 100}%` }}
              title={`In Prüfung: ${counts['In Prüfung']}`}
            ></div>
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${(counts.Gesperrt / counts.Total) * 100}%` }}
              title={`Gesperrt: ${counts.Gesperrt}`}
            ></div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Noch keine Landingpages angelegt.</p>
        )}
        
        {/* Legende für den Balken */}
        <div className="flex justify-end space-x-4 mt-2 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500"></span> Freigegeben</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-500"></span> In Prüfung</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-200"></span> Offen</span>
        </div>
      </div>

      {/* --- 2. KPI-Übersicht --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <CheckCircle size={24} className="text-green-600 mx-auto mb-1" />
          <p className="text-xl font-bold">{Math.round(percentage)}%</p>
          <p className="text-xs text-gray-600">Freigabe-Quote</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <ClockHistory size={24} className="text-blue-600 mx-auto mb-1" />
          <p className="text-xl font-bold">{Math.round(timeElapsedPercentage)}%</p>
          <p className="text-xs text-gray-600">Zeit Verbraucht</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <CalendarCheck size={24} className="text-gray-700 mx-auto mb-1" />
          <p className="text-xl font-bold">{format(startDate, 'dd.MM.yy')}</p>
          <p className="text-xs text-gray-600">Projekt-Start</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <BoxSeam size={24} className="text-gray-700 mx-auto mb-1" />
          <p className="text-xl font-bold">{counts.Total}</p>
          <p className="text-xs text-gray-600">Landingpages gesamt</p>
        </div>
      </div>

      {/* --- 3. Graphen-Titel --- */}
      <h3 className="text-lg font-semibold mb-4 mt-8 pt-4 border-t flex items-center gap-2">
        <GraphUpArrow size={18} /> Reichweiten-Entwicklung (Impressionen)
      </h3>

      {/* --- 4. Reichweiten-Chart --- */}
      {chartData.length > 0 ? (
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                fontSize={11}
                tickFormatter={(timestamp) => format(new Date(timestamp), 'd. MMM', { locale: de })}
                domain={[startDate.getTime(), endDate.getTime()]}
                type="number"
                ticks={xTicks}
              />
              <YAxis
                yAxisId="left"
                stroke="#4f46e5"
                fontSize={11}
                tickFormatter={(value) => new Intl.NumberFormat('de-DE', { notation: 'compact' }).format(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => <span className="text-gray-700">{value}</span>}
              />
              
              {/* Reichweiten-Kurve */}
              <Area
                type="monotone"
                dataKey="impressions"
                name="Reichweite (Impressionen)"
                yAxisId="left"
                stroke="#4f46e5"
                fill="#c7d2fe"
                strokeWidth={2}
                dot={false}
              />
              
              {/* Vertikale Linie für "Heute" */}
              <ReferenceLine 
                x={today.getTime()} 
                stroke="#fb923c" 
                strokeDasharray="4 4" 
                strokeWidth={2}
              >
                <Label value="Heute" position="top" fill="#fb923c" fontSize={11} />
              </ReferenceLine>
              
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic text-center py-8">
          Es werden noch keine Reichweiten-Daten von Google empfangen.
        </p>
      )}
    </div>
  );
}
