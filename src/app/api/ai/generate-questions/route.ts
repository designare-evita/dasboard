// src/app/api/ai/generate-questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. Authentifizierung
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    // 2. Body parsen
    const body = await req.json();
    const { keywords, domain } = body;

    if (!keywords || !Array.isArray(keywords) || !domain) {
      return NextResponse.json({ message: 'Fehlende Parameter' }, { status: 400 });
    }

    // 3. KI Generierung (Mit stable Model 1.5)
    // Wir nutzen 'gemini-1.5-flash', da 2.5 oft noch Preview/Experimental ist
    try {
      const result = streamText({
        model: google('gemini-1.5-flash'), 
        system: "Du bist ein erfahrener SEO-Redakteur. Deine Aufgabe ist es, basierend auf Keywords relevante 'W-Fragen' (Wer, Wie, Was, Wo, Warum) zu generieren, die Nutzer suchen könnten. Formatiere die Antwort als saubere Liste.",
        prompt: `Analysiere die Domain "${domain}" und die folgenden Keywords: ${keywords.join(', ')}.\n\nGeneriere eine Liste relevanter W-Fragen.`,
        temperature: 0.7,
      });

      return result.toTextStreamResponse();
      
    } catch (aiError) {
      console.error('[AI Generate] Google API Fehler:', aiError);
      return NextResponse.json({ 
        message: 'Fehler bei der Kommunikation mit Google AI.',
        details: String(aiError)
      }, { status: 502 });
    }

  } catch (error) {
    console.error('[AI Generate Questions] Server Fehler:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
