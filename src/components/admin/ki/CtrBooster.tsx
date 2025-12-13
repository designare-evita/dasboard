// src/components/admin/ki/CtrBooster.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  RocketTakeoff, 
  ArrowRight, 
  Copy, 
  Check, 
  GraphUpArrow, 
  Eye, 
  Percent 
} from 'react-bootstrap-icons';
import { toast } from 'sonner';

// --- Typen ---
interface CtrBoosterProps {
  projectId?: string; // ✅ KORREKTUR: Optional gemacht
}

interface KeywordData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // Erwartet 0.05 für 5%
  position: number;
  url?: string; // ✅ NEU: URL Feld hinzugefügt
}

interface AiSuggestion {
  title: string;
  description: string;
  approach: string;
}

interface OptimizationResult {
  suggestions: AiSuggestion[];
}

export default function CtrBooster({ projectId }: CtrBoosterProps) {
  // State
  const [loading, setLoading] = useState(false); // ✅ KORREKTUR: Startet mit false wenn kein projectId
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [domain, setDomain] = useState<string>('');
  
  // Maps für Status einzelner Zeilen
  const [optimizingId, setOptimizingId] = useState<string | null>(null); // Welches KW lädt gerade?
  const [results, setResults] = useState<Record<string, AiSuggestion[]>>({}); // Ergebnisse pro Keyword
  const [expandedRows, setExpandedRows] = useState<string[]>([]); // Welche Zeilen sind offen?

  // 1. DATEN LADEN
  useEffect(() => {
    async function loadData() {
      if (!projectId) return; // ✅ KORREKTUR: Früher Abbruch wenn keine projectId
      
      setLoading(true);
      try {
        // A) Projektdaten für Domain holen
        const projectRes = await fetch('/api/projects');
        if (projectRes.ok) {
           const projectData = await projectRes.json();
           const currentProject = projectData.projects?.find((p: any) => p.id === projectId);
           if (currentProject) setDomain(currentProject.domain);
        }

        // B) GSC Daten holen
        const dataRes = await fetch(`/api/data?projectId=${projectId}&dateRange=30d`);
        if (!dataRes.ok) throw new Error('Konnte Dashboard-Daten nicht laden');
        
        const data = await dataRes.json();

        if (data.topQueries && Array.isArray(data.topQueries)) {
          const allQueries: KeywordData[] = data.topQueries;

          // 2. LOW HANGING FRUIT LOGIK
          // Filter: Position Top 20 (< 20.5) UND CTR < 3% (< 0.03)
          // Sortierung: Nach Impressionen (höchster Traffic-Hebel)
          const lowHangingFruits = allQueries
            .filter(q => q.position <= 20.5 && q.ctr < 0.03) 
            .sort((a, b) => b.impressions - a.impressions)
            .slice(0, 15); // Wir nehmen die Top 15 Chancen

          setKeywords(lowHangingFruits);
        }

      } catch (error) {
        console.error(error);
        toast.error('Fehler beim Laden der Analysedaten.');
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      loadData();
      setResults({}); // Reset results on project change
      setExpandedRows([]);
    }
  }, [projectId]);

  // --- ACTIONS ---

  const handleOptimize = async (keywordData: KeywordData) => {
    if (!domain) {
      toast.error('Keine Domain für dieses Projekt gefunden.');
      return;
    }

    setOptimizingId(keywordData.query);

    try {
      const response = await fetch('/api/ai/optimize-ctr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keywordData.query,
          currentCtr: (keywordData.ctr * 100).toFixed(2) + '%',
          currentPosition: keywordData.position,
          domain: domain,
          // Optional: URL mitgeben für besseren Kontext (falls die KI die Seite crawlen könnte)
          url: keywordData.url 
        }),
      });

      if (!response.ok) throw new Error('KI-Anfrage fehlgeschlagen');

      const data: OptimizationResult = await response.json();
      
      // Ergebnis speichern
      setResults(prev => ({
        ...prev,
        [keywordData.query]: data.suggestions
      }));

      // Zeile automatisch öffnen
      if (!expandedRows.includes(keywordData.query)) {
        setExpandedRows(prev => [...prev, keywordData.query]);
      }

      toast.success('Optimierungsvorschläge generiert!');

    } catch (error) {
      console.error(error);
      toast.error('Fehler bei der Optimierung.');
    } finally {
      setOptimizingId(null);
    }
  };

  const toggleRow = (query: string) => {
    setExpandedRows(prev => 
      prev.includes(query) ? prev.filter(k => k !== query) : [...prev, query]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('In die Zwischenablage kopiert');
  };

  // --- RENDER ---

  // ✅ KORREKTUR: Zeige Hinweis wenn keine projectId
  if (!projectId) {
    return (
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
        <RocketTakeoff size={32} className="mx-auto mb-4 text-gray-300" />
        <p className="font-medium">Kein Projekt ausgewählt</p>
        <p className="text-sm mt-2 opacity-70">Bitte wählen Sie ein Projekt aus, um den CTR Booster zu nutzen.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-gray-400 animate-pulse">
        <RocketTakeoff size={32} className="mb-4 text-indigo-200" />
        <p>Suche nach ungenutztem Potenzial...</p>
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
        <p>🚀 Keine "Low Hanging Fruits" gefunden.</p>
        <p className="text-sm mt-2 opacity-70">Entweder rankt die Seite noch nicht gut genug (Top 20), oder Ihre CTR ist bereits exzellent (&gt;3%).</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
        <div>
          <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            <RocketTakeoff className="text-indigo-600" />
            CTR Booster
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Diese Keywords ranken gut (Top 20), werden aber selten geklickt. Optimieren Sie Title & Description!
          </p>
        </div>
        <span className="text-xs font-medium px-3 py-1 bg-white border border-indigo-100 text-indigo-600 rounded-full shadow-sm">
          {keywords.length} Chancen erkannt
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
            <tr>
              <th className="px-6 py-3 w-1/3">Keyword & URL</th> {/* Header angepasst */}
              <th className="px-6 py-3 text-center">Position</th>
              <th className="px-6 py-3 text-center">CTR (Aktuell)</th>
              <th className="px-6 py-3 text-center">Impressionen</th>
              <th className="px-6 py-3 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {keywords.map((kw) => {
              const isOptimizing = optimizingId === kw.query;
              const hasResult = !!results[kw.query];
              const isExpanded = expandedRows.includes(kw.query);

              return (
                <React.Fragment key={kw.query}>
                  {/* HAUPTZEILE */}
                  <tr className={`hover:bg-gray-50/80 transition-colors ${isExpanded ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-6 py-4">
                       {/* ✅ NEU: Keyword + URL Anzeige */}
                      <div className="font-medium text-gray-800">
                        {kw.query}
                      </div>
                      {kw.url && (
                        <div className="text-[11px] text-gray-400 mt-1 truncate max-w-[300px]" title={kw.url}>
                          {kw.url}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-600">
                      {kw.position.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 border border-red-100 font-bold text-xs">
                        {(kw.ctr * 100).toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-600">
                      {kw.impressions.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {hasResult ? (
                        <button 
                          onClick={() => toggleRow(kw.query)}
                          className="text-indigo-600 font-medium hover:underline text-xs flex items-center justify-end gap-1 ml-auto"
                        >
                          {isExpanded ? 'Schließen' : 'Ergebnisse ansehen'}
                          <ArrowRight className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} size={12}/>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOptimize(kw)}
                          disabled={isOptimizing}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-auto"
                        >
                          {isOptimizing ? (
                             <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                             <RocketTakeoff size={12} />
                          )}
                          Optimieren
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* ERGEBNIS BEREICH (EXPANDABLE) */}
                  {isExpanded && hasResult && (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 bg-indigo-50/30 border-b border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {results[kw.query].map((suggestion, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
                                  {suggestion.approach}
                                </span>
                                <div className="text-gray-300 text-xs">#{idx + 1}</div>
                              </div>
                              
                              {/* Meta Title */}
                              <div className="mb-3">
                                <div className="text-xs text-gray-400 mb-1 flex justify-between">
                                  <span>Meta Title ({suggestion.title.length})</span>
                                  <button onClick={() => copyToClipboard(suggestion.title)} title="Title kopieren" className="hover:text-indigo-600">
                                    <Copy size={12}/>
                                  </button>
                                </div>
                                <p className="text-sm font-semibold text-gray-800 leading-snug border-l-2 border-indigo-500 pl-2">
                                  {suggestion.title}
                                </p>
                              </div>

                              {/* Meta Description */}
                              <div>
                                <div className="text-xs text-gray-400 mb-1 flex justify-between">
                                  <span>Description ({suggestion.description.length})</span>
                                  <button onClick={() => copyToClipboard(suggestion.description)} title="Description kopieren" className="hover:text-indigo-600">
                                    <Copy size={12}/>
                                  </button>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed border-l-2 border-gray-300 pl-2">
                                  {suggestion.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
