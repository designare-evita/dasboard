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
        noStore();

        if (!credentials?.email || !credentials.password) {
          console.log('[Authorize] Fehlende Credentials');
          // KORREKTUR 1: Spezifischer Fehler statt null
          throw new Error('E-Mail oder Passwort fehlt');
        }

        const normalizedEmail = credentials.email.toLowerCase().trim();
        console.log('[Authorize] Suche Benutzer:', normalizedEmail);

        try {
          // 1. Benutzer in der Datenbank suchen
          const { rows } = await sql`
            SELECT id, email, password, role, mandant_id, permissions 
            FROM users 
            WHERE email = ${normalizedEmail}
          `;
          const user = rows[0];

          if (!user) {
            console.log('[Authorize] Benutzer nicht gefunden:', normalizedEmail);
            // KORREKTUR 2: Spezifischer Fehler für "Benutzer nicht gefunden"
            throw new Error('Diese E-Mail-Adresse ist nicht registriert');
          }

          console.log('[Authorize] Benutzer gefunden:', user.email);

          if (!user.password) {
            console.error('[Authorize] KRITISCHER FEHLER: Benutzer hat kein Passwort-Hash in der DB!');
            throw new Error('Serverkonfigurationsfehler');
          }

          // 2. Passwort vergleichen
          const passwordsMatch = await bcrypt.compare(credentials.password, user.password);

          if (!passwordsMatch) {
            console.log('[Authorize] Passwort-Vergleich fehlgeschlagen für:', normalizedEmail);
            // KORREKTUR 3: Spezifischer Fehler für "Falsches Passwort"
            throw new Error('Das Passwort ist nicht korrekt');
          }

          console.log('[Authorize] Login erfolgreich für:', user.email);

          // (Rest der Funktion bleibt gleich...)
          // ✅ NEU: Logo-URL für den Mandanten abrufen
          let logo_url: string | null = null;
          if (user.mandant_id) {
            try {
              const { rows: logoRows } = await sql`
                SELECT logo_url FROM mandanten_logos WHERE mandant_id = ${user.mandant_id}
              `;
              if (logoRows.length > 0) {
                logo_url = logoRows[0].logo_url;
                console.log('[Authorize] Mandanten-Logo gefunden:', logo_url);
              }
            } catch (logoError) {
              console.error('[Authorize] Fehler beim Abrufen des Logos:', logoError);
            }
          }
          // ✅ ENDE NEU

          // 3. Bei Erfolg das Benutzerobjekt zurückgeben
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            mandant_id: user.mandant_id,
            permissions: user.permissions || [],
            logo_url: logo_url, // ✅ NEU
          };
        } catch (error) {
          if (error instanceof Error) {
            console.warn(`[Authorize] Fehler: ${error.message}`);
            // Wirft den spezifischen Fehler (z.B. "Falsches Passwort") weiter
            throw error; 
          }
          console.error("[Authorize] Unerwarteter Fehler:", error);
          throw new Error('Authentifizierungsfehler');
        }
      }
    })
  ],
  // (Rest der Datei bleibt gleich)
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60, // 60 Minuten
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // JWT mit Benutzerdaten anreichern
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // @ts-expect-error - User-Objekt enthält erweiterte Felder aus authorize-Callback die nicht im Standard-Typ definiert sind
        token.role = user.role;
        // @ts-expect-error - User-Objekt enthält erweiterte Felder aus authorize-Callback die nicht im Standard-Typ definiert sind
        token.mandant_id = user.mandant_id;
        // @ts-expect-error - User-Objekt enthält erweiterte Felder aus authorize-Callback die nicht im Standard-Typ definiert sind
        token.permissions = user.permissions;
        // @ts-expect-error - User-Objekt enthält erweiterte Felder aus authorize-Callback die nicht im Standard-Typ definiert sind
        token.logo_url = user.logo_url; // ✅ NEU: Logo-URL ins JWT-Token
      }
      return token;
    },
    // Session mit den Daten aus dem JWT anreichern
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // Stellen sicher, dass die Rolle korrekt typisiert ist
        session.user.role = token.role as 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
        session.user.mandant_id = token.mandant_id as string | null | undefined;
        session.user.permissions = token.permissions as string[] | undefined;
        session.user.logo_url = token.logo_url as string | null | undefined; // ✅ NEU: Logo-URL in Session
      }
      return session;
    },
  },
};
