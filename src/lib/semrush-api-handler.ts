// src/lib/semrush-api-handler.ts - COMPLETE HANDLER MIT AUTOMATISCHEM FALLBACK
import { getSemrushKeywords } from './semrush-api';
import { getSemrushKeywordsV2Fallback, getSemrushKeywordsV2Extended } from './semrush-api-v2-fallback';

interface CampaignData {
  campaignId: string;
  domain: string;
  projectId?: string;
  trackingId?: string;
  userId?: string;
}

interface SemrushHandlerResult {
  source: 'v1-api' | 'v2-api' | 'v2-extended-api' | 'failed';
  keywords: Array<{
    keyword: string;
    position: number;
    previousPosition: number | null;
    searchVolume: number;
    url: string;
    trafficPercent: number;
  }>;
  error: string | null;
  attemptCount?: number;
  timing?: {
    v1Ms?: number;
    v2Ms?: number;
    v2ExtMs?: number;
    totalMs?: number;
  };
}

/**
 * 🎯 HAUPTFUNKTION - Semrush API mit automatischem Fallback
 * 
 * Versucht nacheinander:
 * 1. v1 API mit 5 Strategien (neue verbesserte Version)
 * 2. v2 API einfach (robuster Fallback)
 * 3. v2 API erweitert (zusätzliche Metriken)
 * 
 * Returniert sofort erfolgreiches Ergebnis oder schlägt nur fehl wenn alle versucht wurden
 */
export async function getSemrushKeywordsWithFallback(
  data: CampaignData
): Promise<SemrushHandlerResult> {
  const { campaignId, domain, userId } = data;
  
  const totalStartTime = Date.now();
  
  console.log('\n========== SEMRUSH HANDLER START ==========');
  console.log('[Handler] User ID:', userId);
  console.log('[Handler] Campaign ID:', campaignId);
  console.log('[Handler] Domain:', domain);
  console.log('[Handler] Attempting: v1 → v2-simple → v2-extended');

  const timing = {
    v1Ms: 0,
    v2Ms: 0,
    v2ExtMs: 0,
    totalMs: 0
  };

  // ========== SCHRITT 1: v1 API mit 5 Strategien ==========
  try {
    console.log('\n[Handler] ATTEMPT 1/3: v1 API (5 strategies)');
    const v1StartTime = Date.now();
    
    const v1Result = await getSemrushKeywords(campaignId, domain);
    timing.v1Ms = Date.now() - v1StartTime;
    
    if (v1Result.keywords && v1Result.keywords.length > 0) {
      timing.totalMs = Date.now() - totalStartTime;
      console.log(`[Handler] ✅ SUCCESS! v1 API worked in ${timing.v1Ms}ms`);
      console.log('[Handler] Got', v1Result.keywords.length, 'keywords');
      console.log('========== SEMRUSH HANDLER END ==========\n');
      
      return {
        source: 'v1-api',
        keywords: v1Result.keywords,
        error: null,
        attemptCount: 1,
        timing
      };
    }
    
    console.log('[Handler] ⚠️ v1 returned no keywords');
    console.log('[Handler] Error:', v1Result.error);
  } catch (error) {
    console.error('[Handler] ❌ v1 threw error:', error instanceof Error ? error.message : error);
  }

  // ========== SCHRITT 2: v2 API einfach ==========
  try {
    console.log('\n[Handler] ATTEMPT 2/3: v2 API (simple)');
    const v2StartTime = Date.now();
    
    const v2Result = await getSemrushKeywordsV2Fallback(domain);
    timing.v2Ms = Date.now() - v2StartTime;
    
    if (v2Result.keywords && v2Result.keywords.length > 0) {
      timing.totalMs = Date.now() - totalStartTime;
      console.log(`[Handler] ✅ SUCCESS! v2-simple worked in ${timing.v2Ms}ms`);
      console.log('[Handler] Got', v2Result.keywords.length, 'keywords');
      console.log('========== SEMRUSH HANDLER END ==========\n');
      
      return {
        source: 'v2-api',
        keywords: v2Result.keywords,
        error: null,
        attemptCount: 2,
        timing
      };
    }
    
    console.log('[Handler] ⚠️ v2-simple returned no keywords');
    console.log('[Handler] Error:', v2Result.error);
  } catch (error) {
    console.error('[Handler] ❌ v2-simple threw error:', error instanceof Error ? error.message : error);
  }

  // ========== SCHRITT 3: v2 API erweitert ==========
  try {
    console.log('\n[Handler] ATTEMPT 3/3: v2 API (extended)');
    const v2ExtStartTime = Date.now();
    
    const v2ExtResult = await getSemrushKeywordsV2Extended(domain);
    timing.v2ExtMs = Date.now() - v2ExtStartTime;
    
    if (v2ExtResult.keywords && v2ExtResult.keywords.length > 0) {
      timing.totalMs = Date.now() - totalStartTime;
      console.log(`[Handler] ✅ SUCCESS! v2-extended worked in ${timing.v2ExtMs}ms`);
      console.log('[Handler] Got', v2ExtResult.keywords.length, 'keywords');
      console.log('========== SEMRUSH HANDLER END ==========\n');
      
      return {
        source: 'v2-extended-api',
        keywords: v2ExtResult.keywords,
        error: null,
        attemptCount: 3,
        timing
      };
    }
    
    console.log('[Handler] ⚠️ v2-extended returned no keywords');
    console.log('[Handler] Error:', v2ExtResult.error);
  } catch (error) {
    console.error('[Handler] ❌ v2-extended threw error:', error instanceof Error ? error.message : error);
  }

  // ========== ALLE VERSUCHE FEHLGESCHLAGEN ==========
  timing.totalMs = Date.now() - totalStartTime;
  console.error('\n[Handler] ❌ ALL ATTEMPTS FAILED!');
  console.error('[Handler] Timings:', timing);
  console.log('========== SEMRUSH HANDLER END ==========\n');
  
  return {
    source: 'failed',
    keywords: [],
    error: 'Could not fetch keywords from any API version (tried: v1, v2-simple, v2-extended)',
    attemptCount: 3,
    timing
  };
}

