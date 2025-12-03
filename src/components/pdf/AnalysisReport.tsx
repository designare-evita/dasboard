/* src/components/pdf/AnalysisReport.tsx */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, color: '#333' },
  header: { marginBottom: 20, borderBottom: '2px solid #10b981', paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  meta: { fontSize: 10, color: '#6b7280' },
  section: { marginBottom: 20 },
  heading: { fontSize: 14, fontWeight: 'bold', color: '#10b981', marginBottom: 8 },
  text: { lineHeight: 1.5, marginBottom: 8, textAlign: 'justify', fontSize: 11 },
  chartContainer: { marginTop: 10, marginBottom: 10, padding: 5, backgroundColor: '#f9fafb', borderRadius: 4 },
  chartImage: { width: '100%', objectFit: 'contain' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: '1px solid #e5e7eb', paddingTop: 10, textAlign: 'center', fontSize: 9, color: '#9ca3af' }
});

interface ReportProps {
  projectId: string;
  dateRange: string;
  summaryText: string;
  chartImage?: string;
}

// Hilfsfunktion um HTML-Tags grob zu entfernen, falls der AI Text HTML enthält
const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');

export const AnalysisReport = ({ projectId, dateRange, summaryText, chartImage }: ReportProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Performance Analyse</Text>
          <Text style={styles.meta}>Projekt-ID: {projectId}</Text>
        </View>
        <View>
          <Text style={styles.meta}>Zeitraum: {dateRange}</Text>
          <Text style={{ fontSize: 10, color: '#10b981', fontWeight: 'bold', marginTop: 4 }}>DATA PEAK AI</Text>
        </View>
      </View>

      {/* AI TEXT SECTION */}
      <View style={styles.section}>
        <Text style={styles.heading}>Zusammenfassung & Insights</Text>
        <Text style={styles.text}>
          {stripHtml(summaryText)}
        </Text>
      </View>

      {/* CHART SECTION */}
      {chartImage && (
        <View style={styles.section} break={false}>
          <Text style={styles.heading}>Traffic Entwicklung</Text>
          <View style={styles.chartContainer}>
             <Image src={chartImage} style={styles.chartImage} />
          </View>
          <Text style={{ fontSize: 9, color: '#666', marginTop: 4, fontStyle: 'italic' }}>
            Grafik generiert aus aktuellen Dashboard-Daten.
          </Text>
        </View>
      )}

      {/* FOOTER */}
      <Text style={styles.footer}>
        Automatisch generierter Report • {new Date().toLocaleDateString('de-DE')} • DATA PEAK Dashboard
      </Text>
    </Page>
  </Document>
);
