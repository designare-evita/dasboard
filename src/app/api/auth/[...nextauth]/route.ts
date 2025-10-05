import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { getUserByEmail } from "@/lib/database";
import bcrypt from 'bcryptjs';

const handler = NextAuth({
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: '/login', // Leitet zu unserer custom Login-Seite um
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        // 1. Benutzer in der Datenbank suchen
        const user = await getUserByEmail(credentials.email);
        if (!user || !user.password) {
          console.log("Benutzer nicht gefunden oder hat kein Passwort.");
          return null;
        }

        // 2. Passwörter vergleichen
        const isPasswordCorrect = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordCorrect) {
          console.log("Passwort ist falsch.");
          return null;
        }
        
        console.log("Login erfolgreich für:", user.email);
        
        // 3. Benutzer-Objekt zurückgeben (ohne Passwort!)
        return { 
          id: user.id, 
          email: user.email, 
          role: user.role 
          // Wichtig: Niemals das Passwort hier zurückgeben!
        };
      }
    })
  ],
  // Callbacks, um die Rolle in die Session aufzunehmen
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).role = token.role;
      }
      return session;
    },
  }
})

export { handler as GET, handler as POST }
