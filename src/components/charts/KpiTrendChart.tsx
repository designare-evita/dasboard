// src/components/charts/KpiTrendChart.tsx
'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import React from 'react';

// Definiert, wie die Daten für das Diagramm strukturiert sein müssen
interface ChartData {
  date: string;
  value: number;
}

interface KpiTrendChartProps {
  data: ChartData[];
  color: string; // z.B. '#8884d8'
  label: string; // z.B. 'Klicks', 'Impressionen', 'Sitzungen', 'Nutzer'
}

const KpiTrendChart: React.FC<KpiTrendChartProps> = ({ data, color, label }) => {
  // Formatiert das Datum auf der X-Achse (z.B. "01.10.")
  const formatDate = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  // Formatiert Zahlen im deutschen Format mit Tausendertrennzeichen
  const formatNumber = (value: number) => {
    return value.toLocaleString('de-DE');
  };

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDate} 
            fontSize={12} 
            tick={{ fill: '#6b7280' }} 
            axisLine={{ stroke: '#d1d5db' }} 
            tickLine={{ stroke: '#d1d5db' }}
          />
          <YAxis 
            fontSize={12} 
            tick={{ fill: '#6b7280' }} 
            axisLine={{ stroke: '#d1d5db' }} 
            tickLine={{ stroke: '#d1d5db' }}
            tickFormatter={formatNumber}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
            labelFormatter={formatDate}
            formatter={(value: number) => [formatNumber(value), label]}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default KpiTrendChart;
