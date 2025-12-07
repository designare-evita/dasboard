import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { NextAuthConfig } from 'next-auth';
import type { User } from 'next-auth'; // WICHTIG: User Typ importieren

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
        token.mandant_id = user.mandant_id;
        token.permissions = user.permissions;
        token.logo_url = user.logo_url;
        token.gsc_site_url = user.gsc_site_url;
        
        // Prüfen, ob eine Redaktionsplan-URL existiert (DB Feld -> Boolean Flag)
        token.hasRedaktionsplan = !!user.redaktionsplan_url && user.redaktionsplan_url.length > 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.mandant_id = token.mandant_id;
        session.user.permissions = token.permissions;
        session.user.logo_url = token.logo_url;
        session.user.gsc_site_url = token.gsc_site_url;
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
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          
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

          const passwordsMatch = await bcrypt.compare(password, user.password);
          if (passwordsMatch) {
            // WICHTIG: Hier casten wir das Ergebnis explizit auf den User-Typ
            return user as User;
          }
        }

        console.log('Invalid credentials');
        return null;
      },
    }),
  ],
} satisfies NextAuthConfig;

export const { auth, signIn, signOut, handlers } = NextAuth(authConfig);
