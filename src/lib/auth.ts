// src/lib/auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // 1. Daten vom User-Objekt (aus authorize) ins Token schreiben
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Typ-Assertion, da wir wissen, dass die DB diese Werte liefert
        token.role = user.role as 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
        token.mandant_id = user.mandant_id;
        token.permissions = user.permissions;
        token.logo_url = user.logo_url;
        token.gsc_site_url = user.gsc_site_url;

        // NEU: Prüfen, ob eine Redaktionsplan-URL existiert
        token.hasRedaktionsplan = !!user.redaktionsplan_url && user.redaktionsplan_url.length > 0;
      }
      return token;
    },
    // 2. Daten vom Token in die Session schreiben (für den Client)
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.mandant_id = token.mandant_id;
        session.user.permissions = token.permissions;
        session.user.logo_url = token.logo_url;
        session.user.gsc_site_url = token.gsc_site_url;
        
        // NEU: Flag übergeben
        session.user.hasRedaktionsplan = token.hasRedaktionsplan;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnAdmin = nextUrl.pathname.startsWith('/admin');

      if (isOnDashboard || isOnAdmin) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      }
      return true;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        // Validierung der Eingaben
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          
          // User aus der Datenbank holen
          // WICHTIG: redaktionsplan_url hier mit abfragen!
          const { rows } = await sql`
            SELECT 
              id, 
              email, 
              password, 
              role, 
              mandant_id, 
              permissions, 
              logo_url, 
              gsc_site_url, 
              redaktionsplan_url 
            FROM users 
            WHERE email = ${email.toLowerCase()}
          `;
          const user = rows[0];

          if (!user) return null;

          // Passwort prüfen
          const passwordsMatch = await bcrypt.compare(password, user.password);
          if (passwordsMatch) {
            return user;
          }
        }

        console.log('Invalid credentials');
        return null;
      },
    }),
  ],
} satisfies NextAuthConfig;

// Exportiere die NextAuth-Funktionen für die Nutzung in der App
export const { auth, signIn, signOut, handlers } = NextAuth(authConfig);
