// src/app/admin/edit/[id]/EditUserForm.tsx
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { User } from '@/types'; // Stelle sicher, dass User in @/types auch 'semrush_tracking_id_02' enthält
import { Pencil, ArrowRepeat, CheckCircle, InfoCircleFill } from 'react-bootstrap-icons';

// Props-Typ für die Komponente definieren
interface EditUserFormProps {
  user: User; // User-Objekt mit allen Daten
  onUserUpdated?: () => void; // Optionale Callback-Funktion nach erfolgreichem Update
}

export default function EditUserForm({ user, onUserUpdated }: EditUserFormProps) {
  // --- State Hooks ---
  // Verwende user-Objekt, um initiale Werte zu setzen
  const [email, setEmail] = useState(user.email || '');
  const [domain, setDomain] = useState(user.domain || '');
  const [gscSiteUrl, setGscSiteUrl] = useState(user.gsc_site_url || '');
  const [ga4PropertyId, setGa4PropertyId] = useState(user.ga4_property_id || '');
  const [semrushProjectId, setSemrushProjectId] = useState(user.semrush_project_id || '');
  const [semrushTrackingId, setSemrushTrackingId] = useState(user.semrush_tracking_id || '');
  // NEU: State für die zweite Tracking ID
  const [semrushTrackingId02, setSemrushTrackingId02] = useState(user.semrush_tracking_id_02 || '');

  const [message, setMessage] = useState(''); // Für Erfolgs- oder Fehlermeldungen
  const [isSubmitting, setIsSubmitting] = useState(false); // Für Ladezustand des Buttons

  // --- useEffect Hooks ---

  // Dieser Hook synchronisiert den State, falls sich das `user`-Prop von außen ändert.
  // Das ist wichtig, wenn die übergeordnete Komponente die Daten neu lädt.
  useEffect(() => {
    // Überprüfe, ob sich die Daten tatsächlich geändert haben, um unnötige Updates zu vermeiden
    if (user) {
      if (user.email !== email) setEmail(user.email || '');
      if (user.domain !== domain) setDomain(user.domain || '');
      if (user.gsc_site_url !== gscSiteUrl) setGscSiteUrl(user.gsc_site_url || '');
      if (user.ga4_property_id !== ga4PropertyId) setGa4PropertyId(user.ga4_property_id || '');
      if (user.semrush_project_id !== semrushProjectId) setSemrushProjectId(user.semrush_project_id || '');
      if (user.semrush_tracking_id !== semrushTrackingId) setSemrushTrackingId(user.semrush_tracking_id || '');
      // NEU: Zweite Tracking ID synchronisieren
      if (user.semrush_tracking_id_02 !== semrushTrackingId02) setSemrushTrackingId02(user.semrush_tracking_id_02 || '');

      console.log('🔄 EditUserForm - State synchronisiert mit User-Props:', {
          email: user.email,
          domain: user.domain,
          semrushProjectId: user.semrush_project_id,
          semrushTrackingId: user.semrush_tracking_id,
          semrushTrackingId02: user.semrush_tracking_id_02, // NEU
      });
    }
    // Füge alle State-Variablen zu den Abhängigkeiten hinzu, die von `user` abhängen.
  }, [user, email, domain, gscSiteUrl, ga4PropertyId, semrushProjectId, semrushTrackingId, semrushTrackingId02]);


  // --- Event Handler ---

  // Wird aufgerufen, wenn das Formular abgesendet wird
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Verhindert Standard-Formular-Absendung
    setMessage('Speichere Änderungen...');
    setIsSubmitting(true);
    setMessage(''); // Alte Nachrichten löschen

    // Payload für die API erstellen
    const payload = {
      email, // E-Mail ist immer vorhanden
      // Optionale Felder nur senden, wenn der Benutzer die Rolle 'BENUTZER' hat
      domain: user.role === 'BENUTZER' ? domain : undefined,
      gsc_site_url: user.role === 'BENUTZER' ? gscSiteUrl : undefined,
      ga4_property_id: user.role === 'BENUTZER' ? ga4PropertyId : undefined,
      semrush_project_id: user.role === 'BENUTZER' ? semrushProjectId : undefined,
      semrush_tracking_id: user.role === 'BENUTZER' ? semrushTrackingId : undefined,
      semrush_tracking_id_02: user.role === 'BENUTZER' ? semrushTrackingId02 : undefined, // NEU
      // Passwort wird hier nicht geändert, das sollte separat erfolgen (falls benötigt)
    };

    console.log('📤 Sende Payload an API:', payload);

    try {
      // API-Aufruf zum Aktualisieren des Benutzers
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Verarbeite die Antwort der API
      let result;
      try {
        result = await response.json(); // Versuche, JSON zu parsen
      } catch (parseError) {
        // Falls die Antwort kein gültiges JSON ist (z.B. bei Serverfehler 500)
        console.error('JSON Parse Error:', parseError);
        const textResponse = await response.text(); // Lese Antwort als Text
        throw new Error(`Serverfehler (${response.status}): ${textResponse || 'Keine Antwort erhalten'}`);
      }

      console.log('📥 Server-Antwort:', result);

      // Überprüfe, ob die Anfrage erfolgreich war (Status 2xx)
      if (!response.ok) {
        throw new Error(result.message || result.error || `HTTP ${response.status}: Ein Fehler ist aufgetreten.`);
      }

      // Erfolgsmeldung anzeigen
      setMessage('✅ Benutzer erfolgreich aktualisiert!');
      // Optional: Callback aufrufen, um die übergeordnete Seite zu informieren
      if (onUserUpdated) {
        onUserUpdated();
      }
      // Erfolgsmeldung nach 3 Sekunden ausblenden
      setTimeout(() => setMessage(''), 3000);

    } catch (error) {
      console.error('❌ Update-Fehler:', error);
      // Fehlermeldung anzeigen
      setMessage(`Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setIsSubmitting(false); // Ladezustand beenden
    }
  };

  // --- JSX Rendering ---
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      {/* Titel */}
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 border-b pb-3 text-gray-800">
        <Pencil size={20} /> Benutzerinformationen bearbeiten
      </h2>

      {/* Erfolgs-/Fehlermeldung */}
      {message && (
          <div className={`my-4 p-3 border rounded-md text-sm flex items-center gap-2 ${
            message.startsWith('Fehler:')
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-green-50 border-green-200 text-green-800'
          }`}>
              <InfoCircleFill size={16}/>
              {message}
          </div>
      )}

      {/* Formular */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* E-Mail (für alle Rollen sichtbar) */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          />
        </div>

        {/* Zusätzliche Felder nur für Kunden (Rolle 'BENUTZER') */}
        {user.role === 'BENUTZER' && (
          <>
            {/* Domain */}
            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
              <input
                id="domain"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="kundendomain.at"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
            </div>

            {/* GSC Site URL */}
            <div>
              <label htmlFor="gscSiteUrl" className="block text-sm font-medium text-gray-700 mb-1">GSC Site URL</label>
              <input
                id="gscSiteUrl"
                type="text"
                value={gscSiteUrl}
                onChange={(e) => setGscSiteUrl(e.target.value)}
                placeholder="Optional (z.B. https://kundendomain.at/)"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
            </div>

            {/* GA4 Property ID */}
            <div>
              <label htmlFor="ga4PropertyId" className="block text-sm font-medium text-gray-700 mb-1">GA4 Property ID (nur Nummer)</label>
              <input
                id="ga4PropertyId"
                type="text"
                value={ga4PropertyId}
                onChange={(e) => setGa4PropertyId(e.target.value)}
                placeholder="Optional"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
            </div>

            {/* Semrush Projekt ID */}
            <div>
              <label htmlFor="semrushProjectId" className="block text-sm font-medium text-gray-700 mb-1">
                Semrush Projekt ID
                {/* Zeigt grünes Häkchen, wenn ein Wert vorhanden ist */}
                {semrushProjectId && (
                  <span className="ml-2 text-xs text-green-600 font-semibold">(✓ Gesetzt)</span>
                )}
              </label>
              <input
                id="semrushProjectId"
                type="text"
                value={semrushProjectId}
                onChange={(e) => setSemrushProjectId(e.target.value)}
                placeholder="Optional"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
              {/* Zeigt den aktuell gespeicherten Wert (nur informativ) */}
              {user.semrush_project_id && (
                <p className="mt-1 text-xs text-gray-500">Aktuell gespeichert: {user.semrush_project_id}</p>
              )}
            </div>

            {/* Semrush Tracking-ID 1 */}
            <div>
              <label htmlFor="semrushTrackingId" className="block text-sm font-medium text-gray-700 mb-1">
                Semrush Tracking-ID (z.B. AT)
                {semrushTrackingId && (
                  <span className="ml-2 text-xs text-green-600 font-semibold">(✓ Gesetzt)</span>
                )}
              </label>
              <input
                id="semrushTrackingId"
                type="text"
                value={semrushTrackingId}
                onChange={(e) => setSemrushTrackingId(e.target.value)}
                placeholder="Optional (z.B. für AT)"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
              {user.semrush_tracking_id && (
                <p className="mt-1 text-xs text-gray-500">Aktuell gespeichert: {user.semrush_tracking_id}</p>
              )}
            </div>

            {/* NEU: Semrush Tracking-ID 2 */}
            <div>
              <label htmlFor="semrushTrackingId02" className="block text-sm font-medium text-gray-700 mb-1">
                Semrush Tracking-ID 02 (z.B. USA)
                {semrushTrackingId02 && (
                  <span className="ml-2 text-xs text-green-600 font-semibold">(✓ Gesetzt)</span>
                )}
              </label>
              <input
                id="semrushTrackingId02"
                type="text"
                value={semrushTrackingId02}
                onChange={(e) => setSemrushTrackingId02(e.target.value)}
                placeholder="Optional (z.B. für USA)"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
              {user.semrush_tracking_id_02 && (
                <p className="mt-1 text-xs text-gray-500">Aktuell gespeichert: {user.semrush_tracking_id_02}</p>
              )}
            </div>
          </>
        )}

        {/* Speicher-Button */}
        <div className="pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2 font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <ArrowRepeat className="animate-spin" size={18} />
              ) : (
                <CheckCircle size={18} />
              )}
              <span>{isSubmitting ? 'Wird gespeichert...' : 'Änderungen speichern'}</span>
            </button>
        </div>
      </form>
    </div>
  );
}
