// src/lib/auth.ts

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
// NEU: Importiert, um das Caching von Daten in dieser Route zu verhindern
import { unstable_noStore as noStore } from 'next/cache';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      // Diese Funktion wird bei jedem Anmeldeversuch ausgeführt
      async authorize(credentials) {
        // NEU: Verhindert das Caching der Benutzerabfrage.
        // Dies stellt sicher, dass immer frische Daten aus der DB gelesen werden
        // und löst das Problem, dass Logins nach 10 Min. fehlschlagen.
        noStore();

        if (!credentials?.email || !credentials.password) {
          console.log('[Authorize] Fehlende Credentials');
          return null; // Keine Anmeldedaten vorhanden
        }

        // Normalisiert die E-Mail, um Caching-Inkonsistenzen oder Eingabefehler zu vermeiden
        const normalizedEmail = credentials.email.toLowerCase().trim();
        console.log('[Authorize] Suche Benutzer:', normalizedEmail);

        try {
          // 1. Benutzer in der Datenbank suchen
          const { rows } = await sql`
            SELECT id, email, password, role FROM users WHERE email = ${normalizedEmail}
          `;
          const user = rows[0];

          if (!user) {
            console.log('[Authorize] Benutzer nicht gefunden:', normalizedEmail);
            // WICHTIG: Wir werfen einen Error, damit NextAuth weiß, dass es fehlgeschlagen ist
            throw new Error('Nicht autorisiert');
          }

          console.log('[Authorize] Benutzer gefunden:', user.email);

          if (!user.password) {
            console.error('[Authorize] KRITISCHER FEHLER: Benutzer hat kein Passwort-Hash in der DB!');
            throw new Error('Serverkonfigurationsfehler');
          }

          // 2. Eingegebenes Passwort mit dem Hash in der Datenbank vergleichen
          const passwordsMatch = await bcrypt.compare(credentials.password, user.password);

          if (!passwordsMatch) {
            console.log('[Authorize] Passwort-Vergleich fehlgeschlagen für:', normalizedEmail);
            // WICHTIG: Wir werfen denselben Error, damit das Frontend die Meldung anzeigen kann
            throw new Error('Nicht autorisiert');
          }

          console.log('[Authorize] Login erfolgreich für:', user.email);
          // 3. Bei Erfolg das Benutzerobjekt zurückgeben
          return {
            id: user.id,
            email: user.email,
            role: user.role,
          };
        } catch (error) {
          // Leitet die spezifische Fehlermeldung an NextAuth weiter
          if (error instanceof Error) {
            console.warn(`[Authorize] Fehler: ${error.message}`);
            throw error; // Den Fehler (z.B. "Nicht autorisiert") weiterwerfen
          }
          // Fallback für unerwartete Fehler
          console.error("[Authorize] Unerwarteter Fehler:", error);
          throw new Error('Authentifizierungsfehler');
        }
      }
    })
  ],
  session: {
    strategy: 'jwt', // Wir verwenden JWTs, um die Session zu verwalten
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login', // Leitet Benutzer zur neuen Login-Seite
  },
  callbacks: {
    // JWT mit Benutzerdaten anreichern
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // @ts-expect-error - Das User-Objekt vom authorize-Callback hat eine 'role'-Eigenschaft
        token.role = user.role;
      }
      return token;
    },
    // Session mit den Daten aus dem JWT anreichern
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // Stellen sicher, dass die Rolle korrekt typisiert ist
        session.user.role = token.role as 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
      }
      return session;
    },
  },
};
