'use client'; // Wichtig: Macht dies zu einer interaktiven Komponente

import React, { useState } from 'react';

export default function TestPage() {
  const [data, setData] = useState<object | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTestClick = async () => {
    setLoading(true);
    setData(null);
    setError(null);
    try {
      const response = await fetch('/api/test-google');
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Ein unbekannter Fehler ist aufgetreten');
      }
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Google API Testseite</h1>
      <button onClick={handleTestClick} disabled={loading} style={{ padding: '10px 20px', cursor: 'pointer' }}>
        {loading ? 'Teste...' : 'Google Schnittstelle testen'}
      </button>

      {error && <div style={{ color: 'red', marginTop: '1rem' }}><h2>Fehler:</h2><pre>{error}</pre></div>}
      
      {data && (
        <div style={{ marginTop: '1rem', background: '#f0f0f0', padding: '1rem' }}>
          <h2>Ergebnis:</h2>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
