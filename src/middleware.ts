// src/middleware.ts
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role; // 'SUPERADMIN', 'ADMIN', 'BENUTZER'

  // 1. Ausnahmen definieren (Pfade, die immer erreichbar sein müssen)
  const isApiRoute = nextUrl.pathname.startsWith('/api');
  const isLoginRoute = nextUrl.pathname.startsWith('/login');
  const isMaintenancePage = nextUrl.pathname === '/maintenance';
  const isStaticAsset = nextUrl.pathname.match(/\.(.*)$/); // Bilder, CSS etc.

  // Wenn es eine API, Login oder statische Datei ist -> Durchlassen
  if (isApiRoute || isLoginRoute || isStaticAsset) {
    return;
  }

  // 2. Wartungsmodus Status prüfen
  let maintenanceActive = false;
  try {
    // Effiziente Abfrage (Edge Compatible)
    const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'maintenance_mode'`;
    maintenanceActive = rows[0]?.value === 'true';
  } catch (e) {
    console.error('Middleware DB Error:', e);
    // Im Fehlerfall lassen wir den Zugriff zu, um Lockouts zu vermeiden
  }

  // 3. Logik anwenden
  if (maintenanceActive) {
    // Wenn User SUPERADMIN ist -> Zugriff ERLAUBEN
    if (isLoggedIn && userRole === 'SUPERADMIN') {
      // Optional: Hinweis im Header setzen (für Debugging)
      const res = NextResponse.next();
      res.headers.set('x-maintenance-mode', 'active-but-bypassed');
      return res;
    }

    // Für alle anderen -> Redirect zur Wartungsseite (falls wir nicht schon da sind)
    if (!isMaintenancePage) {
      return NextResponse.redirect(new URL('/maintenance', nextUrl));
    }
  } else {
    // Wenn Wartungsmodus AUS ist, aber User noch auf /maintenance ist -> Zurück zum Start
    if (isMaintenancePage) {
      return NextResponse.redirect(new URL('/', nextUrl));
    }
  }

  // Standard NextAuth Verhalten
  return; 
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
