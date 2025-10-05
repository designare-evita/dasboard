'use client'; // Diese Seite ist interaktiv und läuft im Browser

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        redirect: false, // Wir leiten manuell weiter, um Fehler besser zu behandeln
        email,
        password,
      });

      if (result?.error) {
        setError('Login fehlgeschlagen. Überprüfen Sie Ihre E-Mail und Ihr Passwort.');
        setLoading(false);
      } else {
        // Login erfolgreich, weiterleiten zum Dashboard
        router.push('/'); 
      }
    } catch (err) {
      setError('Ein unerwarteter Fehler ist aufgetreten.');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto' }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="email">E-Mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="password">Passwort</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '10px 20px' }}>
          {loading ? 'Anmelden...' : 'Anmelden'}
        </button>
      </form>
    </div>
  );
}
