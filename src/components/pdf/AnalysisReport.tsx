/* src/components/pdf/AnalysisReport.tsx */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { 
    padding: 30, 
    fontFamily: 'Helvetica', 
    fontSize: 10, 
    color: '#333',
    backgroundColor: '#ffffff'
  },
  
  // Header
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
  
  // KPI Grid
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
  
  // Sections
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
  
  // Text
  text: { 
    lineHeight: 1.6, 
    marginBottom: 6, 
    textAlign: 'justify', 
    fontSize: 10,
    color: '#374151'
  },
  
  // Chart Container
  chartContainer: { 
    marginTop: 10, 
    marginBottom: 15, 
    padding: 8, 
    backgroundColor: '#f9fafb', 
    borderRadius: 6,
    border: '1px solid #e5e7eb'
  },
  chartImage: { 
    width: '100%', 
    objectFit: 'contain',
    maxHeight: 250
  },
  chartCaption: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 6,
    fontStyle: 'italic',
    textAlign: 'center'
  },
  
  // Grid Layout für kleine Charts
  chartGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20
  },
  chartGridItem: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 8,
    border: '1px solid #e5e7eb'
  },
  smallChartImage: {
    width: '100%',
    height: 150,
    objectFit: 'contain'
  },
  
  // Footer
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
  },
  
  // Page Break Helper
  pageBreak: {
    marginTop: 20
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
  
  // Charts
  trendChart?: string;
  pieCharts?: {
    country?: string;
    channel?: string;
    device?: string;
  };
  
  // KPIs
  kpis?: KpiData[];
}

// Hilfsfunktion um HTML-Tags zu entfernen
const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');

// Hilfsfunktion für Change-Formatierung
const formatChange = (change?: number) => {
  if (change === undefined || change === null) return '';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
};

export const AnalysisReport = ({ 
  projectId, 
  dateRange, 
  summaryText, 
  trendChart,
  pieCharts,
  kpis
}: ReportProps) => (
  <Document>
    {/* PAGE 1: Header, KPIs, AI Summary */}
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

      {/* FOOTER */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>
          Seite 1 • Automatisch generierter Report
        </Text>
        <Text style={styles.footerBrand}>DATA PEAK Dashboard</Text>
      </View>
    </Page>

    {/* PAGE 2: Charts */}
    <Page size="A4" style={styles.page}>
      
      {/* TREND CHART */}
      {trendChart && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Traffic-Entwicklung</Text>
          <View style={styles.chartContainer}>
            <Image src={trendChart} style={styles.chartImage} />
          </View>
          <Text style={styles.chartCaption}>
            Zeitlicher Verlauf der wichtigsten KPIs im ausgewählten Zeitraum
          </Text>
        </View>
      )}

      {/* PIE CHARTS GRID */}
      {pieCharts && Object.values(pieCharts).some(chart => chart) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Traffic-Verteilung</Text>
          <View style={styles.chartGrid}>
            {pieCharts.channel && (
              <View style={styles.chartGridItem}>
                <Image src={pieCharts.channel} style={styles.smallChartImage} />
                <Text style={styles.chartCaption}>Channel</Text>
              </View>
            )}
            {pieCharts.country && (
              <View style={styles.chartGridItem}>
                <Image src={pieCharts.country} style={styles.smallChartImage} />
                <Text style={styles.chartCaption}>Land</Text>
              </View>
            )}
          </View>
          {pieCharts.device && (
            <View style={styles.chartContainer}>
              <Image src={pieCharts.device} style={styles.smallChartImage} />
              <Text style={styles.chartCaption}>Endgerät</Text>
            </View>
          )}
        </View>
      )}

      {/* FOOTER */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>
          Seite 2 • Automatisch generierter Report
        </Text>
        <Text style={styles.footerBrand}>DATA PEAK Dashboard</Text>
      </View>
    </Page>
  </Document>
);
