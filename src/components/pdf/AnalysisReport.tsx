/* src/components/pdf/AnalysisReport.tsx */
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { 
    padding: 30, 
    fontFamily: 'Helvetica', 
    fontSize: 10, 
    color: '#333',
    backgroundColor: '#ffffff'
  },
  
  header: { 
    marginBottom: 20, 
    borderBottom: '3px solid #10b981', 
    paddingBottom: 12, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#111827',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2
  },
  meta: { 
    fontSize: 9, 
    color: '#6b7280',
    textAlign: 'right'
  },
  
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 8
  },
  kpiCard: {
    width: '23%',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8
  },
  kpiLabel: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2
  },
  kpiChange: {
    fontSize: 8,
    fontWeight: 'bold'
  },
  kpiChangePositive: {
    color: '#10b981'
  },
  kpiChangeNegative: {
    color: '#ef4444'
  },
  
  section: { 
    marginBottom: 20 
  },
  sectionTitle: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#10b981', 
    marginBottom: 10,
    paddingBottom: 4,
    borderBottom: '1px solid #e5e7eb'
  },
  
  text: { 
    lineHeight: 1.6, 
    marginBottom: 6, 
    textAlign: 'justify', 
    fontSize: 10,
    color: '#374151'
  },
  
  note: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: 6
  },
  noteText: {
    fontSize: 9,
    color: '#166534',
    lineHeight: 1.4
  },
  
  footer: { 
    position: 'absolute', 
    bottom: 20, 
    left: 30, 
    right: 30, 
    borderTop: '1px solid #e5e7eb', 
    paddingTop: 8, 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  footerText: {
    fontSize: 8, 
    color: '#9ca3af'
  },
  footerBrand: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#10b981'
  }
});

interface KpiData {
  label: string;
  value: string | number;
  change?: number;
  unit?: string;
}

interface ReportProps {
  projectId: string;
  dateRange: string;
  summaryText: string;
  kpis?: KpiData[];
  trendChart?: string;
  pieCharts?: {
    country?: string;
    channel?: string;
    device?: string;
  };
}

const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');

const formatChange = (change?: number) => {
  if (change === undefined || change === null) return '';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
};

export const AnalysisReport = ({ 
  projectId, 
  dateRange, 
  summaryText, 
  kpis
}: ReportProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Performance Analyse</Text>
          <Text style={styles.subtitle}>Projekt: {projectId}</Text>
        </View>
        <View>
          <Text style={styles.meta}>Zeitraum: {dateRange}</Text>
          <Text style={styles.meta}>Erstellt: {new Date().toLocaleDateString('de-DE')}</Text>
          <Text style={[styles.meta, { color: '#10b981', fontWeight: 'bold', marginTop: 4 }]}>
            DATA PEAK AI
          </Text>
        </View>
      </View>

      {/* KPI GRID */}
      {kpis && kpis.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Kennzahlen</Text>
          <View style={styles.kpiGrid}>
            {kpis.map((kpi, index) => (
              <View key={index} style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
                <Text style={styles.kpiValue}>
                  {kpi.value}{kpi.unit || ''}
                </Text>
                {kpi.change !== undefined && (
                  <Text style={[
                    styles.kpiChange,
                    kpi.change >= 0 ? styles.kpiChangePositive : styles.kpiChangeNegative
                  ]}>
                    {formatChange(kpi.change)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* AI ANALYSE TEXT */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>KI-Analyse & Insights</Text>
        <Text style={styles.text}>
          {stripHtml(summaryText)}
        </Text>
      </View>

      {/* HINWEIS */}
      <View style={styles.note}>
        <Text style={styles.noteText}>
          💡 Hinweis: Für vollständige Visualisierungen (Charts & Grafiken) besuchen Sie bitte das Dashboard unter https://dashboard.datapeak.at
        </Text>
      </View>

      {/* FOOTER */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>
          Automatisch generierter Report
        </Text>
        <Text style={styles.footerBrand}>DATA PEAK Dashboard</Text>
      </View>
    </Page>
  </Document>
);
