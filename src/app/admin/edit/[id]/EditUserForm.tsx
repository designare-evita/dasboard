// src/app/admin/edit/[id]/EditUserForm.tsx
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { User } from '@/types';
// ✅ NEUE ICONS HINZUGEFÜGT (aus Version 2)
import { 
  Pencil, 
  ArrowRepeat, 
  CheckCircle, 
  CalendarEvent, 
  ClockHistory 
} from 'react-bootstrap-icons';

interface EditUserFormProps {
  user: User;
  onUserUpdated?: () => void;
  isSuperAdmin: boolean; // Info, ob der EINGELOGGTE Benutzer Superadmin ist
}

// ✅ NEU: Hilfsfunktion, um Datum in 'YYYY-MM-DD' zu formatieren (aus Version 2)
const formatDateForInput = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  try {
    const d = new Date(date);
    // Korrigiert Zeitzonen-Probleme, indem lokales Datum genommen wird
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return '';
  }
};


export default function EditUserForm({ user, onUserUpdated, isSuperAdmin }: EditUserFormProps) {
  // ✅ NEUE FELDER IM STATE (aus Version 2)
  const [formData, setFormData] = useState({
    email: '',
    mandantId: '',
    permissions: '', // (als Komma-getrennter String)
    domain: '',
    gscSiteUrl: '',
    ga4PropertyId: '',
    semrushProjectId: '',
    semrushTrackingId: '',
    semrushTrackingId02: '',
    favicon_url: '',
    project_start_date: '',    // ✅ NEU
    project_duration_months: '6', // ✅ NEU (Standard 6)
  });

  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // ✅ USEEFFECT ANGEPASST (aus Version 2)
  useEffect(() => {
    if (user) {
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
        favicon_url: user.favicon_url || '',
        project_start_date: formatDateForInput(user.project_start_date), // ✅ NEU
        project_duration_months: String(user.project_duration_months || 6), // ✅ NEU
      });
      setPassword('');
      setMessage('');
      setSuccessMessage('');
    }
  }, [user]);

  // (handleInputChange - Unverändert)
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ✅ HANDLESUBMIT ANGEPASST (Kombination aus Version 1 & 2)
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('💾 Speichere Änderungen...');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const permissionsArray = formData.permissions.split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      // (Typ 'any' aus Version 2 übernommen, um gemischte Typen (string, int, array) zu erlauben)
      const payload: Record<string, any> = {
        email: formData.email,
        mandant_id: formData.mandantId || null,
        permissions: (isSuperAdmin && user.role === 'ADMIN') ? permissionsArray : null,
        
        domain: formData.domain || null,
        gsc_site_url: formData.gscSiteUrl || null,
        ga4_property_id: formData.ga4PropertyId || null,
        favicon_url: formData.favicon_url || null,
        
        semrush_project_id: formData.semrushProjectId || null,
        semrush_tracking_id: formData.semrushTrackingId || null,
        semrush_tracking_id_02: formData.semrushTrackingId02 || null,

        // ✅ NEUE FELDER (aus Version 2)
        project_start_date: formData.project_start_date || null,
        project_duration_months: parseInt(formData.project_duration_months, 10) || 6,
      };
      
      // (Logik aus Version 1)
      if (!isSuperAdmin || user.role !== 'ADMIN') {
        delete payload.permissions;
      }
      
      // (Logik aus Version 1)
      if (password && password.trim().length > 0) {
        payload.password = password;
      }

      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // ✅ KORREKTUR 1 (aus Version 1): 'result' als 'unknown' typisieren
      const result: unknown = await response.json();

      if (!response.ok) {
        // ✅ KORREKTUR 2 (aus Version 1): Type-Guard für Fehler
        let errorMessage = `HTTP ${response.status}: Ein Fehler ist aufgetreten.`;
        if (typeof result === 'object' && result !== null) {
            const errorObj = result as { message?: string; error?: string };
            errorMessage = errorObj.message || errorObj.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // ✅ KORREKTUR 3 (aus Version 1): 'result' als 'User' typisieren
      const updatedUser = result as User;

      // (Success-Code - Kombiniert aus Version 1 und 2)
      setFormData({
        // ✅ KORREKTUR 4 (aus Version 1): 'updatedUser' statt 'result'
        email: updatedUser.email || '',
        mandantId: updatedUser.mandant_id || '',
        permissions: updatedUser.permissions?.join(', ') || '',
        domain: updatedUser.domain || '',
        gscSiteUrl: updatedUser.gsc_site_url || '',
        ga4PropertyId: updatedUser.ga4_property_id || '',
        semrushProjectId: updatedUser.semrush_project_id || '',
        semrushTrackingId: updatedUser.semrush_tracking_id || '',
        semrushTrackingId02: updatedUser.semrush_tracking_id_02 || '',
        favicon_url: updatedUser.favicon_url || '',
        // ✅ NEUE FELDER (aus Version 2)
        project_start_date: formatDateForInput(updatedUser.project_start_date),
        project_duration_months: String(updatedUser.project_duration_months || 6),
      });
      setPassword('');
      setMessage('');
      setSuccessMessage('✅ Benutzer erfolgreich aktualisiert!');
      if (onUserUpdated) onUserUpdated();
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error) {
      console.error('❌ Update Error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      setMessage(`❌ Fehler: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Rendering des Formulars ---
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Pencil size={20} /> Benutzerinformationen bearbeiten
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* (E-Mail - Unverändert) */}
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

        {/* (Passwort - Unverändert) */}
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

        {/* --- Mandant & Berechtigungen (aus Version 1) --- */}
        <div className="border-t pt-4 mt-4">
          <label className="block text-sm font-medium text-gray-700">Mandant-ID (Label)</label>
          <input
            type="text"
            value={formData.mandantId}
            onChange={(e) => handleInputChange('mandantId', e.target.value)}
            placeholder="z.B. max-online"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
            disabled={isSubmitting || !isSuperAdmin}
            readOnly={!isSuperAdmin}
          />
        </div>

        {isSuperAdmin && user.role === 'ADMIN' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Admin-Berechtigungen (kommagetrennt)
            </label>
            <input
              type="text"
              value={formData.permissions}
              onChange={(e) => handleInputChange('permissions', e.target.value)}
              placeholder={isSuperAdmin ? "z.B. kann_admins_verwalten" : "Nur von Superadmin editierbar"}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
              disabled={isSubmitting || !isSuperAdmin}
              readOnly={!isSuperAdmin}
            />
            <p className="mt-1 text-xs text-gray-500">
              Labels mit Komma trennen.
            </p>
          </div>
        )}

        {/* --- Wrapper für BENUTZER-spezifische Felder --- */}
        {user.role === 'BENUTZER' && (
          <>
            {/* --- ✅ NEU: Projekt-Timeline Sektion (aus Version 2) --- */}
            <fieldset className="border-t pt-4 mt-4">
              <legend className="text-sm font-medium text-gray-700 mb-2">Projekt-Timeline</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Startdatum */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                    <CalendarEvent size={14} /> Projekt-Startdatum
                  </label>
                  <input
                    type="date"
                    value={formData.project_start_date}
                    onChange={(e) => handleInputChange('project_start_date', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={isSubmitting}
                  />
                </div>
                {/* Dauer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                    <ClockHistory size={14} /> Projektdauer (Monate)
                  </label>
                  <select
                    value={formData.project_duration_months}
                    onChange={(e) => handleInputChange('project_duration_months', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={isSubmitting}
                  >
                    <option value="6">6 Monate</option>
                    <option value="12">12 Monate</option>
                    <option value="18">18 Monate</option>
                    <option value="24">24 Monate</option>
                  </select>
                </div>
              </div>
            </fieldset>

            {/* --- ✅ RESTRUKTURIERT: Konfiguration (aus Version 2) --- */}
            <fieldset className="border-t pt-4 mt-4">
              <legend className="text-sm font-medium text-gray-700 mb-2">Konfiguration</legend>
              
              {/* (Domain) */}
              <div className="mb-4">
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

              {/* (Favicon URL) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Favicon URL</label>
                <input
                  type="text"
                  value={formData.favicon_url}
                  onChange={(e) => handleInputChange('favicon_url', e.target.value)}
                  placeholder="Optional: https://example.com/favicon.png"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                  disabled={isSubmitting}
                />
              </div>

              {/* (GSC Site URL) */}
              <div className="mb-4">
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

              {/* (GA4 Property ID) */}
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
            </fieldset>

            {/* ========== ✅ RESTRUKTURIERT: SEMRUSH SECTION ========== */}
            <fieldset className="border-t pt-4 mt-4">
              <legend className="text-sm font-medium text-gray-700 mb-2">Semrush</legend>
              
              {/* (Semrush Projekt ID) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Semrush Projekt ID
                </label>
                <input
                  type="text"
                  value={formData.semrushProjectId}
                  onChange={(e) => handleInputChange('semrushProjectId', e.target.value)}
                  placeholder="z.B. 12920575"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                  disabled={isSubmitting}
                />
              </div>

              {/* (Semrush Tracking-ID (Kampagne 1)) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Semrush Tracking-ID (Kampagne 1)
                </label>
                <input
                  type="text"
                  value={formData.semrushTrackingId}
                  onChange={(e) => handleInputChange('semrushTrackingId', e.target.value)}
                  placeholder="z.B. 1209408"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                  disabled={isSubmitting}
                />
              </div>

              {/* (Semrush Tracking-ID 02 (Kampagne 2)) */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Semrush Tracking-ID (Kampagne 2)
                </label>
                <input
                  type="text"
                  value={formData.semrushTrackingId02}
                  onChange={(e) => handleInputChange('semrushTrackingId02', e.target.value)}
                  placeholder="z.B. 1209491"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-gray-400">Optional: Für eine zweite Kampagne/Tracking</p>
              </div>
            </fieldset>
          </>
        )}
        {/* --- ENDE Wrapper --- */}
        
        {/* (Button & Messages - Unverändert) */}
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
    </div>
  );
}
