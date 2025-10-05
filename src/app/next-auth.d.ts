// src/next-auth.d.ts

import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";
import { User as CustomUser } from "./types"; // Importiert unseren User-Typ aus src/types/index.ts

declare module "next-auth" {
  /**
   * Erweitert den Session-Typ.
   */
  interface Session {
    user: {
      id: string; // <-- HINZUGEFÜGT
      role: CustomUser['role'];
    } & DefaultSession["user"];
  }

  /**
   * Erweitert den User-Typ.
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
    id: string; // <-- HINZUGEFÜGT
    role: CustomUser['role'];
  }
}
