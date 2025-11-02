// src/components/SemrushTopKeywords02.tsx (Wrapper für Kampagne 2)
'use client';

import React from 'react';
// Importieren der Basis-Komponente und des Theme-Typs
import SemrushKeywordTableBase, { type SemrushTheme } from './SemrushKeywordTableBase';

// Definition des Farbschemas für Kampagne 2 (USA)
const themeKampagne2: SemrushTheme = {
  headerGradient: "from-purple-600 to-purple-500",
  headerText: "text-purple-100",
  headerTextMuted: "text-purple-50 opacity-75",
  tableHeaderBg: "bg-purple-600",
  tableHeaderBorder: "border-purple-500",
  tableHeaderHover: "hover:bg-purple-700",
  tableRowHover: "hover:bg-purple-50",
};

interface SemrushTopKeywords02Props {
  projectId?: string | null;
}

export default function SemrushTopKeywords02({ projectId }: SemrushTopKeywords02Props) {
  return (
    <SemrushKeywordTableBase
      projectId={projectId}
      campaign="kampagne_2"
      title="Top 20 Keywords - USA"
      logContext="SemrushTopKeywords02"
      errorContext="Kampagne 2"
      keyPrefix="kampagne-2"
      theme={themeKampagne2}
      debugInfo={{
        title: "Debug (Kampagne 2)",
        classes: "bg-indigo-50 border-indigo-200"
      }}
    />
  );
}
