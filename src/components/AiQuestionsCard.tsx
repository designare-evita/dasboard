// src/components/AiQuestionsCard.tsx
'use client';

import { ChatQuote, QuestionCircle, PatchCheckFill } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';

interface AiQuestionsCardProps {
  queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
  isLoading?: boolean;
  className?: string;
}

export default function AiQuestionsCard({ 
  queries = [], 
  isLoading = false,
  className 
}: AiQuestionsCardProps) {
  
  if (isLoading) {
    return (
      <div className={cn("bg-white rounded-2xl border border-gray-200 p-6 h-full shadow-sm animate-pulse", className)}>
        <div className="h-6 w-1/3 bg-gray-100 rounded mb-4"></div>
        <div className="space-y-3">
          <div className="h-12 bg-gray-50 rounded"></div>
          <div className="h-8 bg-gray-50 rounded"></div>
        </div>
      </div>
    );
  }

  // 1. Filtere nach W-Fragen (Indikator für Voice/AI Search Intent)
  const questionStarters = ['wie', 'was', 'warum', 'wo', 'wann', 'wer', 'weshalb', 'wieso', 'welche', 'welcher', 'welches'];
  
  const questionQueries = queries.filter(item => {
    const firstWord = item.query.split(' ')[0].toLowerCase();
    return questionStarters.includes(firstWord);
  });

  // Sortiere nach Impressionen (Reichweite)
  const topQuestions = questionQueries
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5);

  const totalQuestionClicks = questionQueries.reduce((sum, q) => sum + q.clicks, 0);
  const totalQuestionImpr = questionQueries.reduce((sum, q) => sum + q.impressions, 0);

  return (
    <div className={cn("bg-white rounded-2xl border border-gray-200 p-6 h-full shadow-sm flex flex-col", className)}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
            <ChatQuote className="text-white" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">KI & Fragen</h3>
            <p className="text-xs text-gray-500 font-medium">Conversational Search Potential</p>
          </div>
        </div>
        {topQuestions.length > 0 && (
           <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-100">
             {questionQueries.length} Fragen
           </span>
        )}
      </div>

      {questionQueries.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center text-center p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
          <QuestionCircle className="text-gray-300 mb-2" size={24} />
          <p className="text-sm text-gray-600 font-medium">Keine Fragen gefunden</p>
          <p className="text-xs text-gray-500 max-w-[200px] mt-1">
            Nutzer suchen aktuell nicht mit direkten W-Fragen nach Ihren Inhalten.
          </p>
        </div>
      ) : (
        <>
           {/* KPI Row */}
           <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                 <div className="text-[10px] text-emerald-700 uppercase font-bold tracking-wider mb-0.5">Frage-Traffic</div>
                 <div className="text-lg font-bold text-emerald-900">{totalQuestionClicks.toLocaleString('de-DE')} <span className="text-xs font-normal text-emerald-600">Klicks</span></div>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                 <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Sichtbarkeit</div>
                 <div className="text-lg font-bold text-gray-900">{totalQuestionImpr.toLocaleString('de-DE')} <span className="text-xs font-normal text-gray-500">Impr.</span></div>
              </div>
           </div>

           {/* Questions List */}
           <div className="flex-grow space-y-3">
             <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
               Top Nutzer-Fragen
               <QuestionCircle size={10} className="text-gray-400" />
             </h4>
             
             <div className="space-y-2">
               {topQuestions.map((q, i) => (
                 <div key={i} className="group flex items-start justify-between p-2.5 rounded-lg hover:bg-emerald-50/50 transition-colors border border-transparent hover:border-emerald-100/50">
                    <div className="flex gap-2.5 overflow-hidden">
                       <span className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center bg-gray-100 text-[10px] font-bold text-gray-500 mt-0.5 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                         ?
                       </span>
                       <span className="text-sm text-gray-700 font-medium leading-tight truncate group-hover:text-gray-900">
                         {q.query}
                       </span>
                    </div>
                    <div className="flex flex-col items-end shrink-0 pl-2">
                       <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                         q.position <= 3 ? 'bg-green-100 text-green-700 border-green-200' : 
                         q.position <= 10 ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                         'bg-gray-100 text-gray-600 border-gray-200'
                       }`}>
                         Pos {q.position.toFixed(0)}
                       </span>
                    </div>
                 </div>
               ))}
             </div>
           </div>
        </>
      )}

      {/* Footer Insight */}
      <div className="mt-5 pt-3 border-t border-gray-100">
         <div className="flex gap-2 items-start">
            <PatchCheckFill className="text-emerald-500 shrink-0 mt-0.5" size={12} />
            <p className="text-[10px] text-gray-500 leading-relaxed">
               <strong>KI-Insight:</strong> Inhalte, die diese Fragen präzise beantworten, werden bevorzugt von Google Gemini & ChatGPT zitiert.
            </p>
         </div>
      </div>
    </div>
  );
}
