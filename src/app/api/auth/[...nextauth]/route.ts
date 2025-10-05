import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { getUserByEmail } from "@/lib/database";
import bcrypt from 'bcryptjs';
import { User } from "@/types";

const handler = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log('[Authorize] Starte Autorisierungsprozess...');
        if (!credentials?.email || !credentials.password) {
          console.log('[Authorize] Fehler: E-Mail oder Passwort fehlen.');
          return null;
        }

        console.log(`[Authorize] Suche Benutzer in DB mit E-Mail: ${credentials.email.toLowerCase()}`);
        const user = await getUserByEmail(credentials.email.toLowerCase());

        if (!user || !user.password) {
          console.log('[Authorize] ERGEBNIS: Benutzer wurde nicht in der Datenbank gefunden.');
          return null;
        }
        console.log(`[Authorize] Benutzer ${user.email} gefunden. Vergleiche Passwörter...`);

        const isPasswordCorrect = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordCorrect) {
          console.log('[Authorize] ERGEBNIS: Passwort-Vergleich fehlgeschlagen.');
          return null;
        }
        
        console.log('[Authorize] ERGEBNIS: Login erfolgreich!');
        return { 
          id: user.id, 
          email: user.email, 
          role: user.role 
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = user.role;
      return token;
    },
    async session({ session, token }) {
      if (session?.user && token?.role) {
        session.user.role = token.role as User['role'];
      }
      return session;
    },
  }
})

export { handler as GET, handler as POST }
