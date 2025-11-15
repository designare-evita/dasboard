// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { unstable_noStore as noStore } from 'next/cache';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        noStore();

        if (!credentials?.email || !credentials.password) {
          throw new Error('E-Mail oder Passwort fehlt');
        }

        const normalizedEmail = credentials.email.toLowerCase().trim();
        console.log('[Authorize] Suche Benutzer:', normalizedEmail);

        // Wir teilen den try...catch Block auf
        let user;
        try {
          // 1. Benutzerdaten holen
          const { rows } = await sql`
            SELECT id, email, password, role, mandant_id, permissions 
            FROM users 
            WHERE email = ${normalizedEmail}
          `;
          user = rows[0];

          if (!user) {
            console.log('[Authorize] Benutzer nicht gefunden:', normalizedEmail);
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
            throw new Error('Das Passwort ist nicht korrekt');
          }

          console.log('[Authorize] Login erfolgreich für:', user.email);

        } catch (authError) {
          // Fängt "Falsches Passwort", "Benutzer nicht gefunden", etc. ab
          if (authError instanceof Error) {
            console.warn(`[Authorize] Authentifizierungsfehler: ${authError.message}`);
            throw authError; // Wirft den Fehler an NextAuth
          }
          console.error("[Authorize] Unerwarteter Authentifizierungsfehler:", authError);
          throw new Error('Authentifizierungsfehler');
        }
        
        // ✅ ==============================================
        // ✅ KORREKTUR: Logging OHNE try...catch
        // ✅ ==============================================
        // Wenn DIESER Teil fehlschlägt, bricht der gesamte Login ab
        // und die Fehlermeldung wird auf dem Login-Bildschirm angezeigt.
        
        console.log('[Authorize] Versuche, Login-Ereignis zu protokollieren...');
        
        // Wir versuchen es jetzt ohne den `::uuid` Cast und lassen @vercel/postgres
        // die Typumwandlung des String-UUID selbst übernehmen.
        await sql`
          INSERT INTO login_logs (user_id, user_email, user_role)
          VALUES (${user.id}, ${user.email}, ${user.role});
        `;
        
        console.log('[Authorize] Login-Ereignis erfolgreich protokolliert.');
        // ✅ ==============================================
        // ✅ ENDE KORREKTUR
        // ✅ ==============================================


        // (Logo-URL-Abruf bleibt unverändert)
        let logo_url: string | null = null;
        if (user.mandant_id) {
          try {
            const { rows: logoRows } = await sql`
              SELECT logo_url FROM mandanten_logos WHERE mandant_id = ${user.mandant_id}
            `;
            if (logoRows.length > 0) {
              logo_url = logoRows[0].logo_url;
            }
          } catch (logoError) {
            // Dieser Fehler ist nicht-fatal, wir loggen ihn nur
            console.error('[Authorize] Fehler beim Abrufen des Logos (nicht-fatal):', logoError);
          }
        }

        // (Return bleibt unverändert)
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          mandant_id: user.mandant_id,
          permissions: user.permissions || [],
          logo_url: logo_url,
        };
      }
    })
  ],
  // (Rest der Datei bleibt unverändert)
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60, // 60 Minuten
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // @ts-expect-error
        token.role = user.role;
        // @ts-expect-error
        token.mandant_id = user.mandant_id;
        // @ts-expect-error
        token.permissions = user.permissions;
        // @ts-expect-error
        token.logo_url = user.logo_url;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
        session.user.mandant_id = token.mandant_id as string | null | undefined;
        session.user.permissions = token.permissions as string[] | undefined;
        session.user.logo_url = token.logo_url as string | null | undefined;
      }
      return session;
    },
  },
};
