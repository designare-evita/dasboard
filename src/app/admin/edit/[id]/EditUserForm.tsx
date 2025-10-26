'use client';

import { useState, FormEvent, useEffect } from 'react';
import { User } from '@/types';
import { Pencil, ArrowRepeat, CheckCircle } from 'react-bootstrap-icons';

export default function EditUserForm({ id, user, onUserUpdated }: { id?: string, user: User, onUserUpdated?: () => void }) {
  const [email, setEmail] = useState(user.email || '');
  const [domain, setDomain] = useState(user.domain || '');
  const [gscSiteUrl, setGscSiteUrl] = useState(user.gsc_site_url || '');
  const [ga4PropertyId, setGa4PropertyId] = useState(user.ga4_property_id || '');
  
  // --- NEUE STATES HINZUFÜGEN ---
  const [semrushProjectId, setSemrushProjectId] = useState(user.semrush_project_id || '');
  const [semrushTrackingId, setSemrushTrackingId] = useState(user.semrush_tracking_id || '');
  // ------------------------------

  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dieser useEffect ist wichtig, falls sich die `user` ändert
  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setDomain(user.domain || '');
      setGscSiteUrl(user.gsc_site_url || '');
      setGa4PropertyId(user.ga4_property_id || '');
      
      // --- NEUE STATES FÜLLEN ---
      setSemrushProjectId(user.semrush_project_id || '');
      setSemrushTrackingId(user.semrush_tracking_id || '');
      // --------------------------
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('Speichere Änderungen...');
    setIsSubmitting(true);

    // --- PAYLOAD ERWEITERN ---
    const payload = {
      email,
      domain: user.role === 'BENUTZER' ? domain : null,
      gsc_site_url: user.role === 'BENUTZER' ? gscSiteUrl : null,
      ga4_property_id: user.role === 'BENUTZER' ? ga4PropertyId : null,
      semrush_project_id: user.role === 'BENUTZER' ? semrushProjectId : null,
      semrush_tracking_id: user.role === 'BENUTZER' ? semrushTrackingId : null,
    };
    // -------------------------

    console.log('Sending payload:', payload); // Debug-Log

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Versuche die Response zu parsen, auch wenn sie fehlschlägt
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        throw new Error('Serverfehler: Ungültige Antwort vom Server');
      }

      console.log('Server response:', result); // Debug-Log

      if (!response.ok) {
        throw new Error(result.message || result.error || `HTTP ${response.status}: Ein Fehler ist aufgetreten.`);
      }

      setMessage('Benutzer erfolgreich aktualisiert!');
      if (onUserUpdated) {
        onUserUpdated(); // Daten auf der Hauptseite neu laden
      }
    } catch (error) {
      console.error('Update error:', error); // Debug-Log
      setMessage(`Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Pencil size={20} /> Benutzerinformationen bearbeiten
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* E-Mail */}
        <div>
          <label className="block text-sm font-medium text-gray-700">E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          />
        </div>

        {/* Spezifische Kunden-Felder */}
        {user.role === 'BENUTZER' && (
          <>
            {/* Domain */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Domain</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="kundendomain.at"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
            </div>

            {/* GSC Site URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700">GSC Site URL</label>
              <input
                type="text"
                value={gscSiteUrl}
                onChange={(e) => setGscSiteUrl(e.target.value)}
                placeholder="Optional"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
            </div>

            {/* GA4 Property ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700">GA4 Property ID (nur Nummer)</label>
              <input
                type="text"
                value={ga4PropertyId}
                onChange={(e) => setGa4PropertyId(e.target.value)}
                placeholder="Optional"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
            </div>

            {/* --- NEUES FELD: Semrush Projekt ID --- */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Semrush Projekt ID</label>
              <input
                type="text"
                value={semrushProjectId}
                onChange={(e) => setSemrushProjectId(e.target.value)}
                placeholder="Optional"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
            </div>

            {/* --- NEUES FELD: Semrush Tracking-ID --- */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Semrush Tracking-ID</label>
              <input
                type="text"
                value={semrushTrackingId}
                onChange={(e) => setSemrushTrackingId(e.target.value)}
                placeholder="Optional"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
            </div>
          </>
        )}

        {/* Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 font-normal text-white bg-[#188bdb] border-[3px] border-[#188bdb] rounded-[3px] hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#188bdb] disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <ArrowRepeat className="animate-spin" size={18} />
          ) : (
            <CheckCircle size={18} />
          )}
          <span>{isSubmitting ? 'Wird gespeichert...' : 'Änderungen speichern'}</span>
        </button>

        {message && <p className="text-sm text-gray-600 mt-4">{message}</p>}
      </form>
    </div>
  );
}
