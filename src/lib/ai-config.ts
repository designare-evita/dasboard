// src/lib/ai-config.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, StreamTextResult } from 'ai';

// ============================================================================
// ZENTRALE AI-KONFIGURATION
// ============================================================================

export const AI_CONFIG = {
  // Modell-Kette: Beste zuerst, dann Fallbacks
  models: [
    'gemini-3-flash-preview',  // Primary (Free Tier, beste Qualität, aber 20 Req/Tag Limit)
    'gemini-2.5-flash',        // Fallback 1 (Pay-as-you-go verfügbar)
    'gemini-2.0-flash',        // Fallback 2 (günstigster Paid, sehr stabil)
  ] as const,
  
  // Shortcuts für direkten Zugriff (Rückwärtskompatibilität)
  primaryModel: 'gemini-3-flash-preview' as const,
  fallbackModel: 'gemini-2.5-flash' as const,
  lastResortModel: 'gemini-2.0-flash' as const,
  
  // Temperature-Presets
  settings: {
    strict: { temperature: 0.1 },    // Für JSON, Code, Fakten
    balanced: { temperature: 0.7 },  // Standard
    creative: { temperature: 0.9 },  // Für Content, Brainstorming
  },
  
  // Default Temperature
  temperature: 0.7,
};

// ============================================================================
// GOOGLE AI PROVIDER
// ============================================================================

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export { google };

// ============================================================================
// TYPEN
// ============================================================================

type ModelStatus = 'primary' | 'fallback' | 'lastResort';

interface SafeStreamResponse {
  result: StreamTextResult<any>;
  modelName: string;
  status: ModelStatus;
}

interface StreamTextSafeParams extends Omit<Parameters<typeof streamText>[0], 'model'> {
  // Optionale Callback für Model-Wechsel (z.B. für Logging)
  onModelSwitch?: (fromModel: string, toModel: string, error: Error) => void;
}

// ============================================================================
// HELPER: Rate-Limit-Erkennung
// ============================================================================

function isRateLimitError(error: unknown): boolean {
  const errorStr = String(error).toLowerCase();
  return (
    errorStr.includes('429') ||
    errorStr.includes('quota') ||
    errorStr.includes('rate limit') ||
    errorStr.includes('too many requests') ||
    errorStr.includes('resource exhausted') ||
    errorStr.includes('exceeded')
  );
}

function getErrorType(error: unknown): 'rateLimit' | 'serverError' | 'unknown' {
  if (isRateLimitError(error)) return 'rateLimit';
  
  const errorStr = String(error).toLowerCase();
  if (errorStr.includes('500') || errorStr.includes('503') || errorStr.includes('internal')) {
    return 'serverError';
  }
  
  return 'unknown';
}

// ============================================================================
// HAUPTFUNKTION: streamTextSafe mit Multi-Fallback
// ============================================================================

/**
 * Führt streamText mit automatischem Multi-Fallback aus.
 * Versucht alle Modelle in der Reihenfolge: Primary → Fallback → LastResort
 * 
 * @example
 * const { result, modelName, status } = await streamTextSafe({
 *   prompt: 'Analysiere diese Daten...',
 *   temperature: 0.3,
 * });
 * return result.toTextStreamResponse();
 */
export async function streamTextSafe(
  params: StreamTextSafeParams
): Promise<SafeStreamResponse> {
  
  const { onModelSwitch, ...streamParams } = params;
  const models = AI_CONFIG.models;
  const statusMap: Record<number, ModelStatus> = {
    0: 'primary',
    1: 'fallback', 
    2: 'lastResort'
  };
  
  let lastError: Error | null = null;
  let previousModel: string | null = null;

  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    const status = statusMap[i] || 'lastResort';
    
    try {
      // Logging nur bei Fallback
      if (i === 0) {
        console.log(`🤖 AI-Manager: Starte mit ${modelName}`);
      } else {
        console.log(`🔄 AI-Manager: Fallback auf ${modelName}...`);
      }
      
      const result = await streamText({
        ...streamParams,
        model: google(modelName),
      } as any);

      // Erfolg!
      if (i > 0) {
        console.log(`✅ AI-Manager: ${modelName} erfolgreich (nach ${i} Fallback${i > 1 ? 's' : ''})`);
      }
      
      return { result, modelName, status };
      
    } catch (error) {
      lastError = error as Error;
      const errorType = getErrorType(error);
      
      // Callback für Model-Wechsel
      if (onModelSwitch && previousModel) {
        onModelSwitch(previousModel, modelName, lastError);
      }
      
      // Detailliertes Logging
      if (errorType === 'rateLimit') {
        console.warn(`⏳ AI-Manager: Rate Limit bei ${modelName}`);
      } else if (errorType === 'serverError') {
        console.warn(`🔥 AI-Manager: Server Error bei ${modelName}`);
      } else {
        console.warn(`⚠️ AI-Manager: ${modelName} fehlgeschlagen:`, error);
      }
      
      previousModel = modelName;
    }
  }

  // Alle Modelle fehlgeschlagen
  const finalError = new Error(
    `Alle AI-Modelle fehlgeschlagen (${models.join(' → ')}). ` +
    `Letzter Fehler: ${lastError?.message || 'Unbekannt'}`
  );
  
  console.error('❌ AI-Manager: Alle Modelle erschöpft!', finalError);
  throw finalError;
}

// ============================================================================
// CONVENIENCE WRAPPER: toTextStreamResponse mit Headers
// ============================================================================

/**
 * Erstellt eine Text Stream Response mit AI-Status-Headers
 * 
 * @example
 * const response = await streamTextSafe({ prompt: '...' });
 * return createAIStreamResponse(response);
 */
export function createAIStreamResponse(
  safeResponse: SafeStreamResponse,
  additionalHeaders?: Record<string, string>
): Response {
  return safeResponse.result.toTextStreamResponse({
    headers: {
      'X-AI-Model': safeResponse.modelName,
      'X-AI-Status': safeResponse.status,
      ...additionalHeaders,
    },
  });
}
