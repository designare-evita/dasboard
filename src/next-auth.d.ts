// src/next-auth.d.ts

import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";
import { User as CustomUser } from "./types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string; // Stellt sicher, dass 'id' im Session-User-Objekt bekannt ist
      role: CustomUser['role'];
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: CustomUser['role'];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string; // Stellt sicher, dass 'id' im JWT-Token bekannt ist
    role: CustomUser['role'];
  }
}
