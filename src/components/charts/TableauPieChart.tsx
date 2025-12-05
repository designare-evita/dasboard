// src/components/charts/TableauPieChart.tsx
'use client';

import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { PieChart as PieChartIcon, ExclamationTriangleFill } from 'react-bootstrap-icons';
import { ChartEntry } from '@/lib/dashboard-shared';
import { format, subDays, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

interface TableauPieChartProps {
  data?: ChartEntry[];
  title: string;
  isLoading?: boolean;
  error?: string | null;
  dateRange?: string; 
}

export default function TableauPieChart({
  data,
  title,
  isLoading = false,
  error,
  dateRange = '30d'
}: TableauPieChartProps) {

  // Datumsberechnung
  const formattedDateRange = useMemo(() => {
    const end = new Date();
    let start = subDays(end, 30); // Default

    switch (dateRange) {
      case '7d': start = subDays(end, 7); break;
      case '30d': start = subDays(end, 30); break;
      case '3m': start = subMonths(end, 3); break;
      case '6m': start = subMonths(end, 6); break;
      case '12m': start = subMonths(end, 12); break;
      default: start = subDays(end, 30);
    }
    return `${format(start, 'dd.MM.yyyy', { locale: de })} - ${format(end, 'dd.MM.yyyy', { locale: de })}`;
  }, [dateRange]);

  // Farben-Palette
  const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (isLoading) {
    return (
      <div className="card-glass p-6 flex flex-col h-full min-h-[300px]">
        <div className="animate-pulse space-y-4 w-full h-full flex flex-col">
          <div className="h-6 bg-gray-200/50 rounded w-1/3"></div>
          <div className="h-4 bg-gray-100/50 rounded w-1/4"></div>
          <div className="flex-1 bg-gray-100/30 rounded-full w-48 h-48 mx-auto mt-4"></div>
        </div>
      </div>
    );
  }

  // Daten filtern (keine 0-Werte)
  const validData = data?.filter(d => d.value > 0) || [];
  const hasData = validData.length > 0;

  return (
    <div className="card-glass p-6 flex flex-col h-full min-h-[350px]">
      
      {/* Header Bereich */}
      <div className="mb-6 border-b border-gray-50/50 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <PieChartIcon className="text-indigo-500" size={18} />
            {title}
          </h3>
        </div>
        
        {/* Untertitel mit Quelle und Datum */}
        <div className="text-[11px] text-gray-500 mt-1 ml-7 flex items-center gap-2">
          <span className="font-medium bg-gray-100/80 px-1.5 py-0.5 rounded text-gray-600">Quelle: GA4</span>
          <span className="text-gray-300">•</span>
          <span>{formattedDateRange}</span>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[200px] relative">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
            <ExclamationTriangleFill className="text-red-400 mb-2" size={24} />
            <p className="text-sm text-red-500 font-medium">Daten konnten nicht geladen werden</p>
          </div>
        ) : !hasData ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm italic">
            Keine Daten verfügbar
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                // ✅ FIX: 'as any' behebt den TypeScript Fehler mit der fehlenden Index Signature
                data={validData as any}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {validData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    className="hover:opacity-80 transition-opacity duration-300 cursor-pointer"
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  backdropFilter: 'blur(4px)',
                  border: '1px solid #f3f4f6',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  fontSize: '12px',
                  color: '#374151'
                }}
                itemStyle={{ color: '#374151', fontWeight: 500 }}
                formatter={(value: number) => value.toLocaleString('de-DE')}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ 
                  fontSize: '12px', 
                  color: '#6b7280',
                  paddingTop: '20px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
