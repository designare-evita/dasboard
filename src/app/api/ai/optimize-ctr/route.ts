import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

// Google AI Initialisierung
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. Authentifizierung & Rollenprüfung
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role } = session.user;
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    // 2. Input Validierung
    const body = await req.json();
    const { keyword, currentCtr, currentPosition, domain } = body;

    if (!keyword) {
      return NextResponse.json({ message: 'Keyword fehlt' }, { status: 400 });
    }

    // 3. KI Generierung (generateText für JSON)
    // Wir nutzen 'gemini-2.5-flash' wie angefordert. 
    // Falls es Probleme gibt (wie im vorherigen Chat), kann hier auf 'gemini-1.5-flash' gewechselt werden.
    const systemPrompt = `
      Du bist ein erstklassiger SEO- & Copywriting-Experte. Dein Spezialgebiet ist die Optimierung von Google SERP-Snippets (CTR-Optimierung).
      
      AUFGABE:
      Erstelle 3 hochwirksame Variationen von 'Meta Title' und 'Meta Description' für das angegebene Keyword.
      
      REGELN:
      1. Meta Title: Maximal 60 Zeichen (inkl. Leerzeichen). Das Keyword muss weit vorne stehen.
      2. Meta Description: Maximal 155 Zeichen. Muss zum Klicken anregen (Call-to-Action, Benefit, Neugier).
      3. Ansätze: Nutze unterschiedliche psychologische Trigger (z.B. "Emotionale Dringlichkeit", "Autorität/Vertrauen", "Lösungsorientiert").
      4. Output Format: Gebe NUR valides JSON zurück. Keine Markdown-Formatierung (kein \`\`\`json).
      
      JSON STRUKTUR:
      {
        "suggestions": [
          { 
            "title": "...", 
            "description": "...", 
            "approach": "Kurze Erklärung des Ansatzes (z.B. Neugier)" 
          }
        ]
      }
    `;

    const userPrompt = `
      Domain: ${domain}
      Keyword: "${keyword}"
      Aktuelle Position: ${currentPosition}
      Aktuelle CTR: ${currentCtr}
      
      Bitte generiere die Optimierungsvorschläge.
    `;

    const result = await generateText({
      model: google('gemini-2.5-flash'), // Modell wie angefordert
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7, // Kreativ aber fokussiert
    });

    // 4. JSON Parsing & Bereinigung
    // Manchmal sendet die KI trotz Anweisung Markdown-Codeblöcke. Wir entfernen diese.
    let cleanJson = result.text.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    let parsedData;
    try {
      parsedData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('[AI CTR] JSON Parse Fehler:', parseError);
      console.error('[AI CTR] Raw Output:', result.text);
      return NextResponse.json({ message: 'KI-Antwort konnte nicht verarbeitet werden.' }, { status: 500 });
    }

    return NextResponse.json(parsedData);

  } catch (error) {
    console.error('[AI CTR] Fehler:', error);
    return NextResponse.json(
      { message: 'Interner Serverfehler', error: String(error) }, 
      { status: 500 }
    );
  }
}
