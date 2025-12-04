/* src/components/pdf/AnalysisReport.tsx */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// ✅ STABILE FONTS (Fix für "Unknown font format")
Font.register({
  family: 'Poppins',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-400-normal.ttf', fontWeight: 400 }, 
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-700-normal.ttf', fontWeight: 700 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-400-italic.ttf', fontStyle: 'italic' }
  ]
});

const PRIMARY_COLOR = '#188BDB'; 
const ACCENT_BG = '#e0f2fe';     

const styles = StyleSheet.create({
  page: { 
    padding: 40, 
    fontFamily: 'Poppins',
    fontSize: 10, 
    color: '#333',
    backgroundColor: '#ffffff'
  },
  header: { 
    marginBottom: 25, 
    borderBottom: `2px solid ${PRIMARY_COLOR}`, 
    paddingBottom: 15, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#111827',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 'bold' // Domain etwas hervorheben
  },
  metaContainer: {
    alignItems: 'flex-end'
  },
  meta: { 
    fontSize: 9, 
    color: '#6b7280',
    marginBottom: 2
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 25,
    gap: 10
  },
  kpiCard: {
    width: '23%',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 12
  },
  kpiLabel: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    fontWeight: 'bold'
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4
  },
  kpiChange: {
    fontSize: 9,
    fontWeight: 'bold'
  },
  kpiChangePositive: { color: '#16a34a' },
  kpiChangeNegative: { color: '#dc2626' },
  section: { 
    marginBottom: 20 
  },
  sectionTitle: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: PRIMARY_COLOR, 
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: '1px solid #f1f5f9'
  },
  text: { 
    lineHeight: 1.6, 
    marginBottom: 8, 
    textAlign: 'justify', 
    fontSize: 10,
    color: '#334155'
  },
  note: {
    marginTop: 10,
    padding: 15,
    backgroundColor: ACCENT_BG,
    borderLeft: `3px solid ${PRIMARY_COLOR}`,
    borderRadius: 4
  },
  noteText: {
    fontSize: 9,
    color: '#0c4a6e',
    fontStyle: 'italic'
  },
  footer: { 
    position: 'absolute', 
    bottom: 30, 
    left: 40, 
    right: 40, 
    borderTop: '1px solid #e2e8f0', 
    paddingTop: 10, 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  footerText: { fontSize: 8, color: '#94a3b8' },
  footerBrand: { fontSize: 9, fontWeight: 'bold', color: PRIMARY_COLOR }
});

interface KpiData {
  label: string;
  value: string | number;
  change?: number;
  unit?: string;
}

interface ReportProps {
  projectId: string;
  domain?: string;
  dateRange: string;
  summaryText: string;
  kpis?: KpiData[];
}

// 🛠 HELPER: Textaufbereitung & Erkennung von Überschriften für Fettdruck
const formatAiTextWithBold = (html: string) => {
  if (!html) return [];
  
  let text = html;
  
  // 1. Markiere Überschriften (h4 etc.) für Fettdruck
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '__BOLD__$1__BOLD__\n');
  
  // 2. Ersetze Block-Elemente durch Umbrüche
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  
  // 3. Entferne restliche Tags
  text = text.replace(/<[^>]*>?/gm, '');
  
  // 4. HTML Entities
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

  // 5. Splitte Text in normale und fette Teile
  const parts = text.split('__BOLD__');
  
  return parts.map((part, index) => ({
    text: part,
    isBold: index % 2 === 1 // Ungerade Teile waren zwischen __BOLD__ Tags
  }));
};

const formatChange = (change?: number) => {
  if (change === undefined || change === null) return '';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
};

export const AnalysisReport = ({ 
  projectId,
  domain, 
  dateRange, 
  summaryText, 
  kpis
}: ReportProps) => {
  
  // Bereite den Text auf (mit Fettdruck-Logik)
  const textParts = formatAiTextWithBold(summaryText);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* HEADER: Domain anzeigen (Fallback auf ID) */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Performance Report</Text>
            <Text style={styles.subtitle}>{domain || projectId}</Text>
          </View>
          <View style={styles.metaContainer}>
            <Text style={styles.meta}>Zeitraum: {dateRange}</Text>
            <Text style={styles.meta}>Datum: {new Date().toLocaleDateString('de-DE')}</Text>
            <Text style={[styles.meta, { color: PRIMARY_COLOR, fontWeight: 'bold', marginTop: 4 }]}>
              DATA PEAK AI
            </Text>
          </View>
        </View>

        {/* KPI GRID */}
        {kpis && kpis.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kennzahlen Übersicht</Text>
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
                      {formatChange(kpi.change)} vs. Vormonat
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* KI ANALYSE TEXT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>KI-Analyse</Text>
          <Text style={styles.text}>
            {textParts.map((part, i) => (
              <Text key={i} style={part.isBold ? { fontWeight: 700, color: '#111827' } : {}}>
                {part.text}
              </Text>
            ))}
          </Text>
        </View>

        {/* HINWEIS */}
        <View style={styles.note}>
          <Text style={styles.noteText}>
            Hinweis: Dieser Bericht ist eine Zusammenfassung. Detaillierte interaktive Charts finden Sie im Dashboard unter https://dashboard.datapeak.at
          </Text>
        </View>

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Automatisch generiert durch Data Max AI
          </Text>
          <Text style={styles.footerBrand}>DATA PEAK</Text>
        </View>
      </Page>
    </Document>
  );
};
