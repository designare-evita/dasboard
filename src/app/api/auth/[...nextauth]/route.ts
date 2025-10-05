import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

// Dies ist die zentrale Konfigurationsdatei für Ihre Authentifizierung.
// Wir fügen hier später die Logik hinzu, um Benutzer aus Ihrer Datenbank zu überprüfen.
const handler = NextAuth({
  providers: [
    CredentialsProvider({
      // The name to display on the sign in form (e.g. "Sign in with...")
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "test@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        // Hier kommt die Logik hin, um den Benutzer in der Datenbank zu suchen
        // Für den Moment geben wir einfach einen Beispiel-Benutzer zurück, damit es funktioniert.
        const user = { id: "1", name: "Test User", email: "test@example.com" }

        if (user) {
          // Any object returned will be saved in `user` property of the JWT
          return user
        } else {
          // If you return null then an error will be displayed
          return null
        }
      }
    })
  ],
  // Hier können später weitere Konfigurationen wie Session-Strategie etc. folgen
})

// NextAuth.js exportiert die GET und POST Handler für uns.
export { handler as GET, handler as POST }
