/* src/components/AiAnalysisWidget.tsx */
'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Lightbulb, ArrowRepeat, ExclamationTriangle, InfoCircle, GraphUpArrow } from 'react-bootstrap-icons';
import { getRangeLabel, DateRangeOption } from '@/components/DateRangeSelector';
import ExportButton from '@/components/ExportButton'; // <--- NEU 1/3

interface Props {
  projectId: string;
  dateRange: string;
  chartRef?: React.RefObject<HTMLDivElement>; // <--- NEU 2/3
}

export default function AiAnalysisWidget({ projectId, dateRange, chartRef }: Props) {
  // Content States
  const [statusContent, setStatusContent] = useState('');
  const [analysisContent, setAnalysisContent] = useState('');
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamComplete, setIsStreamComplete] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPrefetched, setIsPrefetched] = useState(false);
  
  // Dynamischer Teaser Text
  const [teaserText, setTeaserText] = useState('');

  // Ref für AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helfer: Zufälligen "Anfütter"-Text generieren
  const generateTeaser = (range: string) => {
    const teasers = [
      `Der Datensatz für ${range} ist vollständig importiert und wartet auf Sie. Soll ich die Auswertung jetzt starten?`,
      `Wollen wir herausfinden, welche Themengebiete nicht nur Besucher anlocken, sondern sie auch zu Kunden machen?`,
      `Die Zahlen für ${range} sind bereit zur Verknüpfung. Sollen wir die Analyse beginnen, um Ursache und Wirkung zu verstehen?`,
      `Die Performance-Daten für ${range} halten neue Insights bereit. Wollen Sie wissen, welche Maßnahmen am besten gegriffen haben?`,
      `Soll ich prüfen, bei welchen Suchanfragen die Besucher am längsten auf Ihrer Seite verweilen und wirklich lesen?`,
      `Die Daten liegen vor. Soll ich identifizieren, welche Landingpages das Interesse der Google-Nutzer am besten in Handlungen verwandeln?`
    ];
    return teasers[Math.floor(Math.random() * teasers.length)];
  };

  const rangeLabel = getRangeLabel(dateRange as DateRangeOption).toLowerCase();

  // --- PRE-FETCHING & RESET LOGIK ---
  useEffect(() => {
    setStatusContent('');
    setAnalysisContent('');
    setError(null);
    setIsStreamComplete(false);
    setIsPrefetched(false);
    setTeaserText('');

    const prefetchData = async () => {
      if (!projectId) return;
      
      console.log(`[AI Widget] 🚀 Starte Pre-Fetching für Zeitraum: ${dateRange}`);
      try {
        await fetch(`/api/projects/${projectId}?dateRange=${dateRange}`, {
          priority: 'low'
        });
        
        setIsPrefetched(true);
        setTeaserText(generateTeaser(rangeLabel));
        
        console.log('[AI Widget] ✅ Pre-Fetching abgeschlossen.');
      } catch (e) {
        console.warn('[AI Widget] Pre-Fetching fehlgeschlagen (nicht kritisch):', e);
      }
    };

    prefetchData();
  }, [projectId, dateRange, rangeLabel]);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setIsStreamComplete(false);
    setError(null);
    setStatusContent('');
    setAnalysisContent('');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, dateRange }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error('Verbindung fehlgeschlagen');
      if (!response.body) throw new Error('Kein Stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 50;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        const now = Date.now();
        if (now - lastUpdateTime > UPDATE_INTERVAL) {
          parseAndSetContent(fullText);
          lastUpdateTime = now;
        }
      }
      
      parseAndSetContent(fullText);
      setIsStreamComplete(true);

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const parseAndSetContent = (text: string) => {
    const marker = '[[SPLIT]]';
    if (text.includes(marker)) {
      const [part1, part2] = text.split(marker);
      setStatusContent(part1);
      setAnalysisContent(part2);
    } else {
      setStatusContent(text);
    }
