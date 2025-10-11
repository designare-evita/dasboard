// src/lib/auth.ts

import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { sql } from '@vercel/postgres';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline", // Wichtig, um ein refresh_token zu erhalten
          response_type: "code",
          scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/webmasters.readonly',
            'https://www.googleapis.com/auth/analytics.readonly'
          ].join(' '),
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    // Dieser Callback wird aufgerufen, wenn ein JWT (JSON Web Token) erstellt wird.
    async jwt({ token, account, user }) {
      // Wenn der Benutzer sich gerade erst angemeldet hat (account existiert)
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.id = user.id; // user.id kommt von der Datenbank-Anmeldung
      }
      return token;
    },
    // Dieser Callback wird aufgerufen, wenn eine Client-Session erstellt wird.
    async session({ session, token }) {
      // Wir fügen die Daten aus dem JWT zur Session hinzu
      if (session.user) {
        session.user.id = token.id as string;
        session.accessToken = token.accessToken as string;
        session.refreshToken = token.refreshToken as string;

        // Hole die Rolle des Benutzers aus der Datenbank
        try {
          const { rows } = await sql`SELECT role FROM users WHERE email = ${session.user.email}`;
          if (rows.length > 0) {
            session.user.role = rows[0].role;
          }
        } catch (error) {
          console.error("Fehler beim Abrufen der Benutzerrolle:", error);
          session.user.role = 'USER'; // Fallback
        }
      }
      return session;
    },
  },
};
