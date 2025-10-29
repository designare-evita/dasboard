'use client';

import { useState, FormEvent, useEffect } from 'react';
import { User } from '@/types';
import { Pencil, ArrowRepeat, CheckCircle } from 'react-bootstrap-icons';

interface EditUserFormProps {
  user: User;
  onUserUpdated?: () => void;
}

export default function EditUserForm({ user, onUserUpdated }: EditUserFormProps) {
  // ✅ Form States - Alle Felder explizit
  const [formData, setFormData] = useState({
    email: '',
    domain: '',
    gscSiteUrl: '',
    ga4PropertyId: '',
    semrushProjectId: '',
    semrushTrackingId: '',
    semrushTrackingId02: '',
  });

  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // ✅ Beim Component Mount oder User Change: State aus User Daten füllen
  useEffect(() => {
    if (user) {
      console.log('📋 EditUserForm - User empfangen:', {
        id: user.id,
        email: user.email,
        domain: user.domain,
        semrush_project_id: user.semrush_project_id,
        semrush_tracking_id: user.semrush_tracking_id,
        semrush_tracking_id_02: user.semrush_tracking_id_02,
      });

      // ✅ Alle Felder mit Fallback auf leeren String
      setFormData({
        email: user.email || '',
        domain: user.domain || '',
        gscSiteUrl: user.gsc_site_url || '',
        ga4PropertyId: user.ga4_property_id || '',
        semrushProjectId: user.semrush_project_id || '',
        semrushTrackingId: user.semrush_tracking_id || '',
        semrushTrackingId02: user.semrush_tracking_id_02 || '',
      });

      console.log('✅ Form States aktualisiert:');
      console.log('  Email:', user.email);
      console.log('  Domain:', user.domain);
      console.log('  Semrush Project ID:', user.semrush_project_id);
      console.log('  Semrush Tracking ID:', user.semrush_tracking_id);
      console.log('  Semrush Tracking ID 02:', user.semrush_tracking_id_02);
      
      setPassword('');
      setMessage('');
      setSuccessMessage('');
    }
  }, [user]);

  // ✅ Handle Input Changes - alle Felder
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Debug Logging für semrushTrackingId02
    if (field === 'semrushTrackingId02') {
      console.log('📝 semrushTrackingId02 geändert auf:', value);
    }
  };

  // ✅ Submit Handler
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('💾 Speichere Änderungen...');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      // ✅ Payload mit SNAKE_CASE für API
      // Wichtig: Benutzer hat Rolle BENUTZER oder andere
      const isCustomer = user.role === 'BENUTZER';

      const payload: Record<string, string | number | null> = {
        email: formData.email,
      };

      // ✅ Nur für Kunden: Zusätzliche Felder setzen
      if (isCustomer) {
        payload.domain = formData.domain || null;
        payload.gsc_site_url = formData.gscSiteUrl || null;
        payload.ga4_property_id = formData.ga4PropertyId || null;
        payload.semrush_project_id = formData.semrushProjectId || null;
        payload.semrush_tracking_id = formData.semrushTrackingId || null;
        payload.semrush_tracking_id_02 = formData.semrushTrackingId02 || null;
      }

      // ✅ Passwort nur wenn gefüllt
      if (password && password.trim().length > 0) {
        payload.password = password;
      }

      console.log('📤 Sende PUT Request mit Payload:');
      console.log(JSON.stringify(payload, null, 2));
      console.log('   semrush_tracking_id_02 =', payload.semrush_tracking_id_02);

      // ✅ API Call
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // ✅ Response parsen
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        throw new Error('Serverfehler: Ungültige Antwort vom Server');
      }

      console.log('📥 Server Response:', result);
      console.log('   semrush_tracking_id_02 im Response =', result.semrush_tracking_id_02);

      // ✅ Error Check
      if (!response.ok) {
        throw new Error(result.message || result.error || `HTTP ${response.status}: Ein Fehler ist aufgetreten.`);
      }

      // ✅ Success: Update lokale States mit Response
      // 🔴 WICHTIG: Die formData mit Response aktualisieren, bevor onUserUpdated aufgerufen wird
      setFormData({
        email: result.email || '',
        domain: result.domain || '',
        gscSiteUrl: result.gsc_site_url || '',
        ga4PropertyId: result.ga4_property_id || '',
        semrushProjectId: result.semrush_project_id || '',
        semrushTrackingId: result.semrush_tracking_id || '',
        semrushTrackingId02: result.semrush_tracking_id_02 || '',
      });

      setPassword('');
      setMessage('');
      setSuccessMessage('✅ Benutzer erfolgreich aktualisiert!');

      console.log('✅ Success! Form States mit Response aktualisiert');
      console.log('✅ Lokale formData nach Update:', {
        semrushTrackingId02: result.semrush_tracking_id_02
      });

      // ⏱️ WICHTIG: Callback NACH formData Update, damit die lokal gespeicherten Daten erhalten bleiben
      if (onUserUpdated) {
        console.log('📞 Rufe onUserUpdated Callback auf...');
        // Gib dem Callback den aktualisierten User zurück, falls nötig
        onUserUpdated();
      }

      // ✅ Success Message nach 3 Sekunden clearen
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error) {
      console.error('❌ Update Error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      setMessage(`❌ Fehler: ${errorMsg}`);
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
        
        {/* ========== E-Mail (Alle Rollen) ========== */}
        <div>
          <label className="block text-sm font-medium text-gray-700">E-Mail *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          />
        </div>

        {/* ========== Kunden-spezifische Felder (nur für BENUTZER) ========== */}
        {user.role === 'BENUTZER' && (
          <>
            {/* Domain */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Domain</label>
              <input
                type="text"
                value={formData.domain}
                onChange={(e) => handleInputChange('domain', e.target.value)}
                placeholder="z.B. www.kundendomain.at"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
            </div>

            {/* GSC Site URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700">GSC Site URL</label>
              <input
                type="text"
                value={formData.gscSiteUrl}
                onChange={(e) => handleInputChange('gscSiteUrl', e.target.value)}
                placeholder="z.B. sc-domain:kundendomain.at"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
            </div>

            {/* GA4 Property ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700">GA4 Property ID</label>
              <input
                type="text"
                value={formData.ga4PropertyId}
                onChange={(e) => handleInputChange('ga4PropertyId', e.target.value)}
                placeholder="z.B. 123456789"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
            </div>

            {/* ========== SEMRUSH SECTION ========== */}
            <fieldset className="border-t pt-4 mt-4">
              <legend className="text-sm font-bold text-gray-900 mb-3">📊 Semrush Einstellungen</legend>

              {/* Semrush Projekt ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Semrush Projekt ID
                  {formData.semrushProjectId && (
                    <span className="ml-2 text-xs text-green-600">✓ Gesetzt</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.semrushProjectId}
                  onChange={(e) => handleInputChange('semrushProjectId', e.target.value)}
                  placeholder="z.B. 12920575"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                  disabled={isSubmitting}
                />
                {formData.semrushProjectId && (
                  <p className="mt-1 text-xs text-gray-500">Aktueller Wert: {formData.semrushProjectId}</p>
                )}
              </div>

              {/* Semrush Tracking-ID (Kampagne 1) */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Semrush Tracking-ID (Kampagne 1)
                  {formData.semrushTrackingId && (
                    <span className="ml-2 text-xs text-green-600">✓ Gesetzt</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.semrushTrackingId}
                  onChange={(e) => handleInputChange('semrushTrackingId', e.target.value)}
                  placeholder="z.B. 1209408"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                  disabled={isSubmitting}
                />
                {formData.semrushTrackingId && (
                  <p className="mt-1 text-xs text-gray-500">Aktueller Wert: {formData.semrushTrackingId}</p>
                )}
              </div>

              {/* ✅ Semrush Tracking-ID 02 (Kampagne 2) */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Semrush Tracking-ID (Kampagne 2)
                  {formData.semrushTrackingId02 && (
                    <span className="ml-2 text-xs text-green-600">✓ Gesetzt</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.semrushTrackingId02}
                  onChange={(e) => handleInputChange('semrushTrackingId02', e.target.value)}
                  placeholder="z.B. 1209491"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                  disabled={isSubmitting}
                />
                {formData.semrushTrackingId02 && (
                  <p className="mt-1 text-xs text-gray-500">Aktueller Wert: {formData.semrushTrackingId02}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">Optional: Für eine zweite Kampagne/Tracking</p>
              </div>
            </fieldset>
          </>
        )}

        {/* ========== Passwort (Optional) ========== */}
        <div className="border-t pt-4 mt-4">
          <label className="block text-sm font-medium text-gray-700">
            Passwort (Optional - leer lassen um nicht zu ändern)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nur ausfüllen wenn Passwort geändert werden soll"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
            disabled={isSubmitting}
          />
        </div>

        {/* ========== Button & Messages ========== */}
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

        {/* Success Message */}
        {successMessage && (
          <p className="text-sm text-green-600 font-medium mt-4 p-3 bg-green-50 rounded border border-green-200">
            {successMessage}
          </p>
        )}

        {/* Error Message */}
        {message && !successMessage && (
          <p className="text-sm text-red-600 font-medium mt-4 p-3 bg-red-50 rounded border border-red-200">
            {message}
          </p>
        )}
      </form>

      {/* ========== Debug Section (In Entwicklung) ========== */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-6 pt-4 border-t border-gray-300">
          <summary className="text-xs font-bold text-gray-500 cursor-pointer hover:text-gray-700">
            🔍 Debug Info (Development Only)
          </summary>
          <pre className="mt-3 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-96">
            {JSON.stringify(
              {
                user: {
                  id: user.id,
                  email: user.email,
                  role: user.role,
                  semrush_tracking_id_02: user.semrush_tracking_id_02,
                },
                formData,
              },
              null,
              2
            )}
          </pre>
        </details>
      )}
    </div>
  );
}
