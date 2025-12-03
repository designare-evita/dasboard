/* src/components/pdf/AnalysisReport.tsx */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Optional: Schriftarten registrieren (damit Umlaute klappen)
// Font.register({ family: 'Roboto', src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf' });

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, color: '#333' },
  header: { marginBottom: 30, borderBottom: '2px solid #188BDB', paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  date: { fontSize: 10, color: '#6b7280', marginTop: 5 },
  section: { marginBottom: 20 },
  heading: { fontSize: 14, fontWeight: 'bold', color: '#188BDB', marginBottom: 10 },
  text: { lineHeight: 1.6, marginBottom: 8, textAlign: 'justify' },
  chartContainer: { marginTop: 20, marginBottom: 20, padding: 10, backgroundColor: '#f9fafb', borderRadius: 4 },
  chartImage: { width: '100%', objectFit: 'contain' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: '1px solid #e5e7eb', paddingTop: 10, textAlign: 'center', fontSize: 9, color: '#9ca3af' }
});

interface ReportProps {
  clientName: string;
  dateRange: string;
  summaryText: string;
  chartImage?: string; // Das Base64 Bild vom Chart
}

export const AnalysisReport = ({ clientName, dateRange, summaryText, chartImage }: ReportProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Performance Report</Text>
          <Text style={styles.date}>Zeitraum: {dateRange}</Text>
        </View>
        <View>
          {/* Dein Logo hier (muss public URL oder import sein) */}
          <Text style={{color: '#188BDB', fontWeight: 'bold'}}>DATA PEAK</Text>
        </View>
      </View>

      {/* AI ANALYSE */}
      <View style={styles.section}>
        <Text style={styles.heading}>Management Summary</Text>
        {/* HTML Tags aus Gemini entfernen wir hier simpel, idealerweise hast du bereinigten Text */}
        <Text style={styles.text}>
          {summaryText.replace(/<[^>]*>?/gm, '')} 
        </Text>
      </View>

      {/* CHART BILD */}
      {chartImage && (
        <View style={styles.section} break={false}>
          <Text style={styles.heading}>Traffic Verlauf</Text>
          <View style={styles.chartContainer}>
             <Image src={chartImage} style={styles.chartImage} />
          </View>
          <Text style={{ fontSize: 9, color: '#666', marginTop: 5 }}>
            Detaillierte Entwicklung der KPIs (Clicks, Impressions, Users)
          </Text>
        </View>
      )}

      {/* FOOTER */}
      <Text style={styles.footer}>
        Erstellt für {clientName} durch Data Max AI • {new Date().toLocaleDateString('de-DE')}
      </Text>
    </Page>
  </Document>
);
