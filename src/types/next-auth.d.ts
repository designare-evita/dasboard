import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";
import { User as CustomUser } from "."; // Importiert unseren User-Typ aus index.ts

declare module "next-auth" {
  /**
   * Erweitert den Session-Typ, um unsere 'role' Eigenschaft aufzunehmen.
   */
  interface Session {
    user: {
      role: CustomUser['role'];
    } & DefaultSession["user"];
  }

  /**
   * Erweitert den User-Typ, der vom authorize-Callback zurückgegeben wird.
   */
  interface User extends DefaultUser {
    role: CustomUser['role'];
  }
}

declare module "next-auth/jwt" {
  /**
   * Erweitert den JWT-Token-Typ.
   */
  interface JWT extends DefaultJWT {
    role: CustomUser['role'];
  }
}
