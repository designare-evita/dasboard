import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

// 1. Google AI Konfiguration (identisch zur analyze-Route)
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// Edge-Runtime vermeiden, da wir Node-APIs (wie Auth) nutzen könnten
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 2. Authentifizierung prüfen
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // Zugriffsschutz: Nur Admin oder Superadmin
    const userRole = session.user.role;
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert: Nur für Administratoren.' }, { status: 403 });
    }

    // 3. Request Body parsen
    const body = await req.json();
    const { keywords, domain } = body;

    // Validierung
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0 || !domain) {
      return NextResponse.json(
        { message: 'Fehlende Parameter: "keywords" (Array) und "domain" (String) sind erforderlich.' }, 
        { status: 400 }
      );
    }

    // 4. KI-Generierung mit Streaming
    const keywordList = keywords.join(', ');
    
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: "Du bist ein erfahrener SEO-Redakteur. Deine Aufgabe ist es, basierend auf Keywords relevante 'W-Fragen' (Wer, Wie, Was, Wo, Warum) zu generieren, die Nutzer suchen könnten. Formatiere die Antwort als saubere Liste.",
      prompt: `Analysiere die Domain "${domain}" und die folgenden Keywords: ${keywordList}.\n\nGeneriere eine Liste relevanter W-Fragen, die potentielle Besucher dieser Domain in Bezug auf die Keywords haben könnten.`,
      temperature: 0.7, // Etwas Kreativität für vielfältige Fragen
    });

    // 5. Stream als Response zurückgeben
    return result.toTextStreamResponse();

  } catch (error) {
    console.error('[AI Generate Questions] Fehler:', error);
    return NextResponse.json(
      { message: 'Interner Serverfehler', error: String(error) }, 
      { status: 500 }
    );
  }
}
