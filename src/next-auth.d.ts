// src/next-auth.d.ts
import 'next-auth';
// KORREKTUR 1: DefaultUser importieren
import { DefaultSession, User as DefaultUser } from 'next-auth';

declare module 'next-auth' {
  
  /**
   * KORREKTUR 2: Die User-Schnittstelle erweitern.
   * Dies ist der Typ, der vom `authorize`-Callback zurückgegeben
   * und an den `jwt`-Callback beim Login übergeben wird.
   */
  interface User extends DefaultUser {
    role: 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
    mandant_id?: string | null;
    permissions?: string[];
    logo_url?: string | null;
    gsc_site_url?: string | null;
    is_demo?: boolean; // <--- NEU
  }

  /**
   * Extends the built-in session type to include our custom properties.
   */
  interface Session {
    // These are the properties we are adding
    accessToken?: string;
    refreshToken?: string;

    // This extends the existing user object
    user: {
      id: string;
      role: 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
      mandant_id?: string | null;
      permissions?: string[];
      logo_url?: string | null;
      gsc_site_url?: string | null; // ✅ HINZUGEFÜGT
      is_demo?: boolean; // <--- NEU
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extends the built-in JWT type.
   */
  interface JWT {
    id: string;
    accessToken?: string;
    refreshToken?: string;
    role: 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
    mandant_id?: string | null;
    permissions?: string[];
    logo_url?: string | null;
    gsc_site_url?: string | null; // ✅ HINZUGEFÜGT
    is_demo?: boolean; // <--- NEU
  }
}
