// src/components/kpi-card.tsx
import React from 'react';
// +++ NEU: ExclamationTriangleFill importiert +++
import { ArrowUp, ArrowDown, ExclamationTriangleFill } from 'react-bootstrap-icons';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ChartPoint } from '@/types/dashboard'; 

interface KpiCardProps {
  title: string;
  value: number;
  change?: number; 
  isLoading?: boolean;
  data?: ChartPoint[];
  color?: string;
  error?: string | null; // +++ NEU: Prop für Fehlermeldungen +++
}

export default function KpiCard({ 
  title, 
  value, 
  change, 
  isLoading = false, 
  data,
  color = '#3b82f6',
  error = null // +++ NEU: Prop entgegennehmen +++
}: KpiCardProps) {
  
  const isPositive = change !== undefined && change >= 0;

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
          {change !== undefined && <div className="h-3 bg-gray-200 rounded w-1/3"></div>}
          {data !== undefined && <div className="h-[60px] bg-gray-200 rounded mt-4"></div>}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>

      {/* +++ START: MODIFIZIERTE RENDER-LOGIK +++ */}
      {error ? (
        // Wenn ein Fehler vorhanden ist, zeige die Fehlermeldung
        <div className="mt-2" style={{ minHeight: '60px' }}> {/* Höhe beibehalten für Layout-Konsistenz */}
          <ExclamationTriangleFill className="text-red-500 w-5 h-5 mb-2" />
          <p className="text-xs text-red-700 font-semibold">Fehler bei der Datenquelle</p>
          <p className="text-xs text-gray-500 mt-1" title={error}>
            Verbindung fehlgeschlagen. Bitte kontaktieren Sie Ihren Ansprechpartner.
          </p>
        </div>
      ) : (
        // Andernfalls zeige die normalen KPI-Daten
        <>
          <p className="text-3xl font-bold text-gray-900 mb-2">
            {value.toLocaleString('de-DE')}
          </p>
          
          {change !== undefined && (
            <div className={`flex items-center text-sm font-medium ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {isPositive ? (
                <ArrowUp className="mr-1" size={16} />
              ) : (
                <ArrowDown className="mr-1" size={16} />
              )}
              <span>{Math.abs(change).toFixed(1)}%</span>
            </div>
          )}

          {/* Sparkline Chart Bereich */}
          {data && data.length > 0 && (
            <div className="mt-4 h-[60px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={data}
                  margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={`gradient-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={color} stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#gradient-${title.replace(/\s+/g, '-')})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
      {/* +++ ENDE: MODIFIZIERTE RENDER-LOGIK +++ */}
    </div>
  );
}
