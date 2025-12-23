// src/lib/ai-config.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, StreamTextResult } from 'ai';

export const AI_CONFIG = {
  primaryModel: 'gemini-3-flash-preview',
  fallbackModel: 'gemini-2.5-flash',
  settings: {
    strict: { temperature: 0.1 },
    balanced: { temperature: 0.7 },
    creative: { temperature: 0.9 },
  },
  temperature: 0.7,
};

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export { google };

/**
 * Rückgabetyp für den safe helper
 */
interface SafeStreamResponse {
  result: StreamTextResult<any>;
  modelName: string;
  status: 'primary' | 'fallback';
}

/**
 * Führt streamText mit automatischem Fallback aus.
 */
export async function streamTextSafe(
  params: Omit<Parameters<typeof streamText>[0], 'model'>
): Promise<SafeStreamResponse> {
  try {
    // Versuch 1: Primär
    const result = await streamText({
      ...params,
      model: google(AI_CONFIG.primaryModel),
    } as any);

    return { result, modelName: AI_CONFIG.primaryModel, status: 'primary' };
  } catch (error) {
    console.warn(`⚠️ AI-Manager: Fallback auf ${AI_CONFIG.fallbackModel}`, error);
    
    // Versuch 2: Fallback
    const result = await streamText({
      ...params,
      model: google(AI_CONFIG.fallbackModel),
    } as any);

    return { result, modelName: AI_CONFIG.fallbackModel, status: 'fallback' };
  }
}
