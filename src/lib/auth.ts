// src/lib/auth.ts

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserByEmail } from "@/lib/database";
import bcrypt from 'bcryptjs';
import { User } from "@/types";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        
        const user = await getUserByEmail(credentials.email.toLowerCase());
        if (!user || !user.password) return null;
        
        const isPasswordCorrect = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordCorrect) return null;
        
        return { 
          id: user.id, 
          email: user.email, 
          role: user.role 
        };
      }
    })
  ],
  callbacks: {
    // Dieser Callback wird aufgerufen, NACHDEM 'authorize' erfolgreich war.
    // Wir nehmen die Daten vom 'user'-Objekt und packen sie in den JWT-Token.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id; // <-- KORREKTUR HINZUGEFÜGT
        token.role = user.role;
      }
      return token;
    },
    // Dieser Callback baut die finale Session zusammen, die im Frontend/Backend ankommt.
    // Wir nehmen die Daten aus dem Token und packen sie in das 'session.user'-Objekt.
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id; // <-- KORREKTUR HINZUGEFÜGT
        session.user.role = token.role as User['role'];
      }
      return session;
    },
  }
};