/**
 * 🚀 RAPID FALLBACK - Nutzt schnelles Timeout für v1
 * Wenn v1 länger als 5 Sekunden dauert → sofort v2
 */
export async function getSemrushKeywordsRapidFallback(
  data: CampaignData,
  v1TimeoutMs: number = 5000
): Promise<SemrushHandlerResult> {
  const { campaignId, domain, userId } = data;
  
  console.log(`\n[RapidFallback] Starting with ${v1TimeoutMs}ms timeout for v1`);

  // v1 mit Timeout
  const v1Promise = getSemrushKeywords(campaignId, domain);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('v1 timeout')), v1TimeoutMs)
  );

  try {
    const v1Result = await Promise.race([v1Promise, timeoutPromise]) as any;
    
    if (v1Result.keywords && v1Result.keywords.length > 0) {
      return {
        source: 'v1-api',
        keywords: v1Result.keywords,
        error: null,
        attemptCount: 1,
        timing: { v1Ms: v1TimeoutMs, totalMs: v1TimeoutMs }
      };
    }
  } catch (error) {
    console.log('[RapidFallback] v1 timeout/error, falling back to v2');
  }

  // Fallback zu v2
  const v2Result = await getSemrushKeywordsV2Fallback(domain);
  return {
    source: 'v2-api',
    keywords: v2Result.keywords,
    error: v2Result.error,
    attemptCount: 2,
    timing: { v1Ms: v1TimeoutMs, v2Ms: 0, totalMs: 0 }
  };
}

/**
 * 📊 RESULT FORMATTER - Bereitet Ergebnis für API-Response vor
 */
export function formatSemrushResult(result: SemrushHandlerResult) {
  return {
    data: {
      keywords: result.keywords,
      source: result.source,
      count: result.keywords.length,
      attemptCount: result.attemptCount
    },
    meta: {
      success: result.keywords.length > 0,
      error: result.error,
      timing: result.timing
    }
  };
}

/**
 * 📝 LOGGING HELPER - Speichert Semrush Versuche in Datenbank/Log
 */
export function logSemrushAttempt(
  result: SemrushHandlerResult,
  data: CampaignData
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId: data.userId,
    campaignId: data.campaignId,
    domain: data.domain,
    source: result.source,
    keywordCount: result.keywords.length,
    success: result.keywords.length > 0,
    error: result.error,
    timing: result.timing
  };

  // Später: In DB speichern
  // await db.semrushLogs.create(logEntry);
  
  console.log('[SemrushLog] Entry created:', JSON.stringify(logEntry, null, 2));
  
  return logEntry;
}

/**
 * 🔍 DIAGNOSTICS - Gibt Infos über API Health
 */
export async function getSemrushDiagnostics(testDomain: string = 'example.com') {
  console.log('\n========== SEMRUSH DIAGNOSTICS START ==========');
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    testDomain,
    results: {
      v1: { success: false, timeMs: 0, error: null as string | null },
      v2: { success: false, timeMs: 0, error: null as string | null },
      v2Ext: { success: false, timeMs: 0, error: null as string | null }
    }
  };

  // Test v1
  try {
    const start = Date.now();
    const result = await getSemrushKeywords('test_campaign_12920575_1209491', testDomain);
    diagnostics.results.v1.timeMs = Date.now() - start;
    diagnostics.results.v1.success = (result.keywords?.length || 0) > 0;
    if (result.error) diagnostics.results.v1.error = result.error;
  } catch (error) {
    diagnostics.results.v1.error = String(error);
  }

  // Test v2
  try {
    const start = Date.now();
    const result = await getSemrushKeywordsV2Fallback(testDomain);
    diagnostics.results.v2.timeMs = Date.now() - start;
    diagnostics.results.v2.success = (result.keywords?.length || 0) > 0;
    if (result.error) diagnostics.results.v2.error = result.error;
  } catch (error) {
    diagnostics.results.v2.error = String(error);
  }

  // Test v2 Extended
  try {
    const start = Date.now();
    const result = await getSemrushKeywordsV2Extended(testDomain);
    diagnostics.results.v2Ext.timeMs = Date.now() - start;
    diagnostics.results.v2Ext.success = (result.keywords?.length || 0) > 0;
    if (result.error) diagnostics.results.v2Ext.error = result.error;
  } catch (error) {
    diagnostics.results.v2Ext.error = String(error);
  }

  console.log('[Diagnostics] Results:', JSON.stringify(diagnostics, null, 2));
  console.log('========== SEMRUSH DIAGNOSTICS END ==========\n');

  return diagnostics;
}
