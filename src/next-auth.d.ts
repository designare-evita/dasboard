// src/next-auth.d.ts
import { DefaultSession, User as DefaultUser } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Erweiterung des User-Objekts (wie es aus der DB kommt)
   */
  interface User extends DefaultUser {
    id: string;
    role: 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
    mandant_id?: string | null;
    permissions?: string[];
    logo_url?: string | null;
    gsc_site_url?: string | null;
    redaktionsplan_url?: string | null; // NEU: Feld aus der Datenbank
  }

  /**
   * Erweiterung der Session (was im Frontend verfügbar ist)
   */
  interface Session {
    user: {
      id: string;
      role: 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
      mandant_id?: string | null;
      permissions?: string[];
      logo_url?: string | null;
      gsc_site_url?: string | null;
      hasRedaktionsplan: boolean; // NEU: Berechnetes Flag für den Button
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  /**
   * Erweiterung des JWT Tokens
   */
  interface JWT extends DefaultJWT {
    id: string;
    role: 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
    mandant_id?: string | null;
    permissions?: string[];
    logo_url?: string | null;
    gsc_site_url?: string | null;
    hasRedaktionsplan: boolean; // NEU
  }
}
