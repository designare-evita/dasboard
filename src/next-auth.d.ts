// src/next-auth.d.ts

import 'next-auth';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
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
      role: 'USER' | 'ADMIN' | 'SUPERADMIN';
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
    role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  }
}
