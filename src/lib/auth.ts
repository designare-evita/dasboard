// src/lib/auth.ts

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs'; // Wir nutzen bcrypt zum Passwortvergleich

export const authOptions: NextAuthOptions = {
  providers: [
    // Der GoogleProvider wird entfernt und durch den CredentialsProvider ersetzt
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      // Diese Funktion wird beim Anmeldeversuch ausgeführt
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null; // Keine Anmeldedaten vorhanden
        }

        try {
          // 1. Benutzer in der Datenbank suchen
          const { rows } = await sql`
            SELECT id, email, password, role FROM users WHERE email = ${credentials.email}
          `;
          const user = rows[0];

          if (!user) {
            return null; // Benutzer nicht gefunden
          }

          // 2. Eingegebenes Passwort mit dem Hash in der Datenbank vergleichen
          const passwordsMatch = await bcrypt.compare(credentials.password, user.password);

          if (!passwordsMatch) {
            return null; // Passwort ist falsch
          }

          // 3. Bei Erfolg das Benutzerobjekt zurückgeben
          return {
            id: user.id,
            email: user.email,
            role: user.role,
          };
        } catch (error) {
          console.error("Fehler bei der Autorisierung:", error);
          return null;
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
        // @ts-ignore
        token.role = user.role;
      }
      return token;
    },
    // Session mit den Daten aus dem JWT anreichern
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'USER' | 'ADMIN' | 'SUPERADMIN';
      }
      return session;
    },
  },
};
