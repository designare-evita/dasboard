// src/lib/ai-config.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// 1. ZENTRALE MODELL-DEFINITION
// ============================================================================
export const AI_CONFIG = {
  primaryModel: 'gemini-3-flash-preview',
  fallbackModel: 'gemini-2.5-flash',
  
  // Presets für verschiedene Aufgaben
  settings: {
    strict: { temperature: 0.1 },  // Für JSON / Daten
    balanced: { temperature: 0.7 }, // Für Chat / Evita (Standard)
    creative: { temperature: 0.9 }, // Für Marketing-Ideen
  }
};

// Initialisiere den Vercel AI SDK Client einmal zentral
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// ============================================================================
// 2. HELFER FÜR NEXT.JS ROUTEN (@ai-sdk/google)
// ============================================================================
/**
 * Führt streamText automatisch mit dem Fallback-Mechanismus aus.
 * Übergib einfach alle Parameter außer 'model'.
 */
export async function streamTextSafe(params: Omit<Parameters<typeof streamText>[0], 'model'>) {
  try {
    // Versuch 1: Primäres Modell (Gemini 3)
    return await streamText({
      ...params,
      model: google(AI_CONFIG.primaryModel),
    } as any); // <--- FIX: "as any" verhindert den TypeScript Union-Fehler
  } catch (error) {
    console.warn(`⚠️ AI-Manager: Primary (${AI_CONFIG.primaryModel}) fehlgeschlagen. Starte Fallback auf ${AI_CONFIG.fallbackModel}.`, error);
    
    // Versuch 2: Fallback Modell (Gemini 2.5)
    return await streamText({
      ...params,
      model: google(AI_CONFIG.fallbackModel),
    } as any); // <--- FIX: Auch hier "as any"
  }
}

// ============================================================================
// 3. HELFER FÜR STANDARD SDK (ask-gemini.js)
// ============================================================================
/**
 * Gibt fertig konfigurierte Modell-Instanzen zurück.
 * Nutze dies in ask-gemini.js
 */
export function getGeminiInstances(client: GoogleGenerativeAI) {
    const config = { temperature: AI_CONFIG.temperature };
    
    return {
        primary: client.getGenerativeModel({ model: AI_CONFIG.primaryModel, generationConfig: config }),
        fallback: client.getGenerativeModel({ model: AI_CONFIG.fallbackModel, generationConfig: config }),
        modelNames: {
            primary: AI_CONFIG.primaryModel,
            fallback: AI_CONFIG.fallbackModel
        }
    };
}
