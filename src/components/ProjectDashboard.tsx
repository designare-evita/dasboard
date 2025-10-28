// src/components/ProjectDashboard.tsx (Debug-Version)
'use client';

import { useState, useEffect } from 'react';
import { 
  ProjectDashboardData, 
  ActiveKpi, 
  KPI_TAB_META, 
  normalizeFlatKpis 
} from '@/lib/dashboard-shared';
import KpiCardsGrid from '@/components/KpiCardsGrid';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import AiTrafficCard from '@/components/AiTrafficCard';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import TopQueriesList from '@/components/TopQueriesList';
import SemrushKpiCards, { SemrushData } from '@/components/SemrushKpiCards';
import SemrushKeywordTable from '@/components/SemrushKeywordTable';
import SemrushConfigDisplay from '@/components/SemrushConfigDisplay';
import { Download } from 'react-bootstrap-icons';

interface ProjectDashboardProps {
  data: ProjectDashboardData;
  semrushData: SemrushData | null;
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  showNoDataHint?: boolean;
  noDataHintText?: string;
  projectId?: string;
  domain?: string;
}

export default function ProjectDashboard({
  data,
  semrushData,
  isLoading,
  dateRange,
  onDateRangeChange,
  showNoDataHint = false,
  noDataHintText = "Für dieses Projekt wurden noch keine KPI-Daten geliefert.",
  projectId,
  domain
}: ProjectDashboardProps) {
  
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // PDF Export Handler
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    
    try {
      // Dynamically import html2pdf
      const html2pdf = (await import('html2pdf.js')).default;
      
      const element = document.getElementById('dashboard-content');
      
      if (!element) {
        throw new Error('Dashboard content not found');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opt: any = {
        margin: [10, 10, 10, 10],
        filename: `dashboard-${domain || 'report'}-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { 
          type: 'jpeg',
          quality: 0.98 
        },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: false
        },
        jsPDF: { 
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        }
      };

      await html2pdf().set(opt).from(element).save();
      
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Fehler beim Erstellen des PDFs. Bitte versuchen Sie es erneut.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // DEBUG: Log bei jedem Render
  useEffect(() => {
    console.log('[ProjectDashboard] Rendered with projectId:', projectId);
    console.log('[ProjectDashboard] Domain:', domain);
  }, [projectId, domain]);

  const kpis = normalizeFlatKpis(data.kpis);

  type DataWithCharts = ProjectDashboardData & { 
    charts?: Record<ActiveKpi, Array<{ date: string; value: number }>> 
  };
  const chartSeries = (data as DataWithCharts).charts?.[activeKpi] || [];
  
  const kpiLabels: Record<string, string> = {
    clicks: 'Klicks',
    impressions: 'Impressionen',
    sessions: 'Sitzungen (GA4)',
    totalUsers: 'Nutzer (GA4)',
  };

  return (
    <div className="space-y-8">
      {/* Dashboard Header mit Domain und PDF-Export */}
      {domain && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Dashboard: {domain}
              </h1>
              <p className="text-sm text-gray-500">
                Zeitraum: {dateRange === '7d' ? 'Letzte 7 Tage' : 
                          dateRange === '30d' ? 'Letzte 30 Tage' : 
                          dateRange === '90d' ? 'Letzte 90 Tage' : 'Letztes Jahr'}
              </p>
            </div>
            
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExportingPdf ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Erstelle PDF...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>Als PDF exportieren</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Wrapper für PDF-Export */}
      <div id="dashboard-content">
        
      {/* DEBUG INFO - NUR IN DEVELOPMENT */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-8">
          <h3 className="font-bold text-yellow-900 mb-2">🔍 DEBUG INFO (nur in Development sichtbar)</h3>
          <div className="text-sm space-y-1">
            <div><strong>Current ProjectId:</strong> {projectId || 'NICHT GESETZT!'}</div>
            <div><strong>Domain:</strong> {domain || 'NICHT GESETZT!'}</div>
            <div><strong>Semrush Data:</strong> {semrushData ? 'Vorhanden' : 'Null'}</div>
            <div><strong>Keywords werden geladen für ProjectId:</strong> {projectId || 'FEHLT!'}</div>
          </div>
        </div>
      )}

      {/* 1. BLOCK: Google KPI-Karten */}
      <div>
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
          <h2 className="text-xl font-semibold text-gray-700">
            Google Übersicht (Search Console & GA4)
          </h2>
          <DateRangeSelector
            value={dateRange}
            onChange={onDateRangeChange}
          />
        </div>
        <KpiCardsGrid kpis={kpis} isLoading={isLoading} />
      </div>

      {/* 2. BLOCK: Google KPI-Chart */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-0">
            Performance-Trend
          </h3>
          <div className="flex-shrink-0 flex flex-wrap gap-2">
            {(Object.keys(KPI_TAB_META) as ActiveKpi[]).map((kpi) => (
              <button
                key={kpi}
                onClick={() => setActiveKpi(kpi)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  activeKpi === kpi
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {KPI_TAB_META[kpi].title}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 h-72">
          <KpiTrendChart 
            data={chartSeries} 
            color={KPI_TAB_META[activeKpi].color}
            label={kpiLabels[activeKpi] || KPI_TAB_META[activeKpi].title}
          />
        </div>

        {showNoDataHint && (
          <p className="mt-6 text-sm text-gray-500">
            {noDataHintText}
          </p>
        )}
      </div>

      {/* 3. BLOCK: KI-Traffic + Top Queries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {data.aiTraffic && (
          <div className="lg:col-span-1">
            <AiTrafficCard
              totalSessions={data.aiTraffic.totalSessions}
              totalUsers={data.aiTraffic.totalUsers}
              percentage={kpis.sessions.aiTraffic?.percentage || 0}
              topSources={data.aiTraffic.topAiSources}
              isLoading={isLoading}
              dateRange={dateRange}
            />
          </div>
        )}
          
        {data.topQueries && data.topQueries.length > 0 && (
          <div className={`${data.aiTraffic ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <TopQueriesList 
              queries={data.topQueries} 
              isLoading={isLoading} 
            />
          </div>
        )}
      </div>

      {/* 4. BLOCK: Semrush Übersicht */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Semrush KPI-Karten */}
        <div>
          <SemrushKpiCards 
            data={semrushData} 
            isLoading={isLoading} 
          />
        </div>

        {/* Semrush Konfiguration */}
        <div className="lg:col-span-2">
          <SemrushConfigDisplay projectId={projectId} />
        </div>
      </div>

      {/* 5. BLOCK: Keyword Rankings Tabelle (volle Breite) */}
      <div>
        <SemrushKeywordTable 
          key={projectId} 
          projectId={projectId} 
        />
      </div>

      </div> {/* Ende dashboard-content */}
    </div>
  );
}
