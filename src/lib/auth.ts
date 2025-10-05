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
        
        // Die 'authorize'-Funktion gibt die 'id' korrekt zurück
        return { 
          id: user.id, 
          email: user.email, 
          role: user.role 
        };
      }
    })
  ],
  callbacks: {
    // Dieser Callback muss die 'id' vom 'user' in den 'token' übernehmen
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id; // Diese Zeile ist entscheidend
        token.role = user.role;
      }
      return token;
    },
    // Dieser Callback muss die 'id' vom 'token' in die 'session' übernehmen
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id; // Diese Zeile ist entscheidend
        session.user.role = token.role as User['role'];
      }
      return session;
    },
  }
};
