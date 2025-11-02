// src/app/admin/edit/[id]/EditUserForm.tsx
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { User } from '@/types';
import { Pencil, ArrowRepeat, CheckCircle } from 'react-bootstrap-icons';

// KORREKTUR: Interface EXPORTIEREN
export interface EditUserFormProps {
  user: User;
  onUserUpdated?: () => void;
  isSuperAdmin: boolean; // NEU: Info, ob der EINGELOGGTE Benutzer Superadmin ist
}

export default function EditUserForm({ user, onUserUpdated, isSuperAdmin }: EditUserFormProps) {
  // (Form States - Unverändert)
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
  });

  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // (useEffect zum Füllen - Unverändert)
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

  // (handleSubmit - Unverändert, die API prüft die Berechtigung)
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

      const payload: Record<string, string | string[] | null | undefined> = {
        email: formData.email,
        mandant_id: formData.mandantId || null,
        // KORREKTUR: Sende 'permissions' nur, wenn Superadmin
        // (Das Backend MUSS dies trotzdem prüfen!)
        permissions: isSuperAdmin ? permissionsArray : undefined,
      };
      
      if (!isSuperAdmin) {
        // Wenn kein Superadmin, sende permissions nicht mit
        delete payload.permissions;
      }

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

      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || `HTTP ${response.status}: Ein Fehler ist aufgetreten.`);
      }

      // (Restlicher Success-Code - Unverändert)
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

        {/* --- KORREKTUR: Mandant & Berechtigungen --- */}
        <div className="border-t pt-4 mt-4">
          <label className="block text-sm font-medium text-gray-700">Mandant-ID (Label)</label>
          <input
            type="text"
            value={formData.mandantId}
            onChange={(e) => handleInputChange('mandantId', e.target.value)}
            placeholder="z.B. max-online"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
            // KORREKTUR: Nur Superadmin darf Mandant-ID ändern
            disabled={isSubmitting || !isSuperAdmin}
            readOnly={!isSuperAdmin}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Berechtigungen (Klasse)</label>
          <input
            type="text"
            value={formData.permissions}
            onChange={(e) => handleInputChange('permissions', e.target.value)}
            placeholder={isSuperAdmin ? "z.B. kann_admins_verwalten" : "Nur von Superadmin editierbar"}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
            // KORREKTUR: Nur Superadmin darf Berechtigungen (Klasse) ändern
            disabled={isSubmitting || !isSuperAdmin}
            readOnly={!isSuperAdmin}
          />
          <p className="mt-1 text-xs text-gray-500">
            Labels mit Komma trennen.
          </p>
        </div>

        {/* (Kunden-spezifische Felder - Unverändert) */}
        {user.role === 'BENUTZER' && (
          <>
            {/* ... (domain, gsc, ga4, semrush...) ... */}
          </>
        )}
        
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

      {/* (Debug Section - Unverändert) */}
    </div>
  );
}
