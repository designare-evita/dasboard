// src/app/admin/edit/[id]/EditUserForm.tsx
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // ✅ NEU: Router importiert
import { User } from '@/types';
import { Pencil, ArrowRepeat, CheckCircle } from 'react-bootstrap-icons';

interface EditUserFormProps {
  user: User;
  // ✅ KORREKTUR: onUserUpdated Prop entfernt
}

export default function EditUserForm({ user }: EditUserFormProps) {
  const router = useRouter(); // ✅ NEU: Router Hook

  // ✅ Form States - Alle Felder explizit
  const [formData, setFormData] = useState({
    email: '',
    mandantId: '',
    permissions: '',
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
        mandant_id: user.mandant_id,
        permissions: user.permissions,
        domain: user.domain,
      });

      setFormData({
        email: user.email || '',
        mandantId: user.mandant_id || '',
        permissions: user.permissions?.join(', ') || '',
        domain: user.domain || '',
        gscSiteUrl: user.gsc_site_url || '',
        ga4PropertyId: user.ga4_property_id || '',
        semrushProjectId: user.semrush_project_id || '',
        semrushTrackingId: user.semrush_tracking_id || '',
        semrushTrackingId02: user.semrush_tracking_id_02 || '',
      });
      
      setPassword('');
      setMessage('');
      setSuccessMessage('');
    }
  }, [user]);

  // ✅ Handle Input Changes
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ✅ Submit Handler
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('💾 Speichere Änderungen...');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const isCustomer = user.role === 'BENUTZER';
      const permissionsArray = formData.permissions.split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      const payload: Record<string, string | string[] | null> = {
        email: formData.email,
        mandant_id: formData.mandantId || null,
        permissions: permissionsArray,
      };

      if (isCustomer) {
        payload.domain = formData.domain || null;
        payload.gsc_site_url = formData.gscSiteUrl || null;
        payload.ga4_property_id = formData.ga4PropertyId || null;
        payload.semrush_project_id = formData.semrushProjectId || null;
        payload.semrush_tracking_id = formData.semrushTrackingId || null;
        payload.semrush_tracking_id_02 = formData.semrushTrackingId02 || null;
      }

      if (password && password.trim().length > 0) {
        payload.password = password;
      }

      console.log('📤 Sende PUT Request mit Payload:');
      console.log(JSON.stringify(payload, null, 2));

      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        throw new Error('Serverfehler: Ungültige Antwort vom Server');
      }

      console.log('📥 Server Response:', result);

      if (!response.ok) {
        throw new Error(result.message || result.error || `HTTP ${response.status}: Ein Fehler ist aufgetreten.`);
      }

      // ✅ Success: Update lokale States mit Response
      setFormData({
        email: result.email || '',
        mandantId: result.mandant_id || '',
        permissions: result.permissions?.join(', ') || '',
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

      // ✅ NEU: router.refresh() direkt aufrufen statt Callback
      router.refresh();

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
        
        {/* E-Mail */}
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

        {/* Passwort */}
        <div>
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

        {/* Mandant & Berechtigungen */}
        <div className="border-t pt-4 mt-4">
          <label className="block text-sm font-medium text-gray-700">Mandant-ID (Label)</label>
          <input
            type="text"
            value={formData.mandantId}
            onChange={(e) => handleInputChange('mandantId', e.target.value)}
            placeholder="z.B. max-online"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Berechtigungen (Klasse)</label>
          <input
            type="text"
            value={formData.permissions}
            onChange={(e) => handleInputChange('permissions', e.target.value)}
            placeholder="z.B. kann_admins_verwalten, kann_exportieren"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
            disabled={isSubmitting}
          />
          <p className="mt-1 text-xs text-gray-500">
            Labels mit Komma trennen.
          </p>
        </div>

        {/* Kunden-spezifische Felder */}
        {user.role === 'BENUTZER' && (
          <>
            <div className="border-t pt-4 mt-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700">
                GSC Site URL
                {formData.gscSiteUrl && (
                  <span className="ml-2 text-xs text-green-600">✓ Gesetzt</span>
                )}
              </label>
              <input
                type="text"
                value={formData.gscSiteUrl}
                onChange={(e) => handleInputChange('gscSiteUrl', e.target.value)}
                placeholder="z.B. sc-domain:kundendomain.at"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
              {formData.gscSiteUrl && (
                <p className="mt-1 text-xs text-gray-500">Aktueller Wert: {formData.gscSiteUrl}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                GA4 Property ID
                {formData.ga4PropertyId && (
                  <span className="ml-2 text-xs text-green-600">✓ Gesetzt</span>
                )}
              </label>
              <input
                type="text"
                value={formData.ga4PropertyId}
                onChange={(e) => handleInputChange('ga4PropertyId', e.target.value)}
                placeholder="z.B. 123456789"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting}
              />
              {formData.ga4PropertyId && (
                <p className="mt-1 text-xs text-gray-500">Aktueller Wert: {formData.ga4PropertyId}</p>
              )}
            </div>

            <fieldset className="border-t pt-4 mt-4">
              <div className="mb-4">
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

              <div className="mb-4">
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

        {/* Button & Messages */}
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

        {successMessage && (
          <p className="text-sm text-green-600 font-medium mt-4 p-3 bg-green-50 rounded border border-green-200">
            {successMessage}
          </p>
        )}

        {message && !successMessage && (
          <p className="text-sm text-red-600 font-medium mt-4 p-3 bg-red-50 rounded border border-red-200">
            {message}
          </p>
        )}
      </form>

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
                  mandant_id: user.mandant_id,
                  permissions: user.permissions,
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
