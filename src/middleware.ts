export { default } from "next-auth/middleware"

// Hier legen wir fest, welche Seiten geschützt werden sollen.
// Der "matcher" sorgt dafür, dass die Middleware auf diesen Routen läuft.
export const config = { 
  matcher: [
    /*
     * Alles schützen, außer:
     * - Die API-Routen
     * - Interne Next.js-Pfade (_next/...)
     * - Statische Dateien (z.B. favicon.ico)
     * - Unsere Login-Seite
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ] 
}
