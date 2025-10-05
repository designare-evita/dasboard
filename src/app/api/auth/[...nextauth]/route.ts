import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { getUserByEmail } from "@/lib/database";
import bcrypt from 'bcryptjs';
import { User } from "@/types"; // Importieren Sie den User-Typ

const handler = NextAuth({
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
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const user = await getUserByEmail(credentials.email);
        if (!user || !user.password) {
          return null;
        }

        const isPasswordCorrect = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordCorrect) {
          return null;
        }
        
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
      // Wenn der 'user' beim Login übergeben wird, fügen wir seine Rolle zum Token hinzu
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      // Wir fügen die Rolle aus dem Token zur Session hinzu,
      // damit sie im Frontend verfügbar ist.
      if (session?.user && token?.role) {
        session.user.role = token.role as User['role'];
      }
      return session;
    },
  }
})

export { handler as GET, handler as POST }
