// src/components/SemrushTopKeywords.tsx (Wrapper für Kampagne 1)
'use client';

import React from 'react';
// Importieren der Basis-Komponente und des Theme-Typs
import SemrushKeywordTableBase, { type SemrushTheme } from './SemrushKeywordTableBase';

// Definition des Farbschemas für Kampagne 1 (Österreich)
const themeKampagne1: SemrushTheme = {
  headerGradient: "from-orange-600 to-orange-500",
  headerText: "text-orange-100",
  headerTextMuted: "text-orange-50 opacity-75",
  tableHeaderBg: "bg-orange-600",
  tableHeaderBorder: "border-orange-500",
  tableHeaderHover: "hover:bg-orange-700",
  tableRowHover: "hover:bg-orange-50",
};

interface SemrushTopKeywordsProps {
  projectId?: string | null;
}

export default function SemrushTopKeywords({ projectId }: SemrushTopKeywordsProps) {
  return (
    <SemrushKeywordTableBase
      projectId={projectId}
      campaign="kampagne_1"
      title="Top 20 Organische Keywords - Österreich"
      logContext="SemrushTopKeywords"
      errorContext="Kampagne 1"
      keyPrefix="kampagne-1"
      theme={themeKampagne1}
      debugInfo={{
        title: "Debug (Kampagne 1)",
        classes: "bg-blue-50 border-blue-200"
      }}
    />
  );
}
